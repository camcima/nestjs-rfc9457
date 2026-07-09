import { ArgumentsHost, Catch, HttpException, Inject, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { ProblemDetailsFactory } from './problem-details.factory';
import { RFC9457_MODULE_OPTIONS, PROBLEM_CONTENT_TYPE } from './rfc9457.constants';
import { ProblemDetail, Rfc9457ModuleOptions } from './rfc9457.interfaces';

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
    // Only handle HTTP context. For other transports we rethrow rather than
    // calling super.catch(): BaseExceptionFilter is HTTP-adapter based and
    // would try to write an HTTP reply to a non-HTTP context, corrupting the
    // transport. Note the rethrow propagates OUT of Nest's exception-handler
    // invocation for that transport — it does not re-enter the WS/RPC default
    // handlers. Hybrid apps (gateways, microservices) should bind their own
    // transport-scoped exception filters rather than relying on this
    // catch-all filter. (GraphQL contexts are fine: the GraphQL driver
    // formats thrown resolver errors itself.)
    if (host.getType() !== 'http') {
      throw exception;
    }

    const isHttpException = exception instanceof HttpException;

    // Run exceptionMapper first, before the HttpException gate.
    // This ensures custom mappers can handle non-HttpException types
    // (e.g., DatabaseException) even without catchAllExceptions.
    if (this.options.exceptionMapper) {
      const ctx = host.switchToHttp();
      const request = ctx.getRequest();
      let mapped: ProblemDetail | null = null;
      try {
        mapped = this.options.exceptionMapper(exception, request);
      } catch (mapperError) {
        // A throwing mapper is an application bug, but the error path must
        // stay total: log it and continue with standard resolution.
        this.logger.error(
          'exceptionMapper threw while mapping an exception; continuing with standard resolution',
          mapperError instanceof Error ? mapperError.stack : undefined,
        );
      }
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
        try {
          this.options.onUnhandled(exception, ctx.getRequest());
        } catch (callbackError) {
          // onUnhandled is observability-only: its failure must never replace
          // the response. Log the callback failure AND the original exception
          // so neither trail is lost.
          this.logger.error(
            'onUnhandled callback threw; falling back to default logging',
            callbackError instanceof Error ? callbackError.stack : undefined,
          );
          this.logOriginal(exception);
        }
      } else {
        this.logOriginal(exception);
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

  private logOriginal(exception: unknown): void {
    if (exception instanceof Error) {
      // Pass stack as 2nd arg so NestJS routes it through its stack-trace
      // slot while preserving the constructor's context (`Rfc9457ExceptionFilter`).
      this.logger.error(`Unhandled non-HTTP exception: ${exception.message}`, exception.stack);
    } else {
      this.logger.error('Unhandled non-HTTP exception (non-Error value thrown)', { exception });
    }
  }
}
