import { IsNotEmpty, IsOptional } from "class-validator";

export class CreateProjectDto {
    @IsNotEmpty()
    name!: string;

    @IsOptional()
    create_by?: number;

    @IsOptional()
    status: boolean
}
