import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TicketCategoriesLanguageService } from './ticket_categories_language.service';
import { CreateTicketCategoriesLanguageDto } from './dto/create-ticket_categories_language.dto';
import { UpdateTicketCategoriesLanguageDto } from './dto/update-ticket_categories_language.dto';

@Controller('ticket-categories-language')
export class TicketCategoriesLanguageController {
  constructor(private readonly ticketCategoriesLanguageService: TicketCategoriesLanguageService) {}

  @Post()
  create(@Body() createTicketCategoriesLanguageDto: CreateTicketCategoriesLanguageDto) {
    return this.ticketCategoriesLanguageService.create(createTicketCategoriesLanguageDto);
  }

  @Get()
  findAll() {
    return this.ticketCategoriesLanguageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketCategoriesLanguageService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTicketCategoriesLanguageDto: UpdateTicketCategoriesLanguageDto) {
    return this.ticketCategoriesLanguageService.update(+id, updateTicketCategoriesLanguageDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketCategoriesLanguageService.remove(+id);
  }
}
