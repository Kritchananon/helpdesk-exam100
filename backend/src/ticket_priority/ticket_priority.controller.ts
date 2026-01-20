import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TicketPriorityService } from './ticket_priority.service';
import { CreateTicketPriorityDto } from './dto/create-ticket_priority.dto';
import { UpdateTicketPriorityDto } from './dto/update-ticket_priority.dto';

@Controller('ticket-priority')
export class TicketPriorityController {
  constructor(private readonly ticketPriorityService: TicketPriorityService) {}

  @Post()
  create(@Body() createTicketPriorityDto: CreateTicketPriorityDto) {
    return this.ticketPriorityService.create(createTicketPriorityDto);
  }

  @Get()
  findAll() {
    return this.ticketPriorityService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketPriorityService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTicketPriorityDto: UpdateTicketPriorityDto) {
    return this.ticketPriorityService.update(+id, updateTicketPriorityDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketPriorityService.remove(+id);
  }
}
