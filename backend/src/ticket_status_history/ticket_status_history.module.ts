import { Module } from '@nestjs/common';
import { TicketStatusHistoryService } from './ticket_status_history.service';
import { TicketStatusHistoryController } from './ticket_status_history.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketStatusHistory } from './entities/ticket_status_history.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Users } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketStatusHistory,
      Ticket,
      Users
    ]),
  ],
  controllers: [TicketStatusHistoryController],
  providers: [TicketStatusHistoryService],
  exports: [TicketStatusHistoryService]
})
export class TicketStatusHistoryModule {}
