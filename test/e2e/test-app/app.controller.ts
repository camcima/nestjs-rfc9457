import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InsufficientFundsException } from './test.exceptions';
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

  @Get('unhandled')
  unhandled(): never {
    throw new Error('Unexpected internal error');
  }
}
