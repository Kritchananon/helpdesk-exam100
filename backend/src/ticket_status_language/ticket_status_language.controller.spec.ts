import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatusLanguageController } from './ticket_status_language.controller';
import { TicketStatusLanguageService } from './ticket_status_language.service';
import { CreateTicketStatusLanguageDto } from './dto/create-ticket_status_language.dto';
import { UpdateTicketStatusLanguageDto } from './dto/update-ticket_status_language.dto';

  const mockTicketStatusLanguageService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

describe('TicketStatusLanguageController', () => {
  let controller: TicketStatusLanguageController;
  let service: TicketStatusLanguageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketStatusLanguageController],
      providers: [
        {
          provide: TicketStatusLanguageService,
          useValue: mockTicketStatusLanguageService,
        },
      ],
    }).compile();

    controller = module.get<TicketStatusLanguageController>(
      TicketStatusLanguageController,
    );
    service = module.get<TicketStatusLanguageService>(
      TicketStatusLanguageService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with the correct DTO', () => {
      const createDto: CreateTicketStatusLanguageDto = {
        language_id: 'en',
        name: 'New Status',
      };
      const expectedResult = { id: 1, ...createDto };

      // กำหนดให้ mock service return ค่านี้
      mockTicketStatusLanguageService.create.mockReturnValue(expectedResult);

      const result = controller.create(createDto);

      // ตรวจสอบว่า service.create ถูกเรียกด้วย DTO ที่ถูกต้อง
      expect(service.create).toHaveBeenCalledWith(createDto);
      // ตรวจสอบว่า controller return ค่าที่ได้จาก service
      expect(result).toEqual(expectedResult);
    });
  });

  // 2. Test สำหรับ method 'findAll'
  describe('findAll', () => {
    it('should call service.findAll and return an array of results', () => {
      const expectedResult = [
        { id: 1, language_id: 'en', name: 'Open' },
        { id: 2, language_id: 'th', name: 'เปิด' },
      ];

      mockTicketStatusLanguageService.findAll.mockReturnValue(expectedResult);

      const result = controller.findAll();

      // ตรวจสอบว่า service.findAll ถูกเรียก
      expect(service.findAll).toHaveBeenCalled();
      // ตรวจสอบว่า controller return ค่าที่ได้จาก service
      expect(result).toEqual(expectedResult);
    });
  });

  // 3. Test สำหรับ method 'findOne'
  describe('findOne', () => {
    it('should call service.findOne with the numeric ID', () => {
      const id = '1';
      const expectedResult = { id: 1, language_id: 'en', name: 'Open' };

      mockTicketStatusLanguageService.findOne.mockReturnValue(expectedResult);

      const result = controller.findOne(id);

      // ตรวจสอบว่า service.findOne ถูกเรียกด้วย ID ที่แปลงเป็น number แล้ว (จาก +id)
      expect(service.findOne).toHaveBeenCalledWith(1);
      // ตรวจสอบว่า controller return ค่าที่ได้จาก service
      expect(result).toEqual(expectedResult);
    });

    it('should handle non-numeric string ID correctly (resulting in NaN)', () => {
      const id = 'invalid';
      mockTicketStatusLanguageService.findOne.mockReturnValue(null); // สมมติว่า service คืนค่า null

      controller.findOne(id);

      // ตรวจสอบว่า service.findOne ถูกเรียกด้วย NaN
      expect(service.findOne).toHaveBeenCalledWith(NaN);
    });
  });

  // 4. Test สำหรับ method 'update'
  describe('update', () => {
    it('should call service.update with the numeric ID and DTO', () => {
      const id = '1';
      const updateDto: UpdateTicketStatusLanguageDto = { name: 'Updated Status' };
      const expectedResult = { id: 1, language_id: 'en', name: 'Updated Status' };

      mockTicketStatusLanguageService.update.mockReturnValue(expectedResult);

      const result = controller.update(id, updateDto);

      // ตรวจสอบว่า service.update ถูกเรียกด้วย ID (number) และ DTO ที่ถูกต้อง
      expect(service.update).toHaveBeenCalledWith(1, updateDto);
      // ตรวจสอบว่า controller return ค่าที่ได้จาก service
      expect(result).toEqual(expectedResult);
    });
  });

  // 5. Test สำหรับ method 'remove'
  describe('remove', () => {
    it('should call service.remove with the numeric ID', () => {
      const id = '1';
      const expectedResult = { affected: 1 }; // สมมติว่า service return ผลลัพธ์การลบ

      mockTicketStatusLanguageService.remove.mockReturnValue(expectedResult);

      const result = controller.remove(id);

      // ตรวจสอบว่า service.remove ถูกเรียกด้วย ID (number) ที่ถูกต้อง
      expect(service.remove).toHaveBeenCalledWith(1);
      // ตรวจสอบว่า controller return ค่าที่ได้จาก service
      expect(result).toEqual(expectedResult);
    });
  });

  // Test for future implementation when service is fully developed
  describe('integration considerations', () => {
    it('should properly inject service dependency', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(Object);
    });

    it('should have all CRUD operations available', () => {
      expect(controller.create).toBeDefined();
      expect(controller.findAll).toBeDefined();
      expect(controller.findOne).toBeDefined();
      expect(controller.update).toBeDefined();
      expect(controller.remove).toBeDefined();
    });
  });

  // Example tests for when the service is fully implemented
  describe('future implementation scenarios', () => {
    it('would handle successful creation of status language', () => {
      // This is how the test would look when service is implemented:
      /*
      const createDto: CreateTicketStatusLanguageDto = {
        language_id: 'en',
        name: 'Open',
      };

      const expectedResult = {
        status_id: 1,
        language_id: 'en',
        name: 'Open',
      };

      mockTicketStatusLanguageService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(expectedResult);
      */
      
      // For now, verify current behavior
      expect(typeof controller.create).toBe('function');
    });

    it('would handle error cases in service calls', () => {
      // This is how error handling would look:
      /*
      const createDto: CreateTicketStatusLanguageDto = {
        language_id: 'en',
        name: 'Open',
      };

      mockTicketStatusLanguageService.create.mockRejectedValue(
        new Error('Database error')
      );

      await expect(controller.create(createDto)).rejects.toThrow('Database error');
      */
      
      // For now, verify current behavior
      expect(controller.create).toBeDefined();
    });

    it('would validate input data through DTOs', () => {
      // When validation is implemented, test would verify:
      /*
      const invalidDto = {
        language_id: '', // empty string should fail validation
        name: '',        // empty string should fail validation
      };

      // This would throw ValidationError in real implementation
      */
      
      // For now, verify DTO types are properly used
      const createDto: CreateTicketStatusLanguageDto = {
        language_id: 'en',
        name: 'Open',
      };
      
      // Should not throw type errors
      controller.create(createDto);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });

    it('would handle HTTP status codes properly', () => {
      // In full implementation, would test:
      // - 201 Created for successful POST
      // - 200 OK for successful GET/PUT/PATCH
      // - 204 No Content for successful DELETE
      // - 404 Not Found for missing resources
      // - 400 Bad Request for validation errors
      
      // For now, verify methods exist
      expect(controller.create).toBeDefined();
      expect(controller.findAll).toBeDefined();
      expect(controller.findOne).toBeDefined();
      expect(controller.update).toBeDefined();
      expect(controller.remove).toBeDefined();
    });
  });
});