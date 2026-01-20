import { Module } from '@nestjs/common';
import { SatisfactionService } from './satisfaction.service';
import { SatisfactionController } from './satisfaction.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Satisfaction } from './entities/satisfaction.entity';
import { Ticket } from '../ticket/entities/ticket.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Satisfaction, 
      Ticket,
    ]),
  ],
  controllers: [SatisfactionController],
  providers: [SatisfactionService],
})
export class SatisfactionModule {}
