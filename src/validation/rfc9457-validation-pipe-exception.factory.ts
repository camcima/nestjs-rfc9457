import { ValidationError } from 'class-validator';
import { Rfc9457ValidationException } from './rfc9457-validation.exception';

export function createRfc9457ValidationPipeExceptionFactory(): (
  errors: ValidationError[],
) => Rfc9457ValidationException {
  return (errors: ValidationError[]): Rfc9457ValidationException => {
    return new Rfc9457ValidationException(errors);
  };
}
