import { Type } from '@nestjs/common';

/**
 * Minimal request context used by the factory and callbacks.
 * Compatible with both Express and Fastify request objects.
 */
export interface Rfc9457Request {
  url: string;
  method: string;
  [key: string]: unknown;
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
  exceptionMapper?: (exception: unknown, request: Rfc9457Request) => ProblemDetail | null;
  validationExceptionMapper?: (messages: string[], request: Rfc9457Request) => ProblemDetail;
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
