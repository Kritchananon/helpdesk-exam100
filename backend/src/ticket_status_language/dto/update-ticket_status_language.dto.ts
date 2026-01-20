import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketStatusLanguageDto } from './create-ticket_status_language.dto';

export class UpdateTicketStatusLanguageDto extends PartialType(CreateTicketStatusLanguageDto) {}
