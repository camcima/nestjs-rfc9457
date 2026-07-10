import { BadRequestException, HttpException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { Rfc9457ValidationException } from '../../src/validation/rfc9457-validation.exception';
import { createRfc9457ValidationPipeExceptionFactory } from '../../src/validation/rfc9457-validation-pipe-exception.factory';
import { ProblemDetailsFactory } from '../../src/problem-details.factory';

describe('Rfc9457ValidationException', () => {
  it('extends HttpException, not BadRequestException (BREAKING vs earlier releases (<=0.4.x))', () => {
    const errors: ValidationError[] = [];
    const exception = new Rfc9457ValidationException(errors);
    expect(exception).toBeInstanceOf(HttpException);
    expect(exception).not.toBeInstanceOf(BadRequestException);
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
    expect((exception.validationErrors[0] as any).property).toBe('email');
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

describe('configurable Tier 2 status', () => {
  it('defaults to 400 with unchanged output shape', () => {
    const factory = new ProblemDetailsFactory({});
    const exception = new Rfc9457ValidationException([
      { property: 'email', constraints: { isEmail: 'email must be an email' } },
    ]);
    const { status, body } = factory.create(exception, { url: '/x', method: 'POST' });
    expect(status).toBe(400);
    expect(body.title).toBe('Bad Request');
    expect(body.detail).toBe('Request validation failed');
  });

  it('renders the configured status for 422', () => {
    const factory = new ProblemDetailsFactory({});
    const exception = new Rfc9457ValidationException(
      [{ property: 'email', constraints: { isEmail: 'email must be an email' } }],
      422,
    );
    const { status, body } = factory.create(exception, { url: '/x', method: 'POST' });
    expect(status).toBe(422);
    expect(body.title).toBe('Unprocessable Entity');
    expect(body.errors).toHaveLength(1);
  });

  it('falls back to "Unknown Error" title for in-range statuses with no HTTP phrase', () => {
    const factory = new ProblemDetailsFactory({});
    const exception = new Rfc9457ValidationException([], 460);
    const { status, body } = factory.create(exception, { url: '/x', method: 'POST' });
    expect(status).toBe(460);
    expect(body.title).toBe('Unknown Error');
  });

  it('pipe exception factory forwards the configured status', () => {
    const exceptionFactory = createRfc9457ValidationPipeExceptionFactory({ status: 422 });
    const exception = exceptionFactory([]);
    expect(exception.getStatus()).toBe(422);
  });

  it('pipe exception factory defaults to 400', () => {
    const exceptionFactory = createRfc9457ValidationPipeExceptionFactory();
    expect(exceptionFactory([]).getStatus()).toBe(400);
  });

  it('pipe exception factory rejects non-error statuses at configuration time', () => {
    expect(() => createRfc9457ValidationPipeExceptionFactory({ status: 200 })).toThrow(RangeError);
  });

  it('constructor rejects an out-of-range status even on direct construction', () => {
    expect(() => new Rfc9457ValidationException([], 200)).toThrow(RangeError);
  });

  it('constructor accepts the boundary status 599', () => {
    expect(() => new Rfc9457ValidationException([], 599)).not.toThrow();
  });

  it('constructor rejects non-integer statuses (NaN comparisons are always false)', () => {
    expect(() => new Rfc9457ValidationException([], NaN)).toThrow(RangeError);
    expect(() => new Rfc9457ValidationException([], 400.5)).toThrow(RangeError);
  });

  it('pipe exception factory rejects non-integer statuses', () => {
    expect(() => createRfc9457ValidationPipeExceptionFactory({ status: NaN })).toThrow(RangeError);
    expect(() => createRfc9457ValidationPipeExceptionFactory({ status: 400.5 })).toThrow(
      RangeError,
    );
  });
});
