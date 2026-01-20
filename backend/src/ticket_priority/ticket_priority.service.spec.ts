import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { TicketPriorityService } from './ticket_priority.service';
import { TicketPriority } from './entities/ticket_priority.entity';
import { CreateTicketPriorityDto } from './dto/create-ticket_priority.dto';

// สร้าง Mock Repository
// เราสามารถใช้ jest.Mocked<Repository<TicketPriority>> หรือสร้าง object ธรรมดาก็ได้
const mockPriorityRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  preload: jest.fn(),
  remove: jest.fn(),
};

describe('TicketPriorityService', () => {
  let service: TicketPriorityService;
  let repository: Repository<TicketPriority>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketPriorityService,
        {
          provide: getRepositoryToken(TicketPriority),
          useValue: mockPriorityRepository, // ใช้ Mock Repository
        },
      ],
    }).compile();

    service = module.get<TicketPriorityService>(TicketPriorityService);
    repository = module.get<Repository<TicketPriority>>(
      getRepositoryToken(TicketPriority),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new priority', async () => {
      const createDto: CreateTicketPriorityDto = { name: 'High' };
      const priorityEntity = { id: 1, ...createDto };

      mockPriorityRepository.create.mockReturnValue(createDto); // repo.create แค่สร้าง object
      mockPriorityRepository.save.mockResolvedValue(priorityEntity); // repo.save คือการบันทึกจริง

      const result = await service.create(createDto);

      expect(result).toEqual(priorityEntity);
      expect(repository.create).toHaveBeenCalledWith(createDto);
      expect(repository.save).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return all priorities', async () => {
      const expectedResult = [{ id: 1, name: 'High' }];
      mockPriorityRepository.find.mockResolvedValue(expectedResult);

      const result = await service.findAll();

      expect(result).toEqual(expectedResult);
      expect(repository.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should find a priority by id', async () => {
      const id = 1;
      const expectedResult = { id: 1, name: 'High' };
      mockPriorityRepository.findOne.mockResolvedValue(expectedResult);

      const result = await service.findOne(id);

      expect(result).toEqual(expectedResult);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id } });
    });

    it('should throw NotFoundException if priority not found', async () => {
      const id = 99;
      mockPriorityRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a priority', async () => {
      const id = 1;
      const updateDto = { name: 'Medium' };
      const updatedEntity = { id: 1, name: 'Medium' };

      mockPriorityRepository.preload.mockResolvedValue(updatedEntity);
      mockPriorityRepository.save.mockResolvedValue(updatedEntity);

      const result = await service.update(id, updateDto);

      expect(result).toEqual(updatedEntity);
      expect(repository.preload).toHaveBeenCalledWith({ id, ...updateDto });
      expect(repository.save).toHaveBeenCalledWith(updatedEntity);
    });

    it('should throw NotFoundException if priority to update not found', async () => {
      const id = 99;
      const updateDto = { name: 'Medium' };
      mockPriorityRepository.preload.mockResolvedValue(undefined); // preload คืน undefined ถ้าไม่เจอ

      await expect(service.update(id, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a priority', async () => {
      const id = 1;
      const existingPriority = { id: 1, name: 'High' };

      // service.remove เรียก findOne ก่อน
      mockPriorityRepository.findOne.mockResolvedValue(existingPriority);
      mockPriorityRepository.remove.mockResolvedValue(existingPriority); // repo.remove คืน entity ที่ลบ

      await service.remove(id);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(repository.remove).toHaveBeenCalledWith(existingPriority);
    });

    it('should throw NotFoundException if priority to remove not found', async () => {
      const id = 99;
      mockPriorityRepository.findOne.mockResolvedValue(null); // findOne ไม่เจอ

      await expect(service.remove(id)).rejects.toThrow(NotFoundException);
    });
  });
});