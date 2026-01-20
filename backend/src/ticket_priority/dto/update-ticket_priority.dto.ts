import { PartialType } from '@nestjs/swagger';
import { CreateTicketPriorityDto } from './create-ticket_priority.dto';

export class UpdateTicketPriorityDto extends PartialType(CreateTicketPriorityDto) {}
