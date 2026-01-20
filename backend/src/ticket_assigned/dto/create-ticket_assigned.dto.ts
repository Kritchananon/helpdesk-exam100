import { IsOptional } from "class-validator";

export class CreateTicketAssignedDto {
    @IsOptional()
    user_id: number;
}
