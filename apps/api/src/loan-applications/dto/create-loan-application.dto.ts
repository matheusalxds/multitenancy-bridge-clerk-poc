import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CreateLoanApplicationDto {
  @IsString()
  @IsNotEmpty()
  borrowerName!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
