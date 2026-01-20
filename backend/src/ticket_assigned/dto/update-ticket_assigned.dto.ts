import { PartialType } from '@nestjs/swagger';
import { CreateTicketAssignedDto } from './create-ticket_assigned.dto';

export class UpdateTicketAssignedDto extends PartialType(CreateTicketAssignedDto) {}
