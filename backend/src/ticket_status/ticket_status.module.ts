import { Module } from '@nestjs/common';
import { TicketStatusService } from './ticket_status.service';
import { TicketStatusController } from './ticket_status.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketStatus } from './entities/ticket_status.entity';
import { TicketStatusLanguage } from '../ticket_status_language/entities/ticket_status_language.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketStatusHistoryModule } from '../ticket_status_history/ticket_status_history.module';
import { TicketStatusHistory } from '../ticket_status_history/entities/ticket_status_history.entity';
import { NotificationModule } from '../notification/notification.module';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketStatus, 
      TicketStatusLanguage, 
      Ticket,
      TicketStatusHistory
    ]),
    TicketStatusLanguage,
    TicketStatusHistoryModule,
    NotificationModule,
    PermissionModule,
  ],
  controllers: [TicketStatusController],
  providers: [TicketStatusService],
  exports: [TicketStatusService, TypeOrmModule],
})
export class TicketStatusModule {}
