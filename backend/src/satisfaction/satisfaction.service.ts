import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSatisfactionDto } from './dto/create-satisfaction.dto';
import { UpdateSatisfactionDto } from './dto/update-satisfaction.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Satisfaction } from './entities/satisfaction.entity';
import { Repository } from 'typeorm';
import { Ticket } from '../ticket/entities/ticket.entity';

@Injectable()
export class SatisfactionService {
  constructor(
    @InjectRepository(Satisfaction)
    private satisfactionRepo: Repository<Satisfaction>,
    @InjectRepository(Ticket)
    private ticketRepo: Repository<Ticket>,
  ){}

  async create(ticketId: number, createBy: number, createSatisfactionDto: CreateSatisfactionDto) {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId }
    });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }

    const newSatisfaction = this.satisfactionRepo.create({
      ...createSatisfactionDto,
      ticket_id: ticketId,
      create_by: createBy,
    });
    return this.satisfactionRepo.save(newSatisfaction);
  }

  async findAll() {
    return this.satisfactionRepo.find({ relations: ['ticket'] });
  }

  async findOne(id: number) {
    const satisfaction = await this.satisfactionRepo.findOne({
      where: { id },
      relations: ['ticket'],
    });
    if (!satisfaction) {
      throw new NotFoundException(`Satisfaction with ID ${id} not found`);
    }
    return satisfaction;
  }

  async update(id: number, updateSatisfactionDto: UpdateSatisfactionDto) {
    const satisfaction = await this.findOne(id);
    Object.assign(satisfaction, updateSatisfactionDto);
    return this.satisfactionRepo.save(satisfaction);
  }

  async remove(id: number) {
    const satisfaction = await this.findOne(id);
    await this.satisfactionRepo.remove(satisfaction);
    return { deleted: true };
  }
}