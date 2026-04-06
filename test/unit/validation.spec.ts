import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { Rfc9457ValidationException } from '../../src/validation/rfc9457-validation.exception';
import { createRfc9457ValidationPipeExceptionFactory } from '../../src/validation/rfc9457-validation-pipe-exception.factory';

describe('Rfc9457ValidationException', () => {
  it('extends BadRequestException', () => {
    const errors: ValidationError[] = [];
    const exception = new Rfc9457ValidationException(errors);
    expect(exception).toBeInstanceOf(BadRequestException);
  });

  it('preserves validation errors', () => {
    const errors: ValidationError[] = [
      Object.assign(new ValidationError(), {
        property: 'email',
        constraints: { isEmail: 'email must be an email' },
      }),
    ];
    const exception = new Rfc9457ValidationException(errors);
    expect(exception.validationErrors).toBe(errors);
    expect(exception.validationErrors).toHaveLength(1);
    expect(exception.validationErrors[0].property).toBe('email');
  });

  it('has status 400', () => {
    const exception = new Rfc9457ValidationException([]);
    expect(exception.getStatus()).toBe(400);
  });
});

describe('createRfc9457ValidationPipeExceptionFactory', () => {
  it('returns a function', () => {
    const factory = createRfc9457ValidationPipeExceptionFactory();
    expect(typeof factory).toBe('function');
  });

  it('returned function produces Rfc9457ValidationException', () => {
    const factory = createRfc9457ValidationPipeExceptionFactory();
    const errors: ValidationError[] = [
      Object.assign(new ValidationError(), {
        property: 'age',
        constraints: { min: 'age must not be less than 0' },
      }),
    ];
    const result = factory(errors);
    expect(result).toBeInstanceOf(Rfc9457ValidationException);
    expect(result.validationErrors).toBe(errors);
  });

  it('handles empty error arrays', () => {
    const factory = createRfc9457ValidationPipeExceptionFactory();
    const result = factory([]);
    expect(result).toBeInstanceOf(Rfc9457ValidationException);
    expect(result.validationErrors).toHaveLength(0);
  });
});
