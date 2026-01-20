import { Test, TestingModule } from '@nestjs/testing';
import { SatisfactionService } from './satisfaction.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Satisfaction } from './entities/satisfaction.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Repository } from 'typeorm';
import { CreateSatisfactionDto } from './dto/create-satisfaction.dto';
import { NotFoundException } from '@nestjs/common';
import { UpdateSatisfactionDto } from './dto/update-satisfaction.dto';

describe('SatisfactionService', () => {
  let service: SatisfactionService;
  let satisfactionRepository: jest.Mocked<Repository<Satisfaction>>;
  let ticketRepository: jest.Mocked<Repository<Ticket>>;

  const mockSatisfaction = {
    id: 1,
    ticket_id: 1,
    rating: 5,
    create_by: 1,
    create_date: new Date(),
    ticket: { id: 1, ticket_no: 'T12345' },
  };

  const createMockRepository = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SatisfactionService,
        {
          provide: getRepositoryToken(Satisfaction),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Ticket),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<SatisfactionService>(SatisfactionService);
    satisfactionRepository = module.get(getRepositoryToken(Satisfaction));
    ticketRepository = module.get(getRepositoryToken(Ticket));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks(); // เพิ่มการ restore spy ทั้งหมด
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    // (ส่วนนี้เหมือนเดิม เพราะทำได้ดีอยู่แล้ว)
    it('should create a new satisfaction rating successfully', async () => {
      const createDto: CreateSatisfactionDto = { rating: 5 };
      const ticketId = 1;
      const createBy = 1;

      const mockTicket = { id: ticketId, ticket_no: 'T12345' };
      ticketRepository.findOne.mockResolvedValueOnce(mockTicket as any);
      satisfactionRepository.create.mockReturnValueOnce(mockSatisfaction as any);
      satisfactionRepository.save.mockResolvedValueOnce(mockSatisfaction as any);

      const result = await service.create(ticketId, createBy, createDto);

      expect(ticketRepository.findOne).toHaveBeenCalledWith({ where: { id: ticketId } });
      expect(satisfactionRepository.create).toHaveBeenCalledWith({
        ...createDto,
        ticket_id: ticketId,
        create_by: createBy,
      });
      expect(satisfactionRepository.save).toHaveBeenCalledWith(mockSatisfaction);
      expect(result).toEqual(mockSatisfaction);
    });

    it('should throw NotFoundException if ticket does not exist', async () => {
      const createDto: CreateSatisfactionDto = { rating: 5 };
      const ticketId = 999;
      const createBy = 1;

      ticketRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.create(ticketId, createBy, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    // (ส่วนนี้เหมือนเดิม)
    it('should return an array of satisfactions', async () => {
      const satisfactions = [mockSatisfaction, { ...mockSatisfaction, id: 2 }];
      satisfactionRepository.find.mockResolvedValueOnce(satisfactions as any);

      const result = await service.findAll();

      expect(satisfactionRepository.find).toHaveBeenCalledWith({ relations: ['ticket'] });
      expect(result).toEqual(satisfactions);
    });
  });

  describe('findOne', () => {
    // (ส่วนนี้เหมือนเดิม)
    it('should return a single satisfaction by id', async () => {
      satisfactionRepository.findOne.mockResolvedValueOnce(mockSatisfaction as any);

      const result = await service.findOne(1);

      expect(satisfactionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['ticket'],
      });
      expect(result).toEqual(mockSatisfaction);
    });

    it('should throw NotFoundException if satisfaction not found', async () => {
      satisfactionRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    // ⭐️⭐️⭐️ จุดที่ปรับปรุง ⭐️⭐️⭐️
    it('should update a satisfaction rating successfully', async () => {
      const updateDto: UpdateSatisfactionDto = { rating: 4 };
      const updatedSatisfaction = { ...mockSatisfaction, ...updateDto };

      // 1. Spy ที่ 'this.findOne' แทนการ mock 'repository.findOne'
      const findOneSpy = jest
        .spyOn(service, 'findOne')
        .mockResolvedValueOnce(mockSatisfaction as any);
        
      // 2. Mock 'repository.save'
      satisfactionRepository.save.mockResolvedValueOnce(updatedSatisfaction as any);

      const result = await service.update(1, updateDto);

      // 3. ตรวจสอบว่า 'this.findOne' ถูกเรียก
      expect(findOneSpy).toHaveBeenCalledWith(1);
      
      // 4. ตรวจสอบว่า 'repository.save' ถูกเรียกด้วย object ที่ผสานกันแล้ว
      expect(satisfactionRepository.save).toHaveBeenCalledWith(updatedSatisfaction);
      expect(result).toEqual(updatedSatisfaction);
    });

    it('should throw NotFoundException if satisfaction not found', async () => {
      const updateDto: UpdateSatisfactionDto = { rating: 4 };
      
      // 1. Spy ที่ 'this.findOne' และให้มัน throw error
      jest
        .spyOn(service, 'findOne')
        .mockRejectedValueOnce(new NotFoundException());

      // 2. ตรวจสอบว่า service.update re-throw error นั้น
      await expect(service.update(999, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    // ⭐️⭐️⭐️ จุดที่ปรับปรุง ⭐️⭐️⭐️
    it('should remove a satisfaction rating successfully', async () => {
      // 1. Spy ที่ 'this.findOne'
      const findOneSpy = jest
        .spyOn(service, 'findOne')
        .mockResolvedValueOnce(mockSatisfaction as any);
        
      // 2. Mock 'repository.remove'
      satisfactionRepository.remove.mockResolvedValueOnce(mockSatisfaction as any);

      const result = await service.remove(1);

      // 3. ตรวจสอบว่า 'this.findOne' ถูกเรียก
      expect(findOneSpy).toHaveBeenCalledWith(1);
      
      // 4. ตรวจสอบว่า 'repository.remove' ถูกเรียกด้วย object ที่ได้มา
      expect(satisfactionRepository.remove).toHaveBeenCalledWith(mockSatisfaction);
      expect(result).toEqual({ deleted: true });
    });

    it('should throw NotFoundException if satisfaction not found', async () => {
      // 1. Spy ที่ 'this.findOne' และให้มัน throw error
      jest
        .spyOn(service, 'findOne')
        .mockRejectedValueOnce(new NotFoundException());

      // 2. ตรวจสอบว่า service.remove re-throw error นั้น
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});