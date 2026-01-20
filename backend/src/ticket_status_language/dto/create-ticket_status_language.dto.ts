import { IsNotEmpty, IsString } from "class-validator";    

export class CreateTicketStatusLanguageDto {
    @IsNotEmpty()
    @IsString()
    language_id: string;

    @IsNotEmpty()
    @IsString()
    name: string;
}
