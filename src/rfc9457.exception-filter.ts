import { ArgumentsHost, Catch, HttpException, Inject } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { ProblemDetailsFactory } from './problem-details.factory';
import { RFC9457_MODULE_OPTIONS, PROBLEM_CONTENT_TYPE } from './rfc9457.constants';
import { Rfc9457ModuleOptions } from './rfc9457.interfaces';

@Catch()
export class Rfc9457ExceptionFilter extends BaseExceptionFilter {
  constructor(
    private readonly factory: ProblemDetailsFactory,
    @Inject(RFC9457_MODULE_OPTIONS) private readonly options: Rfc9457ModuleOptions,
    adapterHost: HttpAdapterHost,
  ) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (!(exception instanceof HttpException) && !this.options.catchAllExceptions) {
      super.catch(exception, host);
      return;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const { status, body } = this.factory.create(exception, request);
    const httpAdapter = (this as any).httpAdapterHost?.httpAdapter || (this as any).applicationRef;
    httpAdapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
    httpAdapter.reply(response, body, status);
  }
}
