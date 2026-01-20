import { Module } from '@nestjs/common';
import { TicketPriorityService } from './ticket_priority.service';
import { TicketPriorityController } from './ticket_priority.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketPriority } from './entities/ticket_priority.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketPriority
    ]),
  ],
  controllers: [TicketPriorityController],
  providers: [TicketPriorityService],
  exports: [TypeOrmModule]
})
export class TicketPriorityModule {}
