import { IsString, MaxLength } from "class-validator";

export class CreateMasterRoleDto {
    @IsString()
    @MaxLength(30)
    role_name: string;
}
