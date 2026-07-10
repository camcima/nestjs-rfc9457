import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Structured (Tier 2) validation exception. Carries the raw validation
 * errors for the exception filter to flatten into the `errors` extension.
 *
 * BREAKING (vs earlier releases (<=0.4.x)): extends HttpException rather than
 * BadRequestException so the status is configurable (e.g. 422). `instanceof
 * BadRequestException` no longer matches.
 *
 * The constructor guards `status` to the 400-599 error range (mirroring the
 * guard already enforced by
 * {@link createRfc9457ValidationPipeExceptionFactory} at configuration time),
 * throwing a `RangeError` for anything outside it — direct construction with
 * e.g. `200` would otherwise bypass that guard and produce a nonsense
 * problem-details response.
 */
export class Rfc9457ValidationException extends HttpException {
  constructor(
    public readonly validationErrors: unknown[],
    status: number = HttpStatus.BAD_REQUEST,
  ) {
    super('Request validation failed', Rfc9457ValidationException.validateStatus(status));
  }

  private static validateStatus(status: number): number {
    // Integer check first: NaN fails every comparison, so range checks alone let it through
    if (!Number.isInteger(status) || status < 400 || status > 599) {
      throw new RangeError(
        `Rfc9457ValidationException: status must be an error status (400-599), got ${status}`,
      );
    }
    return status;
  }
}
