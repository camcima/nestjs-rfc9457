import { HttpException } from '@nestjs/common';
import { ProblemType } from '../../../src/problem-type.decorator';

@ProblemType({
  type: 'https://example.com/problems/insufficient-funds',
  title: 'Insufficient Funds',
  status: 422,
})
export class InsufficientFundsException extends HttpException {
  constructor(balance: number, required: number) {
    super(`Balance ${balance} is less than required ${required}`, 422);
  }
}
