import { Injectable } from '@nestjs/common';
import { CreateTicketStatusLanguageDto } from './dto/create-ticket_status_language.dto';
import { UpdateTicketStatusLanguageDto } from './dto/update-ticket_status_language.dto';

@Injectable()
export class TicketStatusLanguageService {
  create(createTicketStatusLanguageDto: CreateTicketStatusLanguageDto) {
    return 'This action adds a new ticketStatusLanguage';
  }

  findAll() {
    return `This action returns all ticketStatusLanguage`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ticketStatusLanguage`;
  }

  update(id: number, updateTicketStatusLanguageDto: UpdateTicketStatusLanguageDto) {
    return `This action updates a #${id} ticketStatusLanguage`;
  }

  remove(id: number) {
    return `This action removes a #${id} ticketStatusLanguage`;
  }
}
