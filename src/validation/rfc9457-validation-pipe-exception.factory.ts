import { Rfc9457ValidationException } from './rfc9457-validation.exception';

export function createRfc9457ValidationPipeExceptionFactory(): (
  errors: unknown[],
) => Rfc9457ValidationException {
  return (errors: unknown[]): Rfc9457ValidationException => {
    return new Rfc9457ValidationException(errors);
  };
}
