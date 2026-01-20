import { Test, TestingModule } from '@nestjs/testing';
import { TicketPriorityController } from './ticket_priority.controller';
import { TicketPriorityService } from './ticket_priority.service';
import { CreateTicketPriorityDto } from './dto/create-ticket_priority.dto';
import { UpdateTicketPriorityDto } from './dto/update-ticket_priority.dto';

// สร้าง Mock Service
const mockTicketPriorityService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('TicketPriorityController', () => {
  let controller: TicketPriorityController;
  let service: TicketPriorityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketPriorityController],
      providers: [
        {
          provide: TicketPriorityService,
          useValue: mockTicketPriorityService, // ใช้ Mock Service
        },
      ],
    }).compile();

    controller = module.get<TicketPriorityController>(TicketPriorityController);
    service = module.get<TicketPriorityService>(TicketPriorityService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // เคลียร์ mock calls ทุกครั้งหลัง test
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new ticket priority', async () => {
      const createDto: CreateTicketPriorityDto = { name: 'High' };
      const expectedResult = { id: 1, ...createDto };

      mockTicketPriorityService.create.mockReturnValue(expectedResult);

      const result = await controller.create(createDto);

      expect(result).toEqual(expectedResult);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of ticket priorities', async () => {
      const expectedResult = [{ id: 1, name: 'High' }];
      mockTicketPriorityService.findAll.mockReturnValue(expectedResult);

      const result = await controller.findAll();

      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single ticket priority', async () => {
      const id = '1';
      const expectedResult = { id: 1, name: 'High' };
      mockTicketPriorityService.findOne.mockReturnValue(expectedResult);

      const result = await controller.findOne(id);

      expect(result).toEqual(expectedResult);
      expect(service.findOne).toHaveBeenCalledWith(+id); // Controller ส่ง string มา, service รับ number
    });
  });

  describe('update', () => {
    it('should update a ticket priority', async () => {
      const id = '1';
      const updateDto: UpdateTicketPriorityDto = { name: 'Medium' };
      const expectedResult = { id: 1, ...updateDto };

      mockTicketPriorityService.update.mockReturnValue(expectedResult);

      const result = await controller.update(id, updateDto);

      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith(+id, updateDto);
    });
  });

  describe('remove', () => {
    it('should remove a ticket priority', async () => {
      const id = '1';
      mockTicketPriorityService.remove.mockReturnValue(undefined); // remove มักไม่ return ค่า

      await controller.remove(id);

      expect(service.remove).toHaveBeenCalledWith(+id);
    });
  });
});