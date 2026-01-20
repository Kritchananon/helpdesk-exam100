import { IsNotEmpty, IsOptional } from "class-validator";

export class CreateTicketStatusHistoryDto {
    @IsNotEmpty()
    ticket_id: number;

    @IsNotEmpty()
    status_id: number;

    @IsOptional()
    create_date?: Date;

    @IsNotEmpty()
    create_by: number;
}
