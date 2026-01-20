import { Test, TestingModule } from '@nestjs/testing';
import { SatisfactionController } from './satisfaction.controller';
import { SatisfactionService } from './satisfaction.service';
import { CreateSatisfactionDto } from './dto/create-satisfaction.dto';
import { UpdateSatisfactionDto } from './dto/update-satisfaction.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { ParseIntPipe } from '@nestjs/common';

describe('SatisfactionController', () => {
  let controller: SatisfactionController;
  let service: SatisfactionService;

  const mockSatisfactionService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockUser = {
    id: 1,
    sub: 1,
    userId: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SatisfactionController],
      providers: [
        {
          provide: SatisfactionService,
          useValue: mockSatisfactionService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SatisfactionController>(SatisfactionController);
    service = module.get<SatisfactionService>(SatisfactionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const ticketId = 1;
    const createDto: CreateSatisfactionDto = {
      rating: 5,
    };

    it('should call satisfactionService.create with user.id', async () => {
      const req = { user: { id: 1 } };
      await controller.create(ticketId, createDto, req);
      // ตรวจสอบว่าเรียก create โดยใช้ req.user.id
      expect(service.create).toHaveBeenCalledWith(ticketId, 1, createDto);
    });

    it('should call satisfactionService.create with user.sub if id is missing', async () => {
      const req = { user: { sub: 2 } }; // ไม่มี id, แต่มี sub
      await controller.create(ticketId, createDto, req);
      // ตรวจสอบว่าเรียก create โดยใช้ req.user.sub
      expect(service.create).toHaveBeenCalledWith(ticketId, 2, createDto);
    });

    it('should call satisfactionService.create with user.userId if id and sub are missing', async () => {
      const req = { user: { userId: 3 } }; // ไม่มี id, ไม่มี sub, แต่มี userId
      await controller.create(ticketId, createDto, req);
      // ตรวจสอบว่าเรียก create โดยใช้ req.user.userId
      expect(service.create).toHaveBeenCalledWith(ticketId, 3, createDto);
    });
  });

  describe('findAll', () => {
    it('should call satisfactionService.findAll', async () => {
      await controller.findAll();
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should call satisfactionService.findOne with the parsed ID', async () => {
      const id = '1';
      await controller.findOne(id);
      expect(service.findOne).toHaveBeenCalledWith(1); // ถูกต้องที่แปลง '1' เป็น 1
    });
  });

  describe('update', () => {
    it('should call satisfactionService.update with the parsed ID and DTO', async () => {
      const id = '1';
      const updateDto: UpdateSatisfactionDto = { rating: 4 };
      await controller.update(id, updateDto);
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('remove', () => {
    it('should call satisfactionService.remove with the parsed ID', async () => {
      const id = '1';
      await controller.remove(id);
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});