import { Module } from '@nestjs/common';
import { AttachmentService } from './ticket_attachment.service';
import { TicketAttachmentController } from './ticket_attachment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketAttachment } from './entities/ticket_attachment.entity';
import { TicketModule } from '../ticket/ticket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketAttachment
    ]),
  ],
  controllers: [TicketAttachmentController],
  providers: [AttachmentService],
  exports: [AttachmentService]
})
export class TicketAttachmentModule {}
