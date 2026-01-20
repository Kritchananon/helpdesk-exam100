import { Type } from "class-transformer";
import { IsArray, IsOptional, ValidateNested } from "class-validator";
import { CreateTicketCategoriesLanguageDto } from "../../ticket_categories_language/dto/create-ticket_categories_language.dto";

export class CreateCategoryDto {
  @IsOptional()
  create_by: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTicketCategoriesLanguageDto)
  languages: CreateTicketCategoriesLanguageDto[];
}
