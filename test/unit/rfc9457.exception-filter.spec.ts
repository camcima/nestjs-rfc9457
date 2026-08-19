import { ArgumentsHost, HttpException, Logger, NotFoundException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Rfc9457ExceptionFilter } from '../../src/rfc9457.exception-filter';
import { ProblemDetailsFactory } from '../../src/problem-details.factory';
import { Rfc9457ModuleOptions } from '../../src/rfc9457.interfaces';
import { ProblemDetailException } from '../../src/problem-detail.exception';
import { ProblemType } from '../../src/problem-type.decorator';
import type { MockInstance } from 'vitest';

function createMocks(options: Rfc9457ModuleOptions = {}) {
  const mockResponse = {};
  const mockRequest = { url: '/test', method: 'GET' };

  const mockHttpAdapter = {
    setHeader: vi.fn(),
    reply: vi.fn(),
    isHeadersSent: vi.fn().mockReturnValue(false),
    end: vi.fn(),
  };

  const adapterHost = { httpAdapter: mockHttpAdapter } as unknown as HttpAdapterHost;
  const factory = new ProblemDetailsFactory(options);
  const filter = new Rfc9457ExceptionFilter(factory, options, adapterHost);

  const mockHost = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => mockRequest,
      getResponse: () => mockResponse,
    }),
  } as unknown as ArgumentsHost;

  return { filter, mockHost, mockHttpAdapter, mockResponse, mockRequest };
}

describe('Rfc9457ExceptionFilter', () => {
  it('writes problem details response for HttpException', () => {
    const { filter, mockHost, mockHttpAdapter, mockResponse } = createMocks();
    filter.catch(new NotFoundException('Not here'), mockHost);
    expect(mockHttpAdapter.setHeader).toHaveBeenCalledWith(
      mockResponse,
      'Content-Type',
      'application/problem+json',
    );
    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Not here',
      }),
      404,
    );
  });

  it('delegates to super.catch() for non-HttpException when catchAllExceptions is false and no mapper', () => {
    const { filter, mockHost, mockHttpAdapter } = createMocks({ catchAllExceptions: false });
    try {
      filter.catch(new TypeError('unexpected'), mockHost);
    } catch {
      // Expected: BaseExceptionFilter.catch fails in test environment
    }
    expect(mockHttpAdapter.reply).not.toHaveBeenCalled();
  });

  it('handles non-HttpException when catchAllExceptions is true', () => {
    const { filter, mockHost, mockHttpAdapter, mockResponse } = createMocks({
      catchAllExceptions: true,
    });
    filter.catch(new TypeError('unexpected'), mockHost);
    expect(mockHttpAdapter.setHeader).toHaveBeenCalledWith(
      mockResponse,
      'Content-Type',
      'application/problem+json',
    );
    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
      }),
      500,
    );
  });

  it('response body does not contain stack trace for catch-all exceptions', () => {
    const { filter, mockHost, mockHttpAdapter } = createMocks({ catchAllExceptions: true });
    filter.catch(new Error('secret info'), mockHost);
    const responseBody = mockHttpAdapter.reply.mock.calls[0][1];
    expect(JSON.stringify(responseBody)).not.toContain('secret');
    expect(responseBody.detail).toBeUndefined();
  });

  it('exceptionMapper handles non-HttpException even without catchAllExceptions', () => {
    class DatabaseException extends Error {
      constructor() {
        super('connection refused');
      }
    }

    const { filter, mockHost, mockHttpAdapter, mockResponse } = createMocks({
      catchAllExceptions: false,
      exceptionMapper: (exception) => {
        if (exception instanceof DatabaseException) {
          return { type: 'https://example.com/db-error', status: 503, title: 'Database Error' };
        }
        return null;
      },
    });
    filter.catch(new DatabaseException(), mockHost);
    expect(mockHttpAdapter.setHeader).toHaveBeenCalledWith(
      mockResponse,
      'Content-Type',
      'application/problem+json',
    );
    expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
      mockResponse,
      expect.objectContaining({
        type: 'https://example.com/db-error',
        status: 503,
        title: 'Database Error',
      }),
      503,
    );
  });

  it('non-HttpException delegates to super when mapper returns null and catchAllExceptions is false', () => {
    const { filter, mockHost, mockHttpAdapter } = createMocks({
      catchAllExceptions: false,
      exceptionMapper: () => null,
    });
    try {
      filter.catch(new TypeError('unexpected'), mockHost);
    } catch {
      // Expected: BaseExceptionFilter.catch fails in test environment
    }
    expect(mockHttpAdapter.reply).not.toHaveBeenCalled();
  });

  it('rethrows for non-http context so Nest handles WS/RPC exceptions', () => {
    const { filter, mockHttpAdapter } = createMocks();
    const wsHost = {
      getType: () => 'ws',
      switchToHttp: () => {
        throw new Error('should not be called');
      },
    } as unknown as ArgumentsHost;
    const original = new NotFoundException();
    expect(() => filter.catch(original, wsHost)).toThrow(original);
    expect(mockHttpAdapter.reply).not.toHaveBeenCalled();
  });

  describe('exceptionMapper containment', () => {
    let loggerErrorSpy: MockInstance;

    beforeEach(() => {
      loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      loggerErrorSpy.mockRestore();
    });

    it('falls back to standard HttpException resolution when the mapper throws', () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks({
        exceptionMapper: () => {
          throw new Error('mapper bug');
        },
      });
      filter.catch(new NotFoundException('Not here'), mockHost);
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 404, title: 'Not Found', detail: 'Not here' }),
        404,
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceptionMapper threw'),
        expect.any(String),
      );
    });

    it('never includes mapper error text in the response body', () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks({
        catchAllExceptions: true,
        exceptionMapper: () => {
          throw new Error('secret-mapper-internals');
        },
      });
      filter.catch(new TypeError('boom'), mockHost);
      const responseBody = mockHttpAdapter.reply.mock.calls[0][1];
      expect(JSON.stringify(responseBody)).not.toContain('secret-mapper-internals');
    });

    it('logs with an undefined trace slot when the mapper throws a non-Error value', () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks({
        exceptionMapper: () => {
          throw 'string bug';
        },
      });
      filter.catch(new NotFoundException('Not here'), mockHost);
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 404 }),
        404,
      );
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceptionMapper threw'),
        undefined,
      );
    });

    it('delegates to super.catch when the mapper throws for a non-HttpException without catchAllExceptions', () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks({
        catchAllExceptions: false,
        exceptionMapper: () => {
          throw new Error('mapper bug');
        },
      });
      try {
        filter.catch(new TypeError('unexpected'), mockHost);
      } catch {
        // Expected: BaseExceptionFilter.catch fails in test environment
      }
      expect(mockHttpAdapter.reply).not.toHaveBeenCalled();
    });
  });

  describe('unhandled exception observability', () => {
    let loggerErrorSpy: MockInstance;

    beforeEach(() => {
      loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      loggerErrorSpy.mockRestore();
    });

    it('logs message with stack when a non-HttpException falls through with catchAllExceptions', () => {
      const { filter, mockHost } = createMocks({ catchAllExceptions: true });
      const err = new TypeError('kaboom');
      filter.catch(err, mockHost);
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      const [message, stack] = loggerErrorSpy.mock.calls[0];
      expect(message).toBe('Unhandled non-HTTP exception: kaboom');
      expect(typeof stack).toBe('string');
      expect(stack).toContain('TypeError: kaboom');
    });

    it('passes undefined stack when an Error has no stack', () => {
      const { filter, mockHost } = createMocks({ catchAllExceptions: true });
      const err = new Error('no-stack');
      err.stack = undefined;
      filter.catch(err, mockHost);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Unhandled non-HTTP exception: no-stack',
        undefined,
      );
    });

    it('logs non-Error thrown values wrapped in a structured context object', () => {
      const { filter, mockHost } = createMocks({ catchAllExceptions: true });
      filter.catch({ oddity: true, value: 42 }, mockHost);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Unhandled non-HTTP exception (non-Error value thrown)',
        { exception: { oddity: true, value: 42 } },
      );
    });

    it('does NOT log when an HttpException falls through (those are expected)', () => {
      const { filter, mockHost } = createMocks({ catchAllExceptions: true });
      filter.catch(new NotFoundException('nope'), mockHost);
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('does NOT log when the exceptionMapper successfully maps the exception', () => {
      class DbDown extends Error {}
      const { filter, mockHost } = createMocks({
        catchAllExceptions: true,
        exceptionMapper: (ex) =>
          ex instanceof DbDown
            ? { type: 'https://example.com/db', status: 503, title: 'DB down' }
            : null,
      });
      filter.catch(new DbDown(), mockHost);
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('defers to onUnhandled callback when provided (no default log)', () => {
      const onUnhandled = vi.fn();
      const { filter, mockHost, mockRequest } = createMocks({
        catchAllExceptions: true,
        onUnhandled,
      });
      const err = new TypeError('custom sink');
      filter.catch(err, mockHost);

      expect(onUnhandled).toHaveBeenCalledTimes(1);
      expect(onUnhandled).toHaveBeenCalledWith(
        err,
        mockRequest,
        expect.objectContaining({ status: 500, title: 'Internal Server Error' }),
      );
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('onUnhandled does not prevent the generic problem-details response', () => {
      const onUnhandled = vi.fn();
      const { filter, mockHost, mockHttpAdapter } = createMocks({
        catchAllExceptions: true,
        onUnhandled,
      });
      filter.catch(new TypeError('still renders'), mockHost);
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 500, title: 'Internal Server Error' }),
        500,
      );
    });

    it('still sends the generic 500 when onUnhandled throws', () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks({
        catchAllExceptions: true,
        onUnhandled: () => {
          throw new Error('sentry is down');
        },
      });
      filter.catch(new TypeError('original failure'), mockHost);
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 500, title: 'Internal Server Error' }),
        500,
      );
    });

    it('logs both the callback failure and the original exception when onUnhandled throws', () => {
      const { filter, mockHost } = createMocks({
        catchAllExceptions: true,
        onUnhandled: () => {
          throw new Error('sentry is down');
        },
      });
      filter.catch(new TypeError('original failure'), mockHost);
      const messages = loggerErrorSpy.mock.calls.map((call) => call[0]);
      expect(messages).toContainEqual(expect.stringContaining('onUnhandled callback threw'));
      expect(messages).toContainEqual(expect.stringContaining('original failure'));
    });

    it('logs with an undefined trace slot when onUnhandled throws a non-Error value', () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks({
        catchAllExceptions: true,
        onUnhandled: () => {
          throw 'string failure';
        },
      });
      filter.catch(new TypeError('original failure'), mockHost);
      expect(mockHttpAdapter.reply).toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('onUnhandled callback threw'),
        undefined,
      );
    });

    it('contains an async onUnhandled rejection with a non-Error reason', async () => {
      const { filter, mockHost } = createMocks({
        catchAllExceptions: true,
        onUnhandled: (() => Promise.reject('string rejection')) as unknown as (
          exception: unknown,
          request: any,
        ) => void,
      });
      filter.catch(new TypeError('original failure'), mockHost);
      await new Promise((r) => setImmediate(r));
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('onUnhandled callback rejected'),
        undefined,
      );
    });

    it('contains a rejected promise from an async onUnhandled callback without crashing', async () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks({
        catchAllExceptions: true,
        onUnhandled: (async () => {
          throw new Error('async sink failure');
        }) as unknown as (exception: unknown, request: any) => void,
      });
      filter.catch(new TypeError('original failure'), mockHost);
      // The reply must be sent synchronously, before the rejected promise
      // has a chance to settle.
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 500, title: 'Internal Server Error' }),
        500,
      );

      // Let the rejected promise's .catch() handler run.
      await new Promise((r) => setImmediate(r));

      const messages = loggerErrorSpy.mock.calls.map((call) => call[0]);
      expect(messages).toContainEqual(expect.stringContaining('onUnhandled callback rejected'));
      expect(messages).toContainEqual(expect.stringContaining('original failure'));
    });

    it('never includes onUnhandled callback error text in the response body', () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks({
        catchAllExceptions: true,
        onUnhandled: () => {
          throw new Error('secret-sink-credentials');
        },
      });
      filter.catch(new TypeError('original failure'), mockHost);
      const responseBody = mockHttpAdapter.reply.mock.calls[0][1];
      expect(JSON.stringify(responseBody)).not.toContain('secret-sink-credentials');
    });
  });
});

describe('committed response guard', () => {
  let loggerErrorSpy: MockInstance;

  beforeEach(() => {
    loggerErrorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('ends the response without writing when headers are already sent', () => {
    const { filter, mockHost, mockHttpAdapter, mockResponse } = createMocks();
    mockHttpAdapter.isHeadersSent.mockReturnValue(true);
    filter.catch(new NotFoundException('too late'), mockHost);
    expect(mockHttpAdapter.setHeader).not.toHaveBeenCalled();
    expect(mockHttpAdapter.reply).not.toHaveBeenCalled();
    expect(mockHttpAdapter.end).toHaveBeenCalledWith(mockResponse);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('headers already sent'),
      expect.any(String),
    );
  });

  it('guards the mapper path too', () => {
    const { filter, mockHost, mockHttpAdapter } = createMocks({
      exceptionMapper: () => ({ status: 503, title: 'Down' }),
    });
    mockHttpAdapter.isHeadersSent.mockReturnValue(true);
    filter.catch(new Error('mapped but committed'), mockHost);
    expect(mockHttpAdapter.reply).not.toHaveBeenCalled();
    expect(mockHttpAdapter.end).toHaveBeenCalled();
  });

  it('stringifies non-Error exceptions in the committed-response log', () => {
    const { filter, mockHost, mockHttpAdapter, mockResponse } = createMocks({
      catchAllExceptions: true,
    });
    mockHttpAdapter.isHeadersSent.mockReturnValue(true);
    filter.catch({ weird: true }, mockHost);
    expect(mockHttpAdapter.end).toHaveBeenCalledWith(mockResponse);
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('headers already sent'),
      '[object Object]',
    );
  });
  describe('non-error HttpException statuses', () => {
    it('delegates a 3xx HttpException to NestJS instead of emitting problem+json', () => {
      // RFC 9457 s3 scopes problem documents to error responses. A 302 carrying
      // application/problem+json would be non-conformant, so Nest's default
      // handler sends its standard body at the requested status instead.
      const { filter, mockHost, mockHttpAdapter } = createMocks();
      try {
        filter.catch(new HttpException('moved', 302), mockHost);
      } catch {
        // Expected: BaseExceptionFilter.catch fails in this test environment
      }
      expect(mockHttpAdapter.reply).not.toHaveBeenCalled();
      expect(mockHttpAdapter.setHeader).not.toHaveBeenCalled();
    });

    it('delegates a 2xx HttpException as well', () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks();
      try {
        filter.catch(new HttpException('fine', 200), mockHost);
      } catch {
        // Expected in this test environment
      }
      expect(mockHttpAdapter.reply).not.toHaveBeenCalled();
    });

    it('still lets an exceptionMapper claim a non-error HttpException', () => {
      const { filter, mockHost, mockHttpAdapter, mockResponse } = createMocks({
        exceptionMapper: () => ({ status: 410, title: 'Gone for good' }),
      });
      filter.catch(new HttpException('moved', 302), mockHost);
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
        mockResponse,
        expect.objectContaining({ status: 410, title: 'Gone for good' }),
        410,
      );
    });

    it('handles 4xx and 5xx HttpExceptions normally', () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks();
      filter.catch(new HttpException('teapot', 418), mockHost);
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(expect.anything(), expect.anything(), 418);
    });
  });

  describe('@ProblemType() on a delegated non-HttpException', () => {
    let loggerWarnSpy: MockInstance;

    beforeEach(() => {
      loggerWarnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      loggerWarnSpy.mockRestore();
    });

    it('warns that the decorator metadata was ignored', () => {
      @ProblemType({ type: 'https://example.com/problems/domain', status: 409 })
      class DomainError extends Error {}

      const { filter, mockHost } = createMocks({ catchAllExceptions: false });
      try {
        filter.catch(new DomainError('nope'), mockHost);
      } catch {
        // Expected: BaseExceptionFilter.catch fails in this test environment
      }
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DomainError carries @ProblemType() metadata'),
      );
    });

    it('warns only once per exception class', () => {
      @ProblemType({ status: 409 })
      class RepeatedError extends Error {}

      const { filter, mockHost } = createMocks({ catchAllExceptions: false });
      for (let i = 0; i < 3; i++) {
        try {
          filter.catch(new RepeatedError('again'), mockHost);
        } catch {
          // Expected in this test environment
        }
      }
      expect(loggerWarnSpy).toHaveBeenCalledTimes(1);
    });

    it('stays silent for an undecorated exception', () => {
      const { filter, mockHost } = createMocks({ catchAllExceptions: false });
      try {
        filter.catch(new Error('plain'), mockHost);
      } catch {
        // Expected in this test environment
      }
      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });

    it('stays silent when catchAllExceptions handles the exception anyway', () => {
      @ProblemType({ status: 409 })
      class HandledError extends Error {}

      const { filter, mockHost } = createMocks({ catchAllExceptions: true });
      filter.catch(new HandledError('handled'), mockHost);
      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('response headers', () => {
    it('sends headers carried by a ProblemDetailException', () => {
      const { filter, mockHost, mockHttpAdapter, mockResponse } = createMocks();
      filter.catch(
        new ProblemDetailException(
          { status: 429, title: 'Too Many Requests' },
          {
            headers: { 'Retry-After': '60' },
          },
        ),
        mockHost,
      );
      expect(mockHttpAdapter.setHeader).toHaveBeenCalledWith(mockResponse, 'Retry-After', '60');
      expect(mockHttpAdapter.reply).toHaveBeenCalledWith(expect.anything(), expect.anything(), 429);
    });

    it('applies the responseHeaders callback', () => {
      const { filter, mockHost, mockHttpAdapter, mockResponse, mockRequest } = createMocks({
        responseHeaders: (problem) =>
          problem.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : undefined,
      });
      filter.catch(new HttpException('nope', 401), mockHost);
      expect(mockHttpAdapter.setHeader).toHaveBeenCalledWith(
        mockResponse,
        'WWW-Authenticate',
        'Bearer',
      );
      expect(mockRequest).toBeDefined();
    });

    it('passes the resolved problem, exception and request to responseHeaders', () => {
      const responseHeaders = vi.fn().mockReturnValue(undefined);
      const { filter, mockHost, mockRequest } = createMocks({ responseHeaders });
      const exception = new NotFoundException('gone');
      filter.catch(exception, mockHost);
      expect(responseHeaders).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404, title: 'Not Found' }),
        exception,
        mockRequest,
      );
    });

    it('lets responseHeaders override a throw-site header', () => {
      const { filter, mockHost, mockHttpAdapter, mockResponse } = createMocks({
        responseHeaders: () => ({ 'Retry-After': '120' }),
      });
      filter.catch(
        new ProblemDetailException({ status: 429 }, { headers: { 'Retry-After': '60' } }),
        mockHost,
      );
      const retryAfterCalls = mockHttpAdapter.setHeader.mock.calls.filter(
        (call: unknown[]) => call[1] === 'Retry-After',
      );
      expect(retryAfterCalls).toEqual([[mockResponse, 'Retry-After', '120']]);
    });

    it('keeps Content-Type reserved even when a callback tries to replace it', () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks({
        responseHeaders: () => ({ 'Content-Type': 'text/plain' }),
      });
      filter.catch(new NotFoundException('gone'), mockHost);
      const calls = mockHttpAdapter.setHeader.mock.calls;
      const last = calls[calls.length - 1];
      expect(last[1]).toBe('Content-Type');
      expect(last[2]).toBe('application/problem+json');
    });

    it('still sends the response when responseHeaders throws', () => {
      const loggerErrorSpy = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      try {
        const { filter, mockHost, mockHttpAdapter } = createMocks({
          responseHeaders: () => {
            throw new Error('header sink exploded');
          },
        });
        filter.catch(new NotFoundException('gone'), mockHost);
        expect(mockHttpAdapter.reply).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          404,
        );
        expect(loggerErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('responseHeaders threw'),
          expect.any(String),
        );
      } finally {
        loggerErrorSpy.mockRestore();
      }
    });

    it('does not set headers when the response is already committed', () => {
      const { filter, mockHost, mockHttpAdapter } = createMocks({
        responseHeaders: () => ({ 'Retry-After': '60' }),
      });
      mockHttpAdapter.isHeadersSent.mockReturnValue(true);
      filter.catch(new NotFoundException('gone'), mockHost);
      expect(mockHttpAdapter.setHeader).not.toHaveBeenCalled();
      expect(mockHttpAdapter.end).toHaveBeenCalled();
    });
  });

  describe('unhandled exception observability: instance correlation', () => {
    it('includes the generated instance in the default log line', () => {
      const loggerErrorSpy = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      try {
        const { filter, mockHost } = createMocks({
          catchAllExceptions: true,
          instanceStrategy: 'uuid',
        });
        filter.catch(new TypeError('correlate me'), mockHost);
        const [message] = loggerErrorSpy.mock.calls[0];
        expect(message).toMatch(
          /^Unhandled non-HTTP exception: correlate me \[instance: urn:uuid:/,
        );
      } finally {
        loggerErrorSpy.mockRestore();
      }
    });

    it('includes the instance for non-Error thrown values too', () => {
      const loggerErrorSpy = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      try {
        const { filter, mockHost } = createMocks({
          catchAllExceptions: true,
          instanceStrategy: 'uuid',
        });
        filter.catch('a string', mockHost);
        const [message] = loggerErrorSpy.mock.calls[0];
        expect(message).toContain('[instance: urn:uuid:');
      } finally {
        loggerErrorSpy.mockRestore();
      }
    });
  });
});
