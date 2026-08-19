import {
  Body,
  Controller,
  Get,
  HttpException,
  NotFoundException,
  Post,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InsufficientFundsException } from './test.exceptions';
import { ProblemDetailException } from '../../../src/problem-detail.exception';
import { CreateUserDto } from './test.dto';
import { createRfc9457ValidationPipeExceptionFactory } from '../../../src/validation/rfc9457-validation-pipe-exception.factory';

@Controller('test')
export class AppController {
  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('Resource not found');
  }

  @Get('custom-exception')
  customException(): never {
    throw new InsufficientFundsException(50, 100);
  }

  @Post('validate-default')
  @UsePipes(new ValidationPipe())
  validateDefault(@Body() _dto: CreateUserDto): string {
    return 'ok';
  }

  @Post('validate-enhanced')
  @UsePipes(
    new ValidationPipe({
      exceptionFactory: createRfc9457ValidationPipeExceptionFactory(),
    }),
  )
  validateEnhanced(@Body() _dto: CreateUserDto): string {
    return 'ok';
  }

  @Post('validate-422')
  @UsePipes(new ValidationPipe({ errorHttpStatusCode: 422 }))
  validate422(@Body() _dto: CreateUserDto): string {
    return 'ok';
  }

  @Get('problem-detail')
  problemDetail(): never {
    throw new ProblemDetailException({
      type: 'https://api.example.com/problems/insufficient-funds',
      title: 'Insufficient Funds',
      status: 402,
      detail: 'Your balance is too low to cover this transfer.',
      balance: 30,
      cost: 50,
    });
  }

  @Get('rate-limited')
  rateLimited(): never {
    throw new ProblemDetailException(
      { status: 429, title: 'Too Many Requests', retryAfterSeconds: 60 },
      { headers: { 'Retry-After': '60' } },
    );
  }

  @Get('redirect-ish')
  redirectIsh(): never {
    // A non-error HttpException: RFC 9457 does not cover 3xx, so the filter
    // hands this back to NestJS rather than emitting problem+json.
    throw new HttpException('moved', 302);
  }

  @Get('unhandled')
  unhandled(): never {
    throw new Error('Unexpected internal error');
  }

  @Get('committed')
  committed(@Res() res: any): never {
    // Express-only test route: commit the response, then throw.
    res.write('partial');
    throw new Error('thrown after response was committed');
  }
}
