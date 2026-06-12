import { HttpException, Inject, Injectable } from '@nestjs/common';
import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  ProblemDetail,
  ProblemTypeMetadata,
  Rfc9457ModuleOptions,
  Rfc9457Request,
} from './rfc9457.interfaces';
import { PROBLEM_TYPE_METADATA_KEY, RFC9457_MODULE_OPTIONS } from './rfc9457.constants';
import { Rfc9457ValidationException } from './validation/rfc9457-validation.exception';
import { toSlug } from './utils/slug';

@Injectable()
export class ProblemDetailsFactory {
  constructor(
    @Inject(RFC9457_MODULE_OPTIONS) private readonly options: Rfc9457ModuleOptions = {},
  ) {}

  /** @internal Used by Rfc9457ExceptionFilter — not part of the public API. */
  createFromMapped(
    mapped: ProblemDetail,
    exception: unknown,
    request: Rfc9457Request,
  ): { status: number; body: ProblemDetail } {
    const result = { ...mapped };
    return this.normalize(result, exception, request);
  }

  /**
   * Resolve an exception to a Problem Details response.
   * Always returns a result — the factory owns the fallback behavior.
   *
   * @param exception - The caught exception (any type)
   * @param request - The incoming request context
   */
  create(exception: unknown, request: Rfc9457Request): { status: number; body: ProblemDetail };
  /** @internal */
  create(
    exception: unknown,
    request: Rfc9457Request,
    options: { skipMapper: true },
  ): { status: number; body: ProblemDetail };
  create(
    exception: unknown,
    request: Rfc9457Request,
    options?: { skipMapper?: boolean },
  ): { status: number; body: ProblemDetail } {
    let result: ProblemDetail | null = null;

    // Step 1: exceptionMapper callback.
    // Skipped when the filter already ran the mapper (to avoid double invocation).
    if (!options?.skipMapper && this.options.exceptionMapper) {
      const mapped = this.options.exceptionMapper(exception, request);
      if (mapped) {
        result = { ...mapped };
      }
    }

    // Step 2: @ProblemType() decorator metadata
    if (!result && exception != null && typeof exception === 'object') {
      const constructor = (exception as object).constructor;
      if (constructor) {
        const metadata: ProblemTypeMetadata | undefined = Reflect.getMetadata(
          PROBLEM_TYPE_METADATA_KEY,
          constructor,
        );
        if (metadata) {
          result = { ...metadata };
          // Metadata only carries type identity (type, title, status).
          // detail is always derived from the exception at runtime.
          const detail = this.extractDetail(exception);
          if (detail !== undefined) {
            result.detail = detail;
          }
        }
      }
    }

    // Step 3: Validation handling
    if (!result) {
      result = this.handleValidation(exception, request);
    }

    // Step 4: Default HttpException handling
    if (!result && exception instanceof HttpException) {
      const exceptionStatus = exception.getStatus();
      result = {
        status: exceptionStatus,
        title: http.STATUS_CODES[exceptionStatus] || 'Unknown Error',
      };
      const detail = this.extractDetail(exception);
      if (detail !== undefined) {
        result.detail = detail;
      }
    }

    // Step 5: Unknown exception fallback
    // Internal safety net: the filter is responsible for routing only appropriate
    // exceptions to the factory. If we reach here, it means no resolution step
    // matched. Produce a generic 500 regardless of catchAllExceptions — this is
    // defensive, not part of the public contract.
    if (!result) {
      result = {
        status: 500,
        title: 'Internal Server Error',
        // detail intentionally omitted — do not leak internal error info
      };
    }

    return this.normalize(result, exception, request);
  }

  private normalize(
    result: ProblemDetail,
    exception: unknown,
    request: Rfc9457Request,
  ): { status: number; body: ProblemDetail } {
    // Resolve definitive transport status
    const httpStatus = this.resolveStatus(result, exception);

    // Normalize type
    result.type = this.normalizeType(result, httpStatus);

    // Set title if missing
    if (!result.title) {
      result.title = http.STATUS_CODES[httpStatus] || 'Unknown Error';
    }

    // Set advisory status in body
    result.status = httpStatus;

    // Apply instance strategy
    const instance = this.resolveInstance(request, exception);
    if (instance !== undefined) {
      result.instance = instance;
    }

    return { status: httpStatus, body: result };
  }

  private resolveStatus(result: ProblemDetail, exception: unknown): number {
    if (
      result.status !== undefined &&
      typeof result.status === 'number' &&
      result.status >= 100 &&
      result.status < 600
    ) {
      return result.status;
    }
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return 500;
  }

  private isUriReference(value: string): boolean {
    // Matches any URI with a scheme (RFC 3986: scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ))
    return /^[a-zA-Z][a-zA-Z0-9+\-.]*:/.test(value);
  }

  private normalizeType(result: ProblemDetail, status: number): string {
    if (result.type) {
      // Already a full URI reference (https://, urn:, about:, mailto:, etc.) — pass through
      if (this.isUriReference(result.type)) {
        return result.type;
      }
      // Bare slug — expand with typeBaseUri if configured
      if (this.options.typeBaseUri) {
        const baseUri = this.options.typeBaseUri.replace(/\/+$/, '');
        return `${baseUri}/${result.type}`;
      }
      return result.type;
    }
    if (this.options.typeBaseUri) {
      const phrase = http.STATUS_CODES[status] || 'Unknown Error';
      const slug = toSlug(phrase);
      const baseUri = this.options.typeBaseUri.replace(/\/+$/, '');
      return `${baseUri}/${slug}`;
    }
    return 'about:blank';
  }

  private resolveInstance(request: Rfc9457Request, exception: unknown): string | undefined {
    const strategy = this.options.instanceStrategy || 'none';
    if (strategy === 'none') return undefined;
    if (strategy === 'request-uri') return request.url.split('?')[0];
    if (strategy === 'uuid') return `urn:uuid:${randomUUID()}`;
    if (typeof strategy === 'function') return strategy(request, exception);
    return undefined;
  }

  private extractDetail(exception: unknown): string | undefined {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const status = exception.getStatus();
      const defaultPhrase = http.STATUS_CODES[status];

      if (typeof response === 'string') {
        // Omit if it's just the default HTTP status phrase (boilerplate)
        return response === defaultPhrase ? undefined : response;
      }
      if (typeof response === 'object' && response !== null) {
        const msg = (response as any).message;
        if (typeof msg === 'string' && msg.length > 0) {
          return msg === defaultPhrase ? undefined : msg;
        }
        if (Array.isArray(msg) && msg.length > 0 && msg.every((m: any) => typeof m === 'string')) {
          return msg.join('; ');
        }
      }
      return undefined;
    }
    if (exception instanceof Error) {
      return exception.message || undefined;
    }
    return undefined;
  }

  private handleValidation(exception: unknown, request: Rfc9457Request): ProblemDetail | null {
    // Tier 2: Rfc9457ValidationException — safe to use instanceof since the class
    // no longer imports class-validator at runtime (validationErrors is unknown[]).
    if (exception instanceof Rfc9457ValidationException) {
      const validationErrors = exception.validationErrors;
      // Rfc9457ValidationException extends BadRequestException, so it is always 400.
      return {
        status: 400,
        title: 'Bad Request',
        detail: 'Request validation failed',
        errors: validationErrors.map((err) => this.flattenValidationError(err)),
      };
    }

    // Tier 1: NestJS ValidationPipe default output — an HttpException whose
    // response has the { message: string[], error: <status phrase> } shape
    // ValidationPipe produces. Detection is restricted to the configured
    // `validationStatuses` allow-list (default [400]): the shape alone cannot
    // discriminate validation output from business HttpExceptions constructed
    // with a message array, because NestJS sets the `error` field to the
    // status phrase in both cases (e.g. new ConflictException(['...']) yields
    // { message: [...], error: 'Conflict' }).
    if (this.isDefaultValidationException(exception)) {
      const httpException = exception as HttpException;
      const status = httpException.getStatus();
      const response = httpException.getResponse() as any;
      const messages: string[] = response.message;
      if (this.options.validationExceptionMapper) {
        return { ...this.options.validationExceptionMapper(messages, request, status) };
      }
      return {
        status,
        // Detection already matched the response's `error` field against
        // STATUS_CODES[status], so the phrase is guaranteed to exist here;
        // normalize() fills any missing title as a safety net regardless.
        title: http.STATUS_CODES[status],
        detail: 'Request validation failed',
        errors: messages,
      };
    }

    return null;
  }

  private isDefaultValidationException(exception: unknown): boolean {
    if (!(exception instanceof HttpException)) return false;
    const status = exception.getStatus();
    // Only statuses the application has declared as validation statuses are
    // eligible (default [400], matching ValidationPipe's default). Users who
    // configure ValidationPipe({ errorHttpStatusCode }) opt in explicitly via
    // the `validationStatuses` module option. Undeclared statuses degrade
    // gracefully: extractDetail() joins the message array into `detail`.
    const validationStatuses = this.options.validationStatuses ?? [400];
    if (!validationStatuses.includes(status)) return false;
    const response = exception.getResponse();
    if (typeof response !== 'object' || response === null) return false;
    const resp = response as any;
    // ValidationPipe sets `error` to the HTTP status phrase for the chosen
    // status. The comparison is case-insensitive because Nest's phrases can
    // differ from Node's in casing (418: "I'm a teapot" vs "I'm a Teapot").
    const phrase = http.STATUS_CODES[status];
    if (
      typeof resp.error !== 'string' ||
      typeof phrase !== 'string' ||
      resp.error.toLowerCase() !== phrase.toLowerCase()
    ) {
      return false;
    }
    const msg = resp.message;
    return Array.isArray(msg) && msg.length > 0 && msg.every((m: any) => typeof m === 'string');
  }

  private flattenValidationError(error: any): any {
    const result: any = { property: error.property };
    if (error.constraints) {
      result.constraints = error.constraints;
    }
    if (error.children && error.children.length > 0) {
      result.children = error.children.map((child: any) => this.flattenValidationError(child));
    }
    return result;
  }
}
