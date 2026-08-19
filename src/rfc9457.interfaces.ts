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
  /**
   * Express sets this to the original, un-rewritten request URL. Mounted
   * routers and path-mounted middleware mutate `url` relative to the mount
   * point, so `originalUrl` is the stable client-facing path. The
   * `'request-uri'` instance strategy prefers it when present and falls back
   * to `url` (Fastify does not define it, and there `url` is already stable).
   */
  originalUrl?: string;
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
  /**
   * When true, the `detail` member is stripped from every problem response
   * with a 5xx status, regardless of its source (HttpException message,
   * mapper result, or decorator metadata). Blunt by design: a production
   * hardening switch guaranteeing no internal error text reaches clients.
   *
   * Default: false — matching NestJS semantics, where an explicit
   * `HttpException` message is client-facing by design.
   */
  suppress5xxDetail?: boolean;
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
   * The third parameter carries the fully resolved problem body that is about
   * to be sent, so the `instance` identifier generated for this occurrence
   * (e.g. under `instanceStrategy: 'uuid'`) can be recorded alongside the
   * stack trace and correlated with the client's copy. Mutating it has no
   * effect — the response is serialized from the same object immediately
   * after this callback returns, so treat it as read-only.
   *
   * The filter **still** sends the problem-details response after invoking
   * this callback — it exists purely for observability.
   */
  onUnhandled?: (exception: unknown, request: Rfc9457Request, problem: ProblemDetail) => void;
  /**
   * Supplies transport response headers that accompany a problem response —
   * `Retry-After` on 429/503, `WWW-Authenticate` on 401, and similar status
   * companions that belong in the header block rather than the body.
   *
   * Called once per problem response with the fully resolved body, the
   * originating exception, and the request. Return `undefined` (or an empty
   * object) to add nothing. Header names are passed to the HTTP adapter
   * verbatim. `Content-Type` is reserved by the library and cannot be
   * overridden here.
   *
   * Headers carried by a {@link ProblemDetailException} are applied first;
   * whatever this callback returns is merged over them, so a global policy
   * can override a throw-site value.
   *
   * Like every other callback, a throw here is contained: it is logged and
   * the response is sent without the extra headers.
   */
  responseHeaders?: (
    problem: ProblemDetail,
    exception: unknown,
    request: Rfc9457Request,
  ) => Record<string, string> | undefined;
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
