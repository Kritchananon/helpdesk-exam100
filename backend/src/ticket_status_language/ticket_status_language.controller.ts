import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TicketStatusLanguageService } from './ticket_status_language.service';
import { CreateTicketStatusLanguageDto } from './dto/create-ticket_status_language.dto';
import { UpdateTicketStatusLanguageDto } from './dto/update-ticket_status_language.dto';

@Controller('ticket-status-language')
export class TicketStatusLanguageController {
  constructor(private readonly ticketStatusLanguageService: TicketStatusLanguageService) {}

  @Post()
  create(@Body() createTicketStatusLanguageDto: CreateTicketStatusLanguageDto) {
    return this.ticketStatusLanguageService.create(createTicketStatusLanguageDto);
  }

  @Get()
  findAll() {
    return this.ticketStatusLanguageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketStatusLanguageService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTicketStatusLanguageDto: UpdateTicketStatusLanguageDto) {
    return this.ticketStatusLanguageService.update(+id, updateTicketStatusLanguageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketStatusLanguageService.remove(+id);
  }
}
