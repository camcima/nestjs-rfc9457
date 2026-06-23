import { Type } from '@nestjs/common';

/**
 * Minimal request context used by the factory and callbacks.
 * Declares only the members the library itself relies on. Both Express's
 * `Request` and Fastify's `FastifyRequest` are structurally assignable to it.
 * To read adapter-specific fields inside a callback, narrow to the concrete
 * request type (e.g. `request as unknown as Request`).
 */
export interface Rfc9457Request {
  url: string;
  method: string;
}

/**
 * RFC 9457 Problem Details response body.
 * The index signature allows extension members for problem-type-specific data.
 */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

/**
 * Metadata template for the @ProblemType() decorator.
 * Restricted to problem TYPE identity fields only (type, title, status).
 * Occurrence-specific fields (detail, instance) are always derived at
 * runtime by the factory from the exception and request context.
 * This keeps decorator metadata focused on "what kind of problem"
 * rather than "what happened this time."
 */
export interface ProblemTypeMetadata {
  type?: string;
  title?: string;
  status?: number;
}

export type InstanceStrategy =
  | 'request-uri'
  | 'uuid'
  | 'none'
  | ((request: Rfc9457Request, exception: unknown) => string | undefined);

export interface Rfc9457ModuleOptions {
  typeBaseUri?: string;
  instanceStrategy?: InstanceStrategy;
  catchAllExceptions?: boolean;
  /**
   * HTTP status codes at which `ValidationPipe` default output (an
   * `HttpException` whose response is `{ message: string[], error: <status
   * phrase> }`) is treated as a Tier 1 validation error. Default: `[400]`.
   *
   * Set this when you configure `ValidationPipe({ errorHttpStatusCode })`,
   * e.g. `validationStatuses: [400, 422]`. Detection is an explicit
   * allow-list because the validation response shape is indistinguishable
   * from business `HttpException`s constructed with a message array (NestJS
   * sets the `error` field to the status phrase in both cases) — declare
   * only statuses your application reserves for validation. At undeclared
   * statuses the messages are preserved by joining them into `detail`.
   */
  validationStatuses?: number[];
  exceptionMapper?: (exception: unknown, request: Rfc9457Request) => ProblemDetail | null;
  /**
   * Overrides the default Tier 1 validation response. Receives the flat
   * message array, the request, and the HTTP status the exception carried
   * (one of `validationStatuses`). Do not hard-code `status` in the result
   * if you declare multiple validation statuses — echo the `status`
   * parameter instead.
   */
  validationExceptionMapper?: (
    messages: string[],
    request: Rfc9457Request,
    status: number,
  ) => ProblemDetail;
  /**
   * Called when a non-`HttpException` reaches the filter's catch-all branch
   * (i.e. `catchAllExceptions: true` AND the `exceptionMapper` returned `null`).
   *
   * If not provided, the filter logs the exception via NestJS's built-in
   * `Logger` (context `Rfc9457ExceptionFilter`) at error level. Provide this
   * callback to redirect logging elsewhere (custom metric, structured pino
   * event, sink-specific adapter) or to suppress the default log entirely.
   *
   * The filter **still** sends the generic problem-details response after
   * invoking this callback — it exists purely for observability.
   */
  onUnhandled?: (exception: unknown, request: Rfc9457Request) => void;
}

export interface Rfc9457OptionsFactory {
  createRfc9457Options(): Promise<Rfc9457ModuleOptions> | Rfc9457ModuleOptions;
}

export interface Rfc9457AsyncModuleOptions {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<Rfc9457ModuleOptions> | Rfc9457ModuleOptions;
  inject?: any[];
  useClass?: Type<Rfc9457OptionsFactory>;
  useExisting?: Type<Rfc9457OptionsFactory>;
}
