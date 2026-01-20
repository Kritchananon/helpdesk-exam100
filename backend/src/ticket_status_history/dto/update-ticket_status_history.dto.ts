import { PartialType } from '@nestjs/mapped-types';
import { CreateTicketStatusHistoryDto } from './create-ticket_status_history.dto';

export class UpdateTicketStatusHistoryDto extends PartialType(CreateTicketStatusHistoryDto) {}
