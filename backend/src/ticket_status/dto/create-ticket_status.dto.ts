import { IsOptional, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CreateTicketStatusLanguageDto } from "../../ticket_status_language/dto/create-ticket_status_language.dto";

export class CreateTicketStatusDto {
    @IsOptional()
    create_by: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateTicketStatusLanguageDto)
    statusLang: CreateTicketStatusLanguageDto[];
}
