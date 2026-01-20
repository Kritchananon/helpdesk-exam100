import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsBoolean,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreateUserDto {
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

  @IsOptional()
  @IsDateString()
  start_date?: Date;

  @IsOptional()
  @IsDateString()
  end_date?: Date;

  @IsOptional()
  @IsDateString()
  create_date?: Date;

  @IsOptional()
  create_by!: number;

  @IsOptional()
  @IsDateString()
  update_date?: Date;

  @IsOptional()
  update_by!: number;

  @IsOptional()
  @IsBoolean()
  isenabled?: boolean;
}
