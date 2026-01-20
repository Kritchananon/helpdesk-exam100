import { IsNotEmpty, IsString } from "class-validator";

export class CreateTicketCategoriesLanguageDto {
    @IsNotEmpty()
    @IsString()
    language_id: string;

    @IsNotEmpty()
    @IsString()
    name: string;
}
