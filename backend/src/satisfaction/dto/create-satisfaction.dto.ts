import { Transform, Type } from "class-transformer";
import { IsInt, IsNotEmpty, Max, Min } from "class-validator";

export class CreateSatisfactionDto {
    @IsNotEmpty()
    @IsInt()
    @Min(1)
    @Max(5)
    @Transform(({ value }) => parseInt(value))
    @Type(() => Number)
    rating: number;
}
