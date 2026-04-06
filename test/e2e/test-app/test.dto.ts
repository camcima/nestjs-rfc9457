import { IsEmail, IsInt, Min } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsInt()
  @Min(0)
  age!: number;
}
