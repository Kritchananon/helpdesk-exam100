// customer.controller.spec.ts (FIXED)

import { Test, TestingModule } from '@nestjs/testing';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from '../permission/permission.guard';

// ------------------------------------------------------------------
//  👇 **[FIX 1/1]** 👇
//  Changed this type from a generic 'Partial' to an explicit
//  shape. This guarantees the mocked methods exist, fixing all
//  'possibly 'undefined'' errors.
// ------------------------------------------------------------------
type MockCustomerService = {
  create: jest.Mock;
  getCustomer: jest.Mock;
  getAllCustomer: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
};

describe('CustomerController', () => {
  let controller: CustomerController;
  let service: MockCustomerService; // Type is now the explicit mock

  // This object matches the 'MockCustomerService' type
  const mockService = {
    create: jest.fn(),
    getCustomer: jest.fn(),
    getAllCustomer: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  // Mock Guards
  const mockJwtAuthGuard = { canActivate: jest.fn(() => true) };
  const mockPermissionGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerController],
      providers: [
        {
          provide: CustomerService,
          useValue: mockService, // ใช้ mock service
        },
      ],
    })
      // Override Guards ทั้งหมดที่ Controller นี้ใช้
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(PermissionGuard)
      .useValue(mockPermissionGuard)
      .compile();

    controller = module.get<CustomerController>(CustomerController);
    service = module.get(CustomerService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ----------------------------------------
  //  Test: create
  // ----------------------------------------
  describe('create', () => {
    const createDto: CreateCustomerDto = {
      name: 'Test',
      address: '',
      telephone: '',
      email: '',
      create_by: 0, // จะถูก override
      update_by: 0, // จะถูก override
      status: true,
    };

    const mockRequest = {
      user: { id: 1, username: 'testuser' },
    };

    it('should call service.create with mutated DTO and userId', async () => {
      const mockResult = { code: 1, status: true, message: 'Success' };
      service.create.mockResolvedValue(mockResult);

      const result = await controller.create(createDto, mockRequest);

      // 1. ตรวจสอบว่า DTO ถูกเปลี่ยนแปลง
      // 2. ตรวจสอบว่า userId ถูกส่งไปเป็น argument ที่ 2
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test',
          create_by: 1, // DTO ถูกแก้
          update_by: 1, // DTO ถูกแก้
        }),
        1, // userId ถูกส่ง
      );

      expect(result).toBe(mockResult);
    });

    it('should extract userId from req.user.sub (fallback)', async () => {
      const reqWithSub = {
        user: { sub: 2, username: 'subuser' },
      };
      service.create.mockResolvedValue({} as any);

      await controller.create(createDto, reqWithSub);

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ create_by: 2, update_by: 2 }),
        2,
      );
    });
  });

  // ----------------------------------------
  //  Test: getCustomerData
  // ----------------------------------------
  describe('getCustomerData', () => {
    it('should call service.getCustomer', async () => {
      const mockResult = { code: 0, data: [] };
      service.getCustomer.mockResolvedValue(mockResult);

      const result = await controller.getCustomerData();

      expect(service.getCustomer).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockResult);
    });
  });

  // ----------------------------------------
  //  Test: findAllcustomer
  // ----------------------------------------
  describe('findAllcustomer', () => {
    it('should call service.getAllCustomer', async () => {
      const mockResult = { code: 1, data: [] };
      service.getAllCustomer.mockResolvedValue(mockResult);

      const result = await controller.findAllcustomer();

      expect(service.getAllCustomer).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockResult);
    });
  });

  // ----------------------------------------
  //  Test: update
  // ----------------------------------------
  describe('update', () => {
    const updateDto: UpdateCustomerDto = {
      name: 'Updated Name',
    };
    const mockRequest = {
      user: { id: 1, username: 'testuser' },
    };

    it('should call service.update with numeric ID, mutated DTO, and userId', async () => {
      const mockResult = { code: 1, message: 'Updated' };
      service.update.mockResolvedValue(mockResult);

      const result = await controller.update('123', updateDto, mockRequest);

      // 1. ตรวจสอบว่า '123' (string) ถูกแปลงเป็น 123 (number)
      // 2. ตรวจสอบว่า DTO ถูกเปลี่ยนแปลง (เพิ่ม update_by)
      // 3. ตรวจสอบว่า userId ถูกส่งไปเป็น argument ที่ 3
      expect(service.update).toHaveBeenCalledWith(
        123, // id (number)
        expect.objectContaining({
          name: 'Updated Name',
          update_by: 1, // DTO ถูกแก้
        }),
        1, // userId
      );

      expect(result).toBe(mockResult);
    });
  });

  // ----------------------------------------
  //  Test: remove
  // ----------------------------------------
  describe('remove', () => {
    it('should call service.remove with numeric ID', async () => {
      const mockResult = { code: 1, message: 'Deleted' };
      service.remove.mockResolvedValue(mockResult);

      const result = await controller.remove('456');

      // ตรวจสอบว่า '456' (string) ถูกแปลงเป็น 456 (number)
      expect(service.remove).toHaveBeenCalledWith(456);
      expect(result).toBe(mockResult);
    });
  });
});