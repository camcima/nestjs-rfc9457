import { ArgumentsHost, Catch, HttpException, Inject, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { ProblemDetailsFactory } from './problem-details.factory';
import {
  RFC9457_MODULE_OPTIONS,
  PROBLEM_CONTENT_TYPE,
  PROBLEM_TYPE_METADATA_KEY,
} from './rfc9457.constants';
import { ProblemDetail, Rfc9457ModuleOptions, Rfc9457Request } from './rfc9457.interfaces';
import { ProblemDetailException } from './problem-detail.exception';

@Catch()
export class Rfc9457ExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(Rfc9457ExceptionFilter.name);

  /**
   * Exception classes already reported by {@link warnIfDecoratedButDelegated},
   * so a hot endpoint throwing a decorated error cannot flood the log. Weak so
   * classes from a discarded module graph (hot reload) stay collectable.
   */
  private readonly warnedDecoratedClasses = new WeakSet<object>();

  constructor(
    private readonly factory: ProblemDetailsFactory,
    @Inject(RFC9457_MODULE_OPTIONS) private readonly options: Rfc9457ModuleOptions,
    private readonly adapterHost: HttpAdapterHost,
  ) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    // Only handle HTTP context. For other transports we rethrow rather than
    // calling super.catch(): BaseExceptionFilter is HTTP-adapter based and
    // would try to write an HTTP reply to a non-HTTP context, corrupting the
    // transport. Note the rethrow propagates OUT of Nest's exception-handler
    // invocation for that transport — it does not re-enter the WS/RPC default
    // handlers. Hybrid apps (gateways, microservices) should bind their own
    // transport-scoped exception filters rather than relying on this
    // catch-all filter. (GraphQL contexts are fine: the GraphQL driver
    // formats thrown resolver errors itself.)
    if (host.getType() !== 'http') {
      throw exception;
    }

    const isHttpException = exception instanceof HttpException;

    // Run exceptionMapper first, before the HttpException gate.
    // This ensures custom mappers can handle non-HttpException types
    // (e.g., DatabaseException) even without catchAllExceptions.
    if (this.options.exceptionMapper) {
      const ctx = host.switchToHttp();
      const request = ctx.getRequest();
      let mapped: ProblemDetail | null = null;
      try {
        mapped = this.options.exceptionMapper(exception, request);
      } catch (mapperError) {
        // A throwing mapper is an application bug, but the error path must
        // stay total: log it and continue with standard resolution.
        this.logger.error(
          'exceptionMapper threw while mapping an exception; continuing with standard resolution',
          mapperError instanceof Error ? mapperError.stack : undefined,
        );
      }
      if (mapped) {
        const response = ctx.getResponse();
        const { status, body } = this.factory.createFromMapped(mapped, exception, request);
        this.sendProblem(response, body, status, exception, request);
        return;
      }
    }

    // An HttpException carrying a non-error status (e.g. `new
    // HttpException('moved', 302)`) is a redirect/informational response, not a
    // problem. RFC 9457 §3 scopes problem documents to error responses, so
    // rendering one here would emit application/problem+json on a 3xx. Hand it
    // back to Nest, which sends its standard body at the requested status.
    // Note this runs after the mapper: a mapper that deliberately claims such
    // an exception still wins.
    if (isHttpException && !this.isErrorStatus(exception.getStatus())) {
      super.catch(exception, host);
      return;
    }

    // Non-HttpException without a matching mapper: delegate or catch-all
    if (!isHttpException && !this.options.catchAllExceptions) {
      this.warnIfDecoratedButDelegated(exception);
      super.catch(exception, host);
      return;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    // skipMapper: the filter already ran the mapper above and it returned null
    const { status, body } = this.factory.create(exception, request, { skipMapper: true });

    // A non-HttpException reached the catch-all branch, meaning the app didn't
    // model it as an HttpException and the exceptionMapper didn't recognise it
    // either. That's almost always a bug in the handler — report it before
    // rendering the generic 500 so the stack trace shows up in server logs.
    // Without this, unknown exceptions get silently flattened into a bland
    // problem-details body with no trail, hiding real bugs.
    //
    // Reporting happens after the body is built so the resolved `instance`
    // identifier can travel with the log line: under `instanceStrategy: 'uuid'`
    // that is the only thing tying the client's copy of the problem to this
    // stack trace.
    if (!isHttpException) {
      this.reportUnhandled(exception, request, body);
    }

    this.sendProblem(response, body, status, exception, request);
  }

  /** A problem document is an error response (RFC 9457): 400-599 only. */
  private isErrorStatus(status: number): boolean {
    return Number.isInteger(status) && status >= 400 && status <= 599;
  }

  /**
   * Reports an exception that reached the catch-all branch, via `onUnhandled`
   * when configured and NestJS's `Logger` otherwise.
   *
   * Consumers that want to redirect the default logging can call
   * `app.useLogger()` to swap NestJS's default logger (e.g. for pino). The
   * context name is `Rfc9457ExceptionFilter` so it can be filtered or silenced
   * selectively.
   */
  private reportUnhandled(
    exception: unknown,
    request: Rfc9457Request,
    problem: ProblemDetail,
  ): void {
    if (!this.options.onUnhandled) {
      this.logOriginal(exception, problem);
      return;
    }
    try {
      const maybeThenable = this.options.onUnhandled(exception, request, problem) as unknown;
      // onUnhandled is typed `=> void`, but TypeScript allows an `async`
      // callback there too (Promise<void> is assignable to void). If the
      // callback returned a thenable, attach a rejection handler so a
      // rejected promise never becomes an unhandled rejection and crashes
      // the process. The response write below must stay synchronous, so
      // this is intentionally not awaited.
      if (
        maybeThenable !== null &&
        (typeof maybeThenable === 'object' || typeof maybeThenable === 'function') &&
        typeof (maybeThenable as PromiseLike<unknown>).then === 'function'
      ) {
        Promise.resolve(maybeThenable as PromiseLike<unknown>).catch((callbackError: unknown) => {
          this.logger.error(
            'onUnhandled callback rejected; falling back to default logging',
            callbackError instanceof Error ? callbackError.stack : undefined,
          );
          this.logOriginal(exception, problem);
        });
      }
    } catch (callbackError) {
      // onUnhandled is observability-only: its failure must never replace
      // the response. Log the callback failure AND the original exception
      // so neither trail is lost.
      this.logger.error(
        'onUnhandled callback threw; falling back to default logging',
        callbackError instanceof Error ? callbackError.stack : undefined,
      );
      this.logOriginal(exception, problem);
    }
  }

  /**
   * Warns when an exception carrying `@ProblemType()` metadata is handed to
   * NestJS's default handler because it does not extend `HttpException` and
   * `catchAllExceptions` is off. The metadata is authored precisely to shape
   * the response, so silently ignoring it looks like a broken decorator.
   * Emitted once per exception class.
   */
  private warnIfDecoratedButDelegated(exception: unknown): void {
    if (exception == null || typeof exception !== 'object') return;
    const constructor = (exception as object).constructor;
    if (!constructor || this.warnedDecoratedClasses.has(constructor)) return;
    if (!Reflect.getMetadata(PROBLEM_TYPE_METADATA_KEY, constructor)) return;
    this.warnedDecoratedClasses.add(constructor);
    this.logger.warn(
      `${constructor.name} carries @ProblemType() metadata but does not extend HttpException, ` +
        'so it was passed to the default NestJS error handler and the metadata was ignored. ' +
        'Enable `catchAllExceptions: true`, extend HttpException, or claim it in `exceptionMapper`.',
    );
  }

  /**
   * Collects the response headers that accompany this problem: those carried
   * by a {@link ProblemDetailException}, with the `responseHeaders` callback
   * merged over them so a global policy can override a throw-site value.
   */
  private resolveHeaders(
    body: ProblemDetail,
    exception: unknown,
    request: Rfc9457Request,
  ): Record<string, string> | undefined {
    let headers: Record<string, string> | undefined;
    if (exception instanceof ProblemDetailException && exception.headers) {
      headers = { ...exception.headers };
    }
    if (this.options.responseHeaders) {
      try {
        const extra = this.options.responseHeaders(body, exception, request);
        if (extra) {
          headers = { ...headers, ...extra };
        }
      } catch (headersError) {
        // Contained like every other callback: the response still goes out,
        // just without the extra headers.
        this.logger.error(
          'responseHeaders threw; sending the problem response without additional headers',
          headersError instanceof Error ? headersError.stack : undefined,
        );
      }
    }
    return headers;
  }

  /**
   * Writes the problem response unless headers are already committed
   * (e.g. an exception thrown mid-stream). Mirrors Nest's own
   * BaseExceptionFilter: when the response cannot be safely replaced,
   * log the original exception and end the connection.
   */
  private sendProblem(
    response: unknown,
    body: ProblemDetail,
    status: number,
    exception: unknown,
    request: Rfc9457Request,
  ): void {
    const httpAdapter = this.adapterHost.httpAdapter;
    if (httpAdapter.isHeadersSent(response)) {
      this.logger.error(
        'Cannot send problem details: headers already sent; ending response',
        exception instanceof Error ? exception.stack : String(exception),
      );
      httpAdapter.end(response);
      return;
    }
    const headers = this.resolveHeaders(body, exception, request);
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        httpAdapter.setHeader(response, name, value);
      }
    }
    // Set last so Content-Type stays reserved: RFC 9457 requires
    // application/problem+json, and a stray header entry must not displace it.
    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
    httpAdapter.reply(response, body, status);
  }

  private logOriginal(exception: unknown, problem?: ProblemDetail): void {
    // The instance identifier is the only handle a client can quote back, so
    // it belongs in the log line whenever one was generated.
    const instance =
      typeof problem?.instance === 'string' ? ` [instance: ${problem.instance}]` : '';
    if (exception instanceof Error) {
      // Pass stack as 2nd arg so NestJS routes it through its stack-trace
      // slot while preserving the constructor's context (`Rfc9457ExceptionFilter`).
      this.logger.error(
        `Unhandled non-HTTP exception: ${exception.message}${instance}`,
        exception.stack,
      );
    } else {
      this.logger.error(`Unhandled non-HTTP exception (non-Error value thrown)${instance}`, {
        exception,
      });
    }
  }
}
