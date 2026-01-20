import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-ticket_category.dto';

export class UpdateTicketCategoryDto extends PartialType(CreateCategoryDto) {}
