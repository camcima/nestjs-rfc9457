import { Rfc9457ValidationException } from './rfc9457-validation.exception';

export interface Rfc9457ValidationPipeExceptionFactoryOptions {
  /**
   * HTTP status for the produced exception. Must be an error status
   * (400–599). Default: 400. Match this to ValidationPipe's
   * `errorHttpStatusCode` if you set one.
   */
  status?: number;
}

export function createRfc9457ValidationPipeExceptionFactory(
  options?: Rfc9457ValidationPipeExceptionFactoryOptions,
): (errors: unknown[]) => Rfc9457ValidationException {
  const status = options?.status ?? 400;
  if (status < 400 || status > 599) {
    throw new RangeError(
      `createRfc9457ValidationPipeExceptionFactory: status must be an error status (400-599), got ${status}`,
    );
  }
  return (errors: unknown[]): Rfc9457ValidationException => {
    return new Rfc9457ValidationException(errors, status);
  };
}
