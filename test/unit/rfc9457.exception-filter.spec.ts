import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Rfc9457ExceptionFilter } from '../../src/rfc9457.exception-filter';
import { ProblemDetailsFactory } from '../../src/problem-details.factory';
import { Rfc9457ModuleOptions } from '../../src/rfc9457.interfaces';

function createMocks(options: Rfc9457ModuleOptions = {}) {
  const mockResponse = {};
  const mockRequest = { url: '/test', method: 'GET' };

  const mockHttpAdapter = {
    setHeader: jest.fn(),
    reply: jest.fn(),
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

  it('delegates to super.catch() for non-HttpException when catchAllExceptions is false', () => {
    const { filter, mockHost, mockHttpAdapter } = createMocks({ catchAllExceptions: false });
    // BaseExceptionFilter.catch will throw because there is no real HTTP adapter,
    // but we can verify that our filter does NOT call reply.
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
});
