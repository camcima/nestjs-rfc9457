import { HttpException } from '@nestjs/common';
import { ProblemDetail } from './rfc9457.interfaces';

/**
 * A {@link ProblemDetail} whose `status` member is mandatory. RFC 9457 problem
 * documents are error responses, so the throw site must say which error.
 */
export type ProblemDetailWithStatus = ProblemDetail & { status: number };

export interface ProblemDetailExceptionOptions {
  /**
   * Transport response headers to send alongside this problem — e.g.
   * `{ 'Retry-After': '60' }` on a 429, or `{ 'WWW-Authenticate': 'Bearer' }`
   * on a 401. Applied by the exception filter before the body is written;
   * `Content-Type` is reserved by the library and cannot be overridden.
   */
  headers?: Record<string, string>;
}

/**
 * Throw a fully-formed RFC 9457 problem document, including extension members,
 * from anywhere in a request handler.
 *
 * The default `HttpException` path can only carry `status` and a `detail`
 * string, so occurrence-specific extension members (`balance`, `retryAfter`,
 * `traceId`, …) have no way through it — the whole point of RFC 9457's
 * extensibility. Use `@ProblemType()` for a *reusable* problem type and this
 * exception for a *one-off* problem, or both together: decorator metadata
 * supplies the defaults and the instance members override them.
 *
 * ```typescript
 * throw new ProblemDetailException({
 *   type: 'https://api.example.com/problems/insufficient-funds',
 *   title: 'Insufficient Funds',
 *   status: 402,
 *   detail: 'Your balance is too low to cover this transfer.',
 *   balance: 30,
 *   cost: 50,
 * });
 * ```
 *
 * Every member is passed through to the response body as-is; the factory still
 * normalizes `type` (expanding a bare slug against `typeBaseUri`), fills a
 * missing `title` from the status phrase, and applies the configured instance
 * strategy.
 */
export class ProblemDetailException extends HttpException {
  /** The problem document supplied at the throw site. */
  readonly problem: ProblemDetailWithStatus;

  /** Response headers to send with this problem, if any. */
  readonly headers?: Record<string, string>;

  constructor(problem: ProblemDetailWithStatus, options?: ProblemDetailExceptionOptions) {
    super(problem, ProblemDetailException.validateStatus(problem?.status));
    // Defensive copy: the caller keeps no handle on the object the factory
    // reads, so a mutation after the throw cannot alter the response.
    this.problem = { ...problem };
    if (options?.headers) {
      this.headers = { ...options.headers };
    }
  }

  private static validateStatus(status: unknown): number {
    // Integer check first: NaN fails every comparison, so range checks alone let it through
    if (typeof status !== 'number' || !Number.isInteger(status) || status < 400 || status > 599) {
      throw new RangeError(
        `ProblemDetailException: status must be an error status (400-599), got ${String(status)}`,
      );
    }
    return status;
  }
}
