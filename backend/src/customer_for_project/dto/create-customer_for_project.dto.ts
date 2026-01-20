import { IsNotEmpty, IsOptional, IsDateString, IsBoolean, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class AssignedUserDto {
  @IsNotEmpty()
  user_id!: number;
}

export class CreateCustomerForProjectDto {
  @IsNotEmpty()
  customer_id!: number;

  @IsNotEmpty()
  project_id!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignedUserDto)
  assigned_users!: AssignedUserDto[];

  @IsOptional()
  create_by!: number;

  @IsOptional()
  @IsDateString()
  create_date?: Date;

  @IsOptional()
  update_by!: number;

  @IsOptional()
  @IsDateString()
  update_date?: Date;

  @IsOptional()
  @IsBoolean()
  isenabled?: boolean;
}
