import { 
    IsEmail, 
    IsDateString, 
    IsString, 
    IsBoolean, 
    IsNotEmpty, 
    IsOptional,
    IsNumber,
} from "class-validator";

export class CreateCustomerDto {
    @IsNotEmpty()
    @IsString()
    name!: string;

    @IsNotEmpty()
    @IsString()
    address!: string;

    @IsNotEmpty()
    @IsString()
    telephone!: string;

    @IsNotEmpty()
    @IsEmail()
    email!: string;

    @IsOptional()
    @IsDateString()
    create_date?: Date;

    @IsOptional()
    @IsNumber()
    create_by!: number;

    @IsOptional()
    @IsDateString()
    update_date?: Date;

    @IsOptional()
    @IsNumber()
    update_by!: number;

    @IsOptional()
    status: boolean;

    @IsOptional()
    @IsBoolean()
    isenabled?: boolean;
}
