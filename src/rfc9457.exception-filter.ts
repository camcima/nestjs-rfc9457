import { ArgumentsHost, Catch, Inject } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { ProblemDetailsFactory } from './problem-details.factory';
import { RFC9457_MODULE_OPTIONS, PROBLEM_CONTENT_TYPE } from './rfc9457.constants';
import { Rfc9457ModuleOptions } from './rfc9457.interfaces';

@Catch()
export class Rfc9457ExceptionFilter extends BaseExceptionFilter {
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

    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    // Let the factory try to resolve the exception through the full pipeline
    // (mapper → decorator → validation → HttpException default).
    // Returns null when no step matched.
    const factoryResult = this.factory.create(exception, request);

    if (factoryResult) {
      const response = ctx.getResponse();
      const httpAdapter = this.adapterHost.httpAdapter;
      httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
      httpAdapter.reply(response, factoryResult.body, factoryResult.status);
      return;
    }

    // No resolution step matched. For non-HttpExceptions in catch-all mode,
    // produce a generic 500 problem details response.
    if (this.options.catchAllExceptions) {
      const response = ctx.getResponse();
      const httpAdapter = this.adapterHost.httpAdapter;
      const body = {
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
      };
      httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
      httpAdapter.reply(response, body, 500);
      return;
    }

    // Nothing matched and catch-all is off — delegate to Nest's default handler
    super.catch(exception, host);
  }
}
