import { Module } from '@nestjs/common';
import { TicketStatusLanguageService } from './ticket_status_language.service';
import { TicketStatusLanguageController } from './ticket_status_language.controller';

@Module({
  controllers: [TicketStatusLanguageController],
  providers: [TicketStatusLanguageService],
})
export class TicketStatusLanguageModule {}
