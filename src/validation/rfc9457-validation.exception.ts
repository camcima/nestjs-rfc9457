import { BadRequestException } from '@nestjs/common';

export class Rfc9457ValidationException extends BadRequestException {
  constructor(public readonly validationErrors: unknown[]) {
    super('Request validation failed');
  }
}
