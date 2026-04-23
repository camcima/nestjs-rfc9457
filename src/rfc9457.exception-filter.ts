import { ArgumentsHost, Catch, HttpException, Inject, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { ProblemDetailsFactory } from './problem-details.factory';
import { RFC9457_MODULE_OPTIONS, PROBLEM_CONTENT_TYPE } from './rfc9457.constants';
import { Rfc9457ModuleOptions } from './rfc9457.interfaces';

@Catch()
export class Rfc9457ExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(Rfc9457ExceptionFilter.name);

  constructor(
    private readonly factory: ProblemDetailsFactory,
    @Inject(RFC9457_MODULE_OPTIONS) private readonly options: Rfc9457ModuleOptions,
    private readonly adapterHost: HttpAdapterHost,
  ) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    // Only handle HTTP context — other transports (WS, RPC) delegate to Nest
    if (host.getType() !== 'http') {
      super.catch(exception, host);
      return;
    }

    const isHttpException = exception instanceof HttpException;

    // Run exceptionMapper first, before the HttpException gate.
    // This ensures custom mappers can handle non-HttpException types
    // (e.g., DatabaseException) even without catchAllExceptions.
    if (this.options.exceptionMapper) {
      const ctx = host.switchToHttp();
      const request = ctx.getRequest();
      const mapped = this.options.exceptionMapper(exception, request);
      if (mapped) {
        const response = ctx.getResponse();
        const { status, body } = this.factory.createFromMapped(mapped, exception, request);
        const httpAdapter = this.adapterHost.httpAdapter;
        httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
        httpAdapter.reply(response, body, status);
        return;
      }
    }

    // Non-HttpException without a matching mapper: delegate or catch-all
    if (!isHttpException && !this.options.catchAllExceptions) {
      super.catch(exception, host);
      return;
    }

    // A non-HttpException reached the catch-all branch, meaning the app didn't
    // model it as an HttpException and the exceptionMapper didn't recognise it
    // either. That's almost always a bug in the handler — log it at `error`
    // level before rendering the generic 500 so the stack trace shows up in
    // server logs. Without this, unknown exceptions get silently flattened
    // into a bland problem-details body with no trail, hiding real bugs.
    //
    // Consumers that want to redirect this logging can call `app.useLogger()`
    // to swap NestJS's default logger (e.g. for pino). The context name is
    // `Rfc9457ExceptionFilter` so it can be filtered or silenced selectively.
    if (!isHttpException) {
      if (this.options.onUnhandled) {
        const ctx = host.switchToHttp();
        this.options.onUnhandled(exception, ctx.getRequest());
      } else if (exception instanceof Error) {
        this.logger.error(exception.stack ?? exception.message, 'Unhandled non-HTTP exception');
      } else {
        this.logger.error({ exception }, 'Unhandled non-HTTP exception (non-Error value thrown)');
      }
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    // skipMapper: the filter already ran the mapper above and it returned null
    const { status, body } = this.factory.create(exception, request, { skipMapper: true });
    const httpAdapter = this.adapterHost.httpAdapter;
    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
    httpAdapter.reply(response, body, status);
  }
}
