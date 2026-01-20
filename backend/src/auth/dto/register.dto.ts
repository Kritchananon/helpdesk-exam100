import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  username!: string;

  @IsEmail()
  email!: string;

  @MinLength(6)
  password!: string;

  @IsNotEmpty()
  firstname!: string;

  @IsNotEmpty()
  lastname!: string;

  @IsNotEmpty()
  phone!: string;

  @IsNotEmpty()
  @IsDateString()
  start_date!: Date;

  @IsNotEmpty()
  @IsDateString()
  end_date!: Date;

  @IsNotEmpty()
  @IsDateString()
  create_date!: Date;

  @IsNotEmpty()
  create_by!: number;

  @IsNotEmpty()
  @IsDateString()
  update_date!: Date;

  @IsNotEmpty()
  update_by!: number;

  @IsNotEmpty()
  @IsBoolean()
  isenabled!: boolean;
}
