import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

export class Rfc9457ValidationException extends BadRequestException {
  constructor(public readonly validationErrors: ValidationError[]) {
    super('Request validation failed');
  }
}
