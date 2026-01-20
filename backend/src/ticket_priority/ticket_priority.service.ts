import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketPriority } from './entities/ticket_priority.entity';
import { CreateTicketPriorityDto } from './dto/create-ticket_priority.dto';
import { UpdateTicketPriorityDto } from './dto/update-ticket_priority.dto';

@Injectable()
export class TicketPriorityService {
  constructor(
    @InjectRepository(TicketPriority)
    private readonly priorityRepository: Repository<TicketPriority>,
  ) {}

  create(
    createTicketPriorityDto: CreateTicketPriorityDto,
  ): Promise<TicketPriority> {
    const priority = this.priorityRepository.create(createTicketPriorityDto);
    return this.priorityRepository.save(priority);
  }

  findAll(): Promise<TicketPriority[]> {
    return this.priorityRepository.find();
  }

  async findOne(id: number): Promise<TicketPriority> {
    const priority = await this.priorityRepository.findOne({ where: { id } });
    if (!priority) {
      throw new NotFoundException(`TicketPriority with ID #${id} not found`);
    }
    return priority;
  }

  async update(
    id: number,
    updateTicketPriorityDto: UpdateTicketPriorityDto,
  ): Promise<TicketPriority> {
    // โหลด priority ที่มีอยู่ก่อน แล้วค่อย merge ข้อมูลใหม่
    // preload จะหาตาม id ถ้าเจอจะเอา dto มารวมให้ ถ้าไม่เจอ return undefined
    const priority = await this.priorityRepository.preload({
      id: id,
      ...updateTicketPriorityDto,
    });

    if (!priority) {
      throw new NotFoundException(`TicketPriority with ID #${id} not found`);
    }

    return this.priorityRepository.save(priority);
  }

  async remove(id: number): Promise<void> {
    const priority = await this.findOne(id); // ใช้ findOne เพื่อเช็คว่ามีข้อมูลจริงก่อนลบ
    await this.priorityRepository.remove(priority);
  }
}