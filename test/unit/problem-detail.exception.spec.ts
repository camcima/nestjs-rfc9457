import 'reflect-metadata';
import { HttpException, Logger } from '@nestjs/common';
import { ProblemDetailException } from '../../src/problem-detail.exception';
import { ProblemDetailsFactory } from '../../src/problem-details.factory';
import { ProblemType } from '../../src/problem-type.decorator';
import { Rfc9457ModuleOptions, Rfc9457Request } from '../../src/rfc9457.interfaces';

function createFactory(options: Rfc9457ModuleOptions = {}): ProblemDetailsFactory {
  return new ProblemDetailsFactory(options);
}

const mockRequest: Rfc9457Request = { url: '/api/transfers', method: 'POST' };

describe('ProblemDetailException', () => {
  describe('construction', () => {
    it('is an HttpException carrying the supplied status', () => {
      const exception = new ProblemDetailException({ status: 402, title: 'Payment Required' });
      expect(exception).toBeInstanceOf(HttpException);
      expect(exception.getStatus()).toBe(402);
    });

    it('exposes the problem document via getResponse()', () => {
      const exception = new ProblemDetailException({ status: 402, balance: 30 });
      expect(exception.getResponse()).toEqual({ status: 402, balance: 30 });
    });

    it('rejects a non-error status', () => {
      expect(() => new ProblemDetailException({ status: 200 })).toThrow(RangeError);
      expect(() => new ProblemDetailException({ status: 302 })).toThrow(RangeError);
      expect(() => new ProblemDetailException({ status: 600 })).toThrow(RangeError);
    });

    it('rejects NaN and non-integer statuses', () => {
      expect(() => new ProblemDetailException({ status: NaN })).toThrow(RangeError);
      expect(() => new ProblemDetailException({ status: 404.5 })).toThrow(RangeError);
    });

    it('rejects a missing status', () => {
      expect(
        () => new ProblemDetailException({ title: 'No status' } as unknown as { status: number }),
      ).toThrow(RangeError);
    });

    it('copies the problem defensively so post-throw mutation cannot alter it', () => {
      const problem = { status: 402, balance: 30 };
      const exception = new ProblemDetailException(problem);
      problem.balance = 999;
      expect(exception.problem.balance).toBe(30);
    });

    it('copies supplied headers defensively', () => {
      const headers = { 'Retry-After': '60' };
      const exception = new ProblemDetailException({ status: 429 }, { headers });
      headers['Retry-After'] = '1';
      expect(exception.headers).toEqual({ 'Retry-After': '60' });
    });

    it('leaves headers undefined when none are supplied', () => {
      expect(new ProblemDetailException({ status: 429 }).headers).toBeUndefined();
    });
  });

  describe('factory resolution', () => {
    it('carries extension members through to the response body', () => {
      const factory = createFactory();
      const { status, body } = factory.create(
        new ProblemDetailException({
          type: 'https://api.example.com/problems/insufficient-funds',
          title: 'Insufficient Funds',
          status: 402,
          detail: 'Your balance is too low to cover this transfer.',
          balance: 30,
          cost: 50,
        }),
        mockRequest,
      );
      expect(status).toBe(402);
      expect(body).toEqual({
        type: 'https://api.example.com/problems/insufficient-funds',
        title: 'Insufficient Funds',
        status: 402,
        detail: 'Your balance is too low to cover this transfer.',
        balance: 30,
        cost: 50,
      });
    });

    it('still normalizes type, title and instance', () => {
      const factory = createFactory({
        typeBaseUri: 'https://api.example.com/problems',
        instanceStrategy: 'request-uri',
      });
      const { body } = factory.create(
        new ProblemDetailException({ status: 409, type: 'duplicate-transfer', ref: 'abc' }),
        mockRequest,
      );
      expect(body.type).toBe('https://api.example.com/problems/duplicate-transfer');
      // title filled from the status phrase
      expect(body.title).toBe('Conflict');
      expect(body.instance).toBe('/api/transfers');
      expect(body.ref).toBe('abc');
    });

    it('merges over @ProblemType() metadata, with instance members winning', () => {
      @ProblemType({
        type: 'https://api.example.com/problems/payment-error',
        title: 'Payment Error',
        status: 402,
      })
      class PaymentProblem extends ProblemDetailException {}

      const factory = createFactory();
      const { status, body } = factory.create(
        new PaymentProblem({ status: 409, detail: 'Already settled', settledAt: 'yesterday' }),
        mockRequest,
      );
      // Decorator supplies the reusable identity; the instance overrides status
      // and adds occurrence data.
      expect(body.type).toBe('https://api.example.com/problems/payment-error');
      expect(body.title).toBe('Payment Error');
      expect(status).toBe(409);
      expect(body.status).toBe(409);
      expect(body.detail).toBe('Already settled');
      expect(body.settledAt).toBe('yesterday');
    });

    it('loses to an exceptionMapper that claims the exception', () => {
      const factory = createFactory({
        exceptionMapper: () => ({ status: 418, title: 'Mapper wins' }),
      });
      const { status, body } = factory.create(
        new ProblemDetailException({ status: 402, balance: 30 }),
        mockRequest,
      );
      expect(status).toBe(418);
      expect(body.title).toBe('Mapper wins');
      expect(body.balance).toBeUndefined();
    });

    it('has its detail stripped by suppress5xxDetail on a 5xx', () => {
      const factory = createFactory({ suppress5xxDetail: true });
      const { body } = factory.create(
        new ProblemDetailException({ status: 503, detail: 'shard 4 is down', shard: 4 }),
        mockRequest,
      );
      expect(body.detail).toBeUndefined();
      // Extension members are not touched — suppress5xxDetail is scoped to `detail`.
      expect(body.shard).toBe(4);
    });

    it('does not mutate the exception when the response body is normalized', () => {
      const factory = createFactory({ instanceStrategy: 'uuid' });
      const exception = new ProblemDetailException({ status: 402, balance: 30 });
      const { body } = factory.create(exception, mockRequest);
      expect(body.instance).toMatch(/^urn:uuid:/);
      expect(exception.problem.instance).toBeUndefined();
      expect(exception.problem.type).toBeUndefined();
    });

    it('emits no status warning for a valid problem', () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      try {
        const factory = createFactory();
        factory.create(new ProblemDetailException({ status: 402 }), mockRequest);
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
