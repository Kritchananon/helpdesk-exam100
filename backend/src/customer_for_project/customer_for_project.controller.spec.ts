// customer_for_project.controller.spec.ts (FIXED)

import { Test, TestingModule } from '@nestjs/testing';
import { CustomerForProjectController } from './customer_for_project.controller';
import { CustomerForProjectService } from './customer_for_project.service';
import { CreateCustomerForProjectDto } from './dto/create-customer_for_project.dto';
import { UpdateCustomerForProjectDto } from './dto/update-customer_for_project.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard'; // NEW: Import guard
import { PermissionGuard } from '../permission/permission.guard'; // NEW: Import guard
import { ParseIntPipe } from '@nestjs/common';

// NEW: สร้าง Type สำหรับ Mock Service ให้ชัดเจน
type MockCustomerForProjectService = {
  create: jest.Mock;
  getCFPdata: jest.Mock;
  getProjectsByCustomer: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
  // เพิ่ม method อื่นๆ ที่มีใน service
  findAllByUser: jest.Mock;
  findOne: jest.Mock;
  changeUserAssignment: jest.Mock;
  getUsersByCustomer: jest.Mock;
  getCustomerProjectsByUser: jest.Mock;
};

describe('CustomerForProjectController', () => {
  let controller: CustomerForProjectController;
  let service: MockCustomerForProjectService;

  const mockRequest = {
    user: {
      id: 1,
      sub: 1,
      userId: 1,
      username: 'testuser',
    },
  };

  // NEW: Mock Guards
  const mockJwtAuthGuard = { canActivate: jest.fn(() => true) };
  const mockPermissionGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    // NEW: สร้าง mock service ที่มี method ครบถ้วน
    const mockService: MockCustomerForProjectService = {
      create: jest.fn(),
      getCFPdata: jest.fn(),
      getProjectsByCustomer: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findAllByUser: jest.fn(),
      findOne: jest.fn(),
      changeUserAssignment: jest.fn(),
      getUsersByCustomer: jest.fn(),
      getCustomerProjectsByUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerForProjectController],
      providers: [
        {
          provide: CustomerForProjectService,
          useValue: mockService,
        },
      ],
    })
      // NEW: Override Guards ที่ใช้ใน Controller
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(PermissionGuard)
      .useValue(mockPermissionGuard)
      .compile();

    controller = module.get<CustomerForProjectController>(
      CustomerForProjectController,
    );
    service = module.get(CustomerForProjectService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ----------------------------------------
  //  Test: create
  // ----------------------------------------
  describe('create', () => {
    // CHANGED: อัปเดต DTO ให้ตรงกับไฟล์ create-customer_for_project.dto.ts
    const createDto: CreateCustomerForProjectDto = {
      customer_id: 1,
      project_id: 1,
      assigned_users: [{ user_id: 10 }], // CHANGED
      create_by: 0, // จะถูก override
      update_by: 0, // จะถูก override
    };

    const mockCreateResponse = {
      code: '2',
      status: true,
      message: 'สร้างข้อมูลสำเร็จ',
      data: [{ id: 1 }] as any,
    };

    it('should call service.create with mutated DTO', async () => {
      service.create.mockResolvedValue(mockCreateResponse);

      const result = await controller.create(createDto, mockRequest);

      // ตรวจสอบว่า DTO ที่ส่งไป service ถูกเติม create_by/update_by จาก req.user
      expect(service.create).toHaveBeenCalledWith({
        ...createDto,
        create_by: 1,
        update_by: 1,
      });
      expect(result).toEqual(mockCreateResponse);
    });

    it('should extract user id from request (fallback)', async () => {
      const requestWithSub = { user: { sub: 2 } };
      service.create.mockResolvedValue(mockCreateResponse);

      await controller.create(createDto, requestWithSub as any);

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          create_by: 2,
          update_by: 2,
        }),
      );
    });
  });

  // ----------------------------------------
  //  Test: getCFPdata (NEW)
  // ----------------------------------------
  describe('getCFPdata', () => {
    it('should call service.getCFPdata', async () => {
      const mockResponse = { status: 1, message: 'Success', data: [] };
      service.getCFPdata.mockResolvedValue(mockResponse);

      const result = await controller.getCFPdata();

      expect(service.getCFPdata).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockResponse);
    });
  });

  // ----------------------------------------
  //  Test: getProjectsByCustomer (CHANGED)
  // ----------------------------------------
  describe('getProjectsByCustomer', () => {
    it('should call service.getProjectsByCustomer with numeric ID', async () => {
      const mockResponse = { status: 1, message: 'Success', data: [] };
      // `id` ที่รับมาเป็น 1 (number) เพราะผ่าน ParseIntPipe
      service.getProjectsByCustomer.mockResolvedValue(mockResponse);

      const result = await controller.getProjectsByCustomer(1);

      expect(service.getProjectsByCustomer).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockResponse);
    });
  });

  // ----------------------------------------
  //  Test: update (CHANGED)
  // ----------------------------------------
  describe('update', () => {
    const updateDto: UpdateCustomerForProjectDto = {
      project_id: 2,
    };

    it('should call service.update with numeric ID and mutated DTO', async () => {
      const mockResponse = { status: 1, message: 'อัพเดทข้อมูลสำเร็จ' };
      service.update.mockResolvedValue(mockResponse);

      // `id` ที่รับมาเป็น 1 (number) เพราะผ่าน ParseIntPipe
      const result = await controller.update(1, updateDto, mockRequest);

      expect(service.update).toHaveBeenCalledWith(
        1, // id (number)
        expect.objectContaining({
          project_id: 2,
          create_by: 1, // DTO ถูกแก้
          update_by: 1, // DTO ถูกแก้
        }),
        1, // userId
      );
      expect(result).toEqual(mockResponse);
    });
  });

  // ----------------------------------------
  //  Test: remove (CHANGED)
  // ----------------------------------------
  describe('remove', () => {
    it('should call service.remove with numeric ID', async () => {
      const mockResponse = { status: 1, message: 'ลบข้อมูลสำเร็จ' };
      service.remove.mockResolvedValue(mockResponse);

      // `id` ที่รับมาเป็น 1 (number) เพราะผ่าน ParseIntPipe
      const result = await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockResponse);
    });
  });
});