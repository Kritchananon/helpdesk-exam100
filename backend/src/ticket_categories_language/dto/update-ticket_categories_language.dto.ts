import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketCategoriesLanguageDto } from './create-ticket_categories_language.dto';

export class UpdateTicketCategoriesLanguageDto extends PartialType(CreateTicketCategoriesLanguageDto) {}
