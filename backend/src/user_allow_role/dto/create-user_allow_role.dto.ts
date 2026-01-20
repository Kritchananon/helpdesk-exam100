import { ArrayNotEmpty, IsArray, IsNumber } from "class-validator";

export class CreateUserAllowRoleDto {
    @IsNumber()
    user_id: number;

    @IsArray()
    @ArrayNotEmpty()
    @IsNumber({}, {each: true})
    role_id: number[];
}
