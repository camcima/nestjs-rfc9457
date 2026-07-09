import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProblemDetailsFactory } from '../../src/problem-details.factory';
import { Rfc9457ModuleOptions } from '../../src/rfc9457.interfaces';
import type { MockInstance } from 'vitest';

function createFactory(options: Rfc9457ModuleOptions = {}): ProblemDetailsFactory {
  return new ProblemDetailsFactory(options);
}

import { Rfc9457Request } from '../../src/rfc9457.interfaces';
import { Rfc9457ValidationException } from '../../src/validation/rfc9457-validation.exception';
import { ProblemType } from '../../src/problem-type.decorator';
import { ValidationError } from 'class-validator';

const mockRequest: Rfc9457Request = { url: '/api/users/42', method: 'GET' };

describe('ProblemDetailsFactory', () => {
  describe('default HttpException mapping', () => {
    it('maps a 404 with custom string detail', () => {
      const factory = createFactory();
      const { status, body } = factory.create(
        new NotFoundException('User 42 not found'),
        mockRequest,
      );
      expect(status).toBe(404);
      expect(body).toEqual({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'User 42 not found',
      });
    });

    it('omits detail for default boilerplate message (no custom detail)', () => {
      const factory = createFactory();
      const { status, body } = factory.create(new ForbiddenException(), mockRequest);
      expect(status).toBe(403);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Forbidden');
      expect(body.status).toBe(403);
      expect(body.detail).toBeUndefined();
    });

    it('maps a 400 with object response — extracts message string as detail', () => {
      const factory = createFactory();
      const exception = new BadRequestException({ message: 'Invalid email format', code: 'E001' });
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(400);
      expect(body.detail).toBe('Invalid email format');
    });

    it('omits detail when object response message is not a string', () => {
      const factory = createFactory();
      const exception = new HttpException({ message: 12345 }, 400);
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(400);
      expect(body.detail).toBeUndefined();
    });

    it('maps a 500 HttpException', () => {
      const factory = createFactory();
      const { status, body } = factory.create(
        new InternalServerErrorException('DB connection failed'),
        mockRequest,
      );
      expect(status).toBe(500);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Internal Server Error');
      expect(body.status).toBe(500);
      expect(body.detail).toBe('DB connection failed');
    });
  });

  describe('RFC-sensitive invariants', () => {
    it('defaults type to about:blank when not set', () => {
      const factory = createFactory();
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.type).toBe('about:blank');
    });

    it('uses HTTP reason phrase as title when type is about:blank', () => {
      const factory = createFactory();
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.title).toBe('Not Found');
    });

    it('body.status matches returned transport status', () => {
      const factory = createFactory();
      const { status, body } = factory.create(new ForbiddenException(), mockRequest);
      expect(body.status).toBe(status);
      expect(status).toBe(403);
    });

    it('extension members from exceptionMapper do not overwrite core fields', () => {
      const factory = createFactory({
        exceptionMapper: () => ({
          status: 422,
          title: 'Custom Title',
          detail: 'Custom detail',
          customField: 'custom-value',
        }),
      });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Custom Title');
      expect(body.status).toBe(422);
      expect(body.detail).toBe('Custom detail');
      expect(body.customField).toBe('custom-value');
    });
  });

  describe('detail derivation', () => {
    it('uses string response as detail', () => {
      const factory = createFactory();
      const exception = new HttpException('Raw string error', 400);
      const { body } = factory.create(exception, mockRequest);
      expect(body.detail).toBe('Raw string error');
    });

    it('extracts message string from object response', () => {
      const factory = createFactory();
      const exception = new HttpException({ message: 'Structured error' }, 400);
      const { body } = factory.create(exception, mockRequest);
      expect(body.detail).toBe('Structured error');
    });

    it('omits detail when object response has no string message', () => {
      const factory = createFactory();
      const exception = new HttpException({ error: 'no message key' }, 400);
      const { body } = factory.create(exception, mockRequest);
      expect(body.detail).toBeUndefined();
    });

    it('omits detail when message is an empty string', () => {
      const factory = createFactory();
      const exception = new HttpException({ message: '' }, 400);
      const { body } = factory.create(exception, mockRequest);
      expect(body.detail).toBeUndefined();
    });

    it('joins a string[] message into a single detail string', () => {
      const factory = createFactory();
      const exception = new ConflictException({ message: ['a conflict', 'another conflict'] });
      const { body } = factory.create(exception, mockRequest);
      expect(body.detail).toBe('a conflict; another conflict');
    });

    it('omits detail when a joined string[] message equals the default status phrase', () => {
      const factory = createFactory();
      const exception = new ConflictException({ message: ['Conflict'] });
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(409);
      expect(body.detail).toBeUndefined();
    });
  });

  describe('typeBaseUri', () => {
    it('generates type URI with slug when typeBaseUri is configured', () => {
      const factory = createFactory({ typeBaseUri: 'https://api.example.com/problems' });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.type).toBe('https://api.example.com/problems/not-found');
    });

    it('strips trailing slash from typeBaseUri', () => {
      const factory = createFactory({ typeBaseUri: 'https://api.example.com/problems/' });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.type).toBe('https://api.example.com/problems/not-found');
    });

    it('passes through user-supplied absolute URI from mapper', () => {
      const factory = createFactory({
        typeBaseUri: 'https://api.example.com/problems',
        exceptionMapper: () => ({
          type: 'https://custom.example.com/my-type',
          status: 400,
        }),
      });
      const { body } = factory.create(new BadRequestException(), mockRequest);
      expect(body.type).toBe('https://custom.example.com/my-type');
    });

    it('passes through about:blank from mapper', () => {
      const factory = createFactory({
        typeBaseUri: 'https://api.example.com/problems',
        exceptionMapper: () => ({
          type: 'about:blank',
          status: 400,
        }),
      });
      const { body } = factory.create(new BadRequestException(), mockRequest);
      expect(body.type).toBe('about:blank');
    });

    it('expands bare slug with typeBaseUri', () => {
      const factory = createFactory({
        typeBaseUri: 'https://api.example.com/problems',
        exceptionMapper: () => ({
          type: 'custom-problem',
          status: 400,
        }),
      });
      const { body } = factory.create(new BadRequestException(), mockRequest);
      expect(body.type).toBe('https://api.example.com/problems/custom-problem');
    });

    it('generates internal-server-error slug for 500', () => {
      const factory = createFactory({ typeBaseUri: 'https://api.example.com/problems' });
      const { body } = factory.create(new InternalServerErrorException(), mockRequest);
      expect(body.type).toBe('https://api.example.com/problems/internal-server-error');
    });

    it('passes through urn: URI references without rewriting', () => {
      const factory = createFactory({
        typeBaseUri: 'https://api.example.com/problems',
        exceptionMapper: () => ({
          type: 'urn:problem:quota-exceeded',
          status: 429,
        }),
      });
      const { body } = factory.create(new HttpException('quota', 429), mockRequest);
      expect(body.type).toBe('urn:problem:quota-exceeded');
    });

    it('passes through mailto: URI references without rewriting', () => {
      const factory = createFactory({
        typeBaseUri: 'https://api.example.com/problems',
        exceptionMapper: () => ({
          type: 'mailto:support@example.com',
          status: 400,
        }),
      });
      const { body } = factory.create(new BadRequestException(), mockRequest);
      expect(body.type).toBe('mailto:support@example.com');
    });

    it('passes bare slug through unchanged when no typeBaseUri is configured', () => {
      const factory = createFactory({
        exceptionMapper: () => ({ type: 'custom-problem', status: 400 }),
      });
      const { body } = factory.create(new BadRequestException(), mockRequest);
      expect(body.type).toBe('custom-problem');
    });
  });

  describe('instanceStrategy', () => {
    it('omits instance by default (none)', () => {
      const factory = createFactory();
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.instance).toBeUndefined();
    });

    it('uses request URL path for request-uri strategy', () => {
      const factory = createFactory({ instanceStrategy: 'request-uri' });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.instance).toBe('/api/users/42');
    });

    it('strips the query string for request-uri strategy', () => {
      const factory = createFactory({ instanceStrategy: 'request-uri' });
      const { body } = factory.create(new NotFoundException(), {
        url: '/api/users?token=secret',
        method: 'GET',
      });
      expect(body.instance).toBe('/api/users');
      expect(JSON.stringify(body)).not.toContain('secret');
    });

    it('generates urn:uuid for uuid strategy', () => {
      const factory = createFactory({ instanceStrategy: 'uuid' });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.instance).toMatch(
        /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('calls custom function with request and exception', () => {
      const customFn = vi.fn().mockReturnValue('custom-instance-id');
      const factory = createFactory({ instanceStrategy: customFn });
      const exception = new NotFoundException();
      const { body } = factory.create(exception, mockRequest);
      expect(body.instance).toBe('custom-instance-id');
      expect(customFn).toHaveBeenCalledWith(mockRequest, exception);
    });

    it('omits instance when custom function returns undefined', () => {
      const factory = createFactory({ instanceStrategy: () => undefined });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.instance).toBeUndefined();
    });
  });

  describe('exceptionMapper', () => {
    it('uses mapper result when it returns a ProblemDetail', () => {
      const factory = createFactory({
        exceptionMapper: (_exception) => ({
          type: 'https://example.com/custom',
          title: 'Custom Problem',
          status: 422,
          detail: 'Mapper handled this',
        }),
      });
      const { status, body } = factory.create(new BadRequestException(), mockRequest);
      expect(status).toBe(422);
      expect(body.type).toBe('https://example.com/custom');
      expect(body.title).toBe('Custom Problem');
      expect(body.detail).toBe('Mapper handled this');
    });

    it('falls through to next step when mapper returns null', () => {
      const factory = createFactory({
        exceptionMapper: () => null,
      });
      const { status, body } = factory.create(new NotFoundException('test'), mockRequest);
      expect(status).toBe(404);
      expect(body.title).toBe('Not Found');
    });

    it('handles partial mapper output without status — infers from exception', () => {
      const factory = createFactory({
        exceptionMapper: () => ({
          title: 'Partial Response',
          detail: 'No status provided',
        }),
      });
      const { status, body } = factory.create(new ForbiddenException(), mockRequest);
      expect(status).toBe(403);
      expect(body.status).toBe(403);
      expect(body.title).toBe('Partial Response');
    });

    it('does not mutate the object returned by the mapper', () => {
      const sharedResult = Object.freeze({
        type: 'https://example.com/shared',
        status: 422,
        title: 'Shared',
      });
      const factory = createFactory({
        exceptionMapper: () => sharedResult as any,
      });
      // Should not throw even though the returned object is frozen
      expect(() => factory.create(new BadRequestException(), mockRequest)).not.toThrow();
    });

    it('handles mapper with extension members', () => {
      const factory = createFactory({
        exceptionMapper: () => ({
          status: 409,
          title: 'Conflict',
          retryAfter: 30,
          conflictingResource: '/api/items/5',
        }),
      });
      const { body } = factory.create(new HttpException('conflict', 409), mockRequest);
      expect(body.retryAfter).toBe(30);
      expect(body.conflictingResource).toBe('/api/items/5');
    });

    it('falls back to 500 when mapper status is out of range and exception is not HttpException', () => {
      const factory = createFactory({
        catchAllExceptions: true,
        exceptionMapper: () => ({ title: 'Weird', status: 99 }),
      });
      const { status, body } = factory.create(new Error('boom'), mockRequest);
      expect(status).toBe(500);
      expect(body.status).toBe(500);
    });
  });

  describe('@ProblemType decorator resolution', () => {
    it('uses decorator metadata as template and fills detail from exception', () => {
      @ProblemType({
        type: 'https://example.com/insufficient-funds',
        title: 'Insufficient Funds',
        status: 422,
      })
      class InsufficientFundsException extends HttpException {
        constructor() {
          super('Balance too low', 422);
        }
      }

      const factory = createFactory();
      const { status, body } = factory.create(new InsufficientFundsException(), mockRequest);
      expect(status).toBe(422);
      expect(body.type).toBe('https://example.com/insufficient-funds');
      expect(body.title).toBe('Insufficient Funds');
      expect(body.detail).toBe('Balance too low');
    });

    it('inherits parent metadata when child is undecorated', () => {
      @ProblemType({ type: 'https://example.com/base-error', status: 400 })
      class BaseException extends HttpException {
        constructor(msg: string) {
          super(msg, 400);
        }
      }

      class SpecificException extends BaseException {
        constructor() {
          super('Specific error occurred');
        }
      }

      const factory = createFactory();
      const { body } = factory.create(new SpecificException(), mockRequest);
      expect(body.type).toBe('https://example.com/base-error');
      expect(body.detail).toBe('Specific error occurred');
    });

    it('child decorator fully overrides parent', () => {
      @ProblemType({ type: 'https://example.com/parent', title: 'Parent', status: 400 })
      class ParentException extends HttpException {
        constructor() {
          super('parent', 400);
        }
      }

      @ProblemType({ type: 'https://example.com/child', status: 422 })
      class ChildException extends ParentException {
        constructor() {
          super();
        }
      }

      const factory = createFactory();
      const { status, body } = factory.create(new ChildException(), mockRequest);
      expect(status).toBe(422);
      expect(body.type).toBe('https://example.com/child');
      expect(body.title).not.toBe('Parent');
    });

    it('decorated template with missing status infers from HttpException', () => {
      @ProblemType({ type: 'https://example.com/no-status', title: 'No Status' })
      class NoStatusException extends HttpException {
        constructor() {
          super('no status', 418);
        }
      }

      const factory = createFactory();
      const { status } = factory.create(new NoStatusException(), mockRequest);
      expect(status).toBe(418);
    });

    it('derives detail from message for @ProblemType-decorated plain Error', () => {
      @ProblemType({ type: 'https://example.com/db-error', title: 'DB Error', status: 503 })
      class DbError extends Error {
        constructor() {
          super('connection refused');
        }
      }
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create(new DbError(), mockRequest);
      expect(status).toBe(503);
      expect(body.detail).toBe('connection refused');
    });
  });

  describe('validation handling', () => {
    it('maps Tier 1 validation (flattened string array) to problem details', () => {
      const factory = createFactory();
      const exception = new BadRequestException({
        message: ['email must be an email', 'age must not be less than 0'],
        error: 'Bad Request',
      });
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(400);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Bad Request');
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toEqual(['email must be an email', 'age must not be less than 0']);
    });

    it('maps Tier 1 validation at a custom errorHttpStatusCode when declared in validationStatuses', () => {
      const factory = createFactory({ validationStatuses: [400, 422] });
      const exception = new UnprocessableEntityException({
        message: ['email must be an email'],
        error: 'Unprocessable Entity',
      });
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(422);
      expect(body.title).toBe('Unprocessable Entity');
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toEqual(['email must be an email']);
    });

    it('does not classify undeclared statuses as validation — messages survive in detail', () => {
      // Default validationStatuses is [400]: a 422 ValidationPipe shape falls
      // through to default HttpException handling with the messages joined.
      const factory = createFactory();
      const exception = new UnprocessableEntityException({
        message: ['email must be an email', 'age must not be less than 0'],
        error: 'Unprocessable Entity',
      });
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(422);
      expect(body.title).toBe('Unprocessable Entity');
      expect(body.detail).toBe('email must be an email; age must not be less than 0');
      expect(body.errors).toBeUndefined();
    });

    it('does not misclassify business 4xx array-constructor exceptions as validation', () => {
      // new ConflictException([...]) auto-produces { message: [...], error: 'Conflict' } —
      // the same shape as ValidationPipe output. The allow-list keeps it out of
      // validation handling (409 is not a declared validation status).
      const factory = createFactory({
        validationStatuses: [400, 422],
        validationExceptionMapper: (messages, _request, status) => ({
          status,
          title: 'Validation Failed',
          violations: messages,
        }),
      });
      const exception = new ConflictException(['order already shipped', 'cannot cancel']);
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(409);
      expect(body.title).toBe('Conflict');
      expect(body.detail).toBe('order already shipped; cannot cancel');
      expect(body.violations).toBeUndefined();
    });

    it('passes the detected status to validationExceptionMapper', () => {
      const mapper = vi.fn((messages: string[], _request: unknown, status: number) => ({
        status,
        title: 'Validation Failed',
        violations: messages,
      }));
      const factory = createFactory({
        validationStatuses: [400, 422],
        validationExceptionMapper: mapper,
      });
      const exception = new UnprocessableEntityException({
        message: ['email must be an email'],
        error: 'Unprocessable Entity',
      });
      const { status, body } = factory.create(exception, mockRequest);
      expect(mapper).toHaveBeenCalledWith(['email must be an email'], mockRequest, 422);
      expect(status).toBe(422);
      expect(body.violations).toEqual(['email must be an email']);
    });

    it('matches the status phrase case-insensitively (418 teapot casing)', () => {
      // Nest's phrase for 418 is "I'm a teapot" while Node's STATUS_CODES has
      // "I'm a Teapot" — detection must not be defeated by the casing mismatch.
      const factory = createFactory({ validationStatuses: [418] });
      const exception = new HttpException(
        { message: ['short and stout'], error: "I'm a teapot", statusCode: 418 },
        418,
      );
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(418);
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toEqual(['short and stout']);
    });

    it('maps Tier 2 validation (Rfc9457ValidationException) to structured output', () => {
      const factory = createFactory();
      const errors = [
        Object.assign(new ValidationError(), {
          property: 'email',
          constraints: { isEmail: 'email must be an email' },
        }),
        Object.assign(new ValidationError(), {
          property: 'age',
          constraints: { min: 'age must not be less than 0' },
        }),
      ];
      const exception = new Rfc9457ValidationException(errors);
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(400);
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toEqual([
        { property: 'email', constraints: { isEmail: 'email must be an email' } },
        { property: 'age', constraints: { min: 'age must not be less than 0' } },
      ]);
    });

    it('preserves nested children arrays in Tier 2 (not flattened to dotted paths)', () => {
      const factory = createFactory();
      const childError = Object.assign(new ValidationError(), {
        property: 'zip',
        constraints: { isPostalCode: 'zip must be a postal code' },
        children: [],
      });
      const parentError = Object.assign(new ValidationError(), {
        property: 'address',
        children: [childError],
      });
      const exception = new Rfc9457ValidationException([parentError]);
      const { body } = factory.create(exception, mockRequest);
      // Nested errors use children arrays, preserving the class-validator tree structure.
      // This is intentional: we do NOT flatten to dotted paths like "address.zip".
      expect(body.errors).toEqual([
        {
          property: 'address',
          children: [
            { property: 'zip', constraints: { isPostalCode: 'zip must be a postal code' } },
          ],
        },
      ]);
    });

    it('uses custom validationExceptionMapper for Tier 1', () => {
      const factory = createFactory({
        validationExceptionMapper: (messages) => ({
          status: 400,
          title: 'Validation Failed',
          detail: messages.join('; '),
        }),
      });
      const exception = new BadRequestException({
        message: ['field1 error', 'field2 error'],
        error: 'Bad Request',
      });
      const { body } = factory.create(exception, mockRequest);
      expect(body.title).toBe('Validation Failed');
      expect(body.detail).toBe('field1 error; field2 error');
      expect(body.errors).toBeUndefined();
    });

    it('does not misclassify business 400 with string array as validation', () => {
      const factory = createFactory();
      const exception = new BadRequestException({
        message: ['unsupported foo', 'unsupported bar'],
        // No error: 'Bad Request' field — this is a business error, not ValidationPipe output
      });
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(400);
      // Should NOT produce "Request validation failed" or an errors array
      expect(body.detail).not.toBe('Request validation failed');
      expect(body.errors).toBeUndefined();
    });

    it('exceptionMapper overrides Tier 2 validation', () => {
      const factory = createFactory({
        exceptionMapper: (exception) => {
          if (exception instanceof Rfc9457ValidationException) {
            return { status: 400, title: 'Mapper Wins', detail: 'Overridden' };
          }
          return null;
        },
      });
      const exception = new Rfc9457ValidationException([]);
      const { body } = factory.create(exception, mockRequest);
      expect(body.title).toBe('Mapper Wins');
    });

    it('does not mutate the object returned by validationExceptionMapper', () => {
      const shared = Object.freeze({ status: 400, title: 'Validation Failed' });
      const factory = createFactory({ validationExceptionMapper: () => shared as any });
      const exception = new BadRequestException({ message: ['x'], error: 'Bad Request' });
      expect(() => factory.create(exception, mockRequest)).not.toThrow();
    });
  });

  describe('Tier 2 malformed validation errors', () => {
    it('skips null, primitive, and string entries instead of crashing', () => {
      const factory = createFactory();
      const exception = new Rfc9457ValidationException([null, 42, 'oops', undefined]);
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(400);
      expect(body.errors).toEqual([]);
    });

    it('drops non-string constraint values and non-array children', () => {
      const factory = createFactory();
      const exception = new Rfc9457ValidationException([
        {
          property: 'email',
          constraints: { isEmail: 'must be an email', bogus: 123 },
          children: 'not-an-array',
        },
      ]);
      const { body } = factory.create(exception, mockRequest);
      expect(body.errors).toEqual([
        { property: 'email', constraints: { isEmail: 'must be an email' } },
      ]);
    });

    it('breaks cycles in children without infinite recursion', () => {
      const factory = createFactory();
      const cyclic: any = { property: 'a', constraints: { isDefined: 'a required' }, children: [] };
      cyclic.children.push(cyclic);
      const exception = new Rfc9457ValidationException([cyclic]);
      const { body } = factory.create(exception, mockRequest);
      expect(body.errors).toEqual([{ property: 'a', constraints: { isDefined: 'a required' } }]);
    });

    it('still flattens valid class-validator errors with nested children', () => {
      const factory = createFactory();
      const child = { property: 'street', constraints: { isString: 'street must be a string' } };
      const parent = { property: 'address', children: [child] };
      const exception = new Rfc9457ValidationException([parent]);
      const { body } = factory.create(exception, mockRequest);
      expect(body.errors).toEqual([
        {
          property: 'address',
          children: [{ property: 'street', constraints: { isString: 'street must be a string' } }],
        },
      ]);
    });
  });

  describe('edge-case branches', () => {
    it('works when constructed without options (default parameter)', () => {
      const factory = new ProblemDetailsFactory();
      const { status, body } = factory.create(new NotFoundException('gone'), mockRequest);
      expect(status).toBe(404);
      expect(body.type).toBe('about:blank');
      expect(body.detail).toBe('gone');
    });

    it('handles thrown objects with no constructor (null prototype)', () => {
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create(Object.create(null), mockRequest);
      expect(status).toBe(500);
      expect(body.title).toBe('Internal Server Error');
    });

    it('omits detail for a decorated plain Error with an empty message', () => {
      @ProblemType({ type: 'https://example.com/silent', title: 'Silent', status: 502 })
      class SilentError extends Error {
        constructor() {
          super('');
        }
      }
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create(new SilentError(), mockRequest);
      expect(status).toBe(502);
      expect(body.title).toBe('Silent');
      expect(body.detail).toBeUndefined();
    });

    it('omits detail for a decorated non-Error object', () => {
      @ProblemType({ type: 'https://example.com/weird', title: 'Weird', status: 500 })
      class WeirdThrowable {}
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create(new WeirdThrowable(), mockRequest);
      expect(status).toBe(500);
      expect(body.type).toBe('https://example.com/weird');
      expect(body.detail).toBeUndefined();
    });

    it('falls back to "Unknown Error" title for a non-standard HttpException status', () => {
      const factory = createFactory();
      const { status, body } = factory.create(new HttpException('odd', 599), mockRequest);
      expect(status).toBe(599);
      expect(body.title).toBe('Unknown Error');
      expect(body.detail).toBe('odd');
    });

    it('fills "Unknown Error" title and unknown-error slug when mapper returns a bare non-standard status', () => {
      const factory = createFactory({
        typeBaseUri: 'https://api.example.com/problems',
        exceptionMapper: () => ({ status: 599 }),
      });
      const { status, body } = factory.create(new NotFoundException(), mockRequest);
      expect(status).toBe(599);
      expect(body.title).toBe('Unknown Error');
      expect(body.type).toBe('https://api.example.com/problems/unknown-error');
    });

    it('omits instance for an unrecognized instanceStrategy value', () => {
      const factory = createFactory({ instanceStrategy: 'bogus' as any });
      const { body } = factory.create(new NotFoundException(), mockRequest);
      expect(body.instance).toBeUndefined();
    });

    it('omits detail when a string response equals the default status phrase', () => {
      const factory = createFactory();
      const { body } = factory.create(new HttpException('Forbidden', 403), mockRequest);
      expect(body.detail).toBeUndefined();
      expect(body.title).toBe('Forbidden');
    });

    it('omits detail for a null exception response', () => {
      const factory = createFactory();
      const { status, body } = factory.create(new HttpException(null as any, 400), mockRequest);
      expect(status).toBe(400);
      expect(body.detail).toBeUndefined();
    });
  });

  describe('unknown exception fallback', () => {
    it('produces generic 500 for non-HttpException (catch-all mode)', () => {
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create(new TypeError('Oops'), mockRequest);
      expect(status).toBe(500);
      expect(body.type).toBe('about:blank');
      expect(body.title).toBe('Internal Server Error');
      expect(body.detail).toBeUndefined();
      expect(body.instance).toBeUndefined();
    });

    it('does not leak stack trace or error message in catch-all fallback', () => {
      const factory = createFactory({ catchAllExceptions: true });
      const error = new Error('secret database password exposed');
      const { body } = factory.create(error, mockRequest);
      expect(JSON.stringify(body)).not.toContain('secret');
      expect(JSON.stringify(body)).not.toContain('password');
      expect(body.detail).toBeUndefined();
    });

    it('handles arbitrary object thrown', () => {
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create({ weird: 'object' }, mockRequest);
      expect(status).toBe(500);
      expect(body.title).toBe('Internal Server Error');
      expect(body.detail).toBeUndefined();
    });

    it('handles string thrown', () => {
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create('string error', mockRequest);
      expect(status).toBe(500);
      expect(body.title).toBe('Internal Server Error');
      expect(body.detail).toBeUndefined();
    });

    it('handles null thrown', () => {
      const factory = createFactory({ catchAllExceptions: true });
      const { status, body } = factory.create(null, mockRequest);
      expect(status).toBe(500);
      expect(body.title).toBe('Internal Server Error');
    });

    it('uses typeBaseUri slug for unknown exception in catch-all', () => {
      const factory = createFactory({
        catchAllExceptions: true,
        typeBaseUri: 'https://api.example.com/problems',
      });
      const { body } = factory.create(new Error('fail'), mockRequest);
      expect(body.type).toBe('https://api.example.com/problems/internal-server-error');
    });
  });

  describe('precedence order', () => {
    it('exceptionMapper wins over @ProblemType decorator', () => {
      @ProblemType({ type: 'https://example.com/decorated', status: 400 })
      class DecoratedException extends HttpException {
        constructor() {
          super('decorated', 400);
        }
      }

      const factory = createFactory({
        exceptionMapper: () => ({
          type: 'https://example.com/mapper-wins',
          status: 409,
          title: 'Mapper Priority',
        }),
      });
      const { status, body } = factory.create(new DecoratedException(), mockRequest);
      expect(status).toBe(409);
      expect(body.type).toBe('https://example.com/mapper-wins');
    });

    it('@ProblemType decorator wins over default HttpException mapping', () => {
      @ProblemType({ type: 'https://example.com/custom-404', title: 'Custom Not Found' })
      class CustomNotFoundException extends HttpException {
        constructor() {
          super('custom', 404);
        }
      }

      const factory = createFactory();
      const { body } = factory.create(new CustomNotFoundException(), mockRequest);
      expect(body.type).toBe('https://example.com/custom-404');
      expect(body.title).toBe('Custom Not Found');
    });

    it('@ProblemType decorator wins over validation handling', () => {
      @ProblemType({ type: 'https://example.com/custom-validation', status: 400 })
      class CustomValidationException extends BadRequestException {
        constructor() {
          super({ message: ['error1', 'error2'], error: 'Bad Request' });
        }
      }

      const factory = createFactory();
      const { body } = factory.create(new CustomValidationException(), mockRequest);
      expect(body.type).toBe('https://example.com/custom-validation');
      expect(body.errors).toBeUndefined();
    });
  });

  describe('callback containment', () => {
    let loggerErrorSpy: MockInstance;

    beforeEach(() => {
      loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      loggerErrorSpy.mockRestore();
    });

    it('create() falls through to standard resolution when exceptionMapper throws', () => {
      const factory = createFactory({
        exceptionMapper: () => {
          throw new Error('mapper bug');
        },
      });
      const { status, body } = factory.create(
        new NotFoundException('User 42 not found'),
        mockRequest,
      );
      expect(status).toBe(404);
      expect(body.detail).toBe('User 42 not found');
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('omits instance when a custom instanceStrategy throws', () => {
      const factory = createFactory({
        instanceStrategy: () => {
          throw new Error('strategy bug');
        },
      });
      const { status, body } = factory.create(new NotFoundException('nope'), mockRequest);
      expect(status).toBe(404);
      expect(body.instance).toBeUndefined();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('instanceStrategy'),
        expect.any(String),
      );
    });

    it('falls back to the default Tier 1 validation body when validationExceptionMapper throws', () => {
      const factory = createFactory({
        validationExceptionMapper: () => {
          throw new Error('validation mapper bug');
        },
      });
      // Simulate ValidationPipe default output: BadRequestException with
      // { message: string[], error: 'Bad Request' }.
      const exception = new BadRequestException(['email must be an email']);
      const { status, body } = factory.create(exception, mockRequest);
      expect(status).toBe(400);
      expect(body.detail).toBe('Request validation failed');
      expect(body.errors).toEqual(['email must be an email']);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('validationExceptionMapper'),
        expect.any(String),
      );
    });
  });
});
