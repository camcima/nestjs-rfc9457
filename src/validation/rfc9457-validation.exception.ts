import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Structured (Tier 2) validation exception. Carries the raw validation
 * errors for the exception filter to flatten into the `errors` extension.
 *
 * BREAKING (vs <=1.x): extends HttpException rather than BadRequestException
 * so the status is configurable (e.g. 422). `instanceof BadRequestException`
 * no longer matches.
 */
export class Rfc9457ValidationException extends HttpException {
  constructor(
    public readonly validationErrors: unknown[],
    status: number = HttpStatus.BAD_REQUEST,
  ) {
    super('Request validation failed', status);
  }
}
