// customer.service.spec.ts (FIXED)

import { Test, TestingModule } from '@nestjs/testing';
import { CustomerService } from './customer.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

// ------------------------------------------------------------------
//  👇 **[FIX 1/1]** 👇
//  Changed this type from a generic 'Partial' to an explicit
//  shape. This guarantees the mocked methods exist, fixing all
//  'possibly 'undefined'' errors.
// ------------------------------------------------------------------
type MockRepository = {
  save: jest.Mock;
  findOneBy: jest.Mock;
  createQueryBuilder: jest.Mock;
};

describe('CustomerService', () => {
  let service: CustomerService;
  let customerRepository: MockRepository; // Type is now the explicit mock

  // ตัวแปรสำหรับ mock QueryBuilder
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getRawMany: jest.fn(),
  };

  const mockCustomer = {
    id: 1,
    name: 'Test Customer',
    address: '123 Test Street',
    telephone: '0123456789',
    email: 'test@example.com',
    create_by: 1,
    update_by: 1,
    isenabled: true,
  } as Customer;

  beforeEach(async () => {
    // This object shape already matches our new 'MockRepository' type
    const mockCustomerRepository = {
      save: jest.fn(),
      findOneBy: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        {
          provide: getRepositoryToken(Customer),
          useValue: mockCustomerRepository,
        },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
    customerRepository = module.get(getRepositoryToken(Customer));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ----------------------------------------
  //  Test: create
  // ----------------------------------------
  describe('create', () => {
    const createDto: CreateCustomerDto = {
      name: 'New Customer',
      address: '456 New Street',
      telephone: '0987654321',
      email: 'new@example.com',
      create_by: 1,
      update_by: 1,
      status: true,
    };
    const userId = 1;

    it('should create and save a new customer successfully', async () => {
      const savedCustomer = { ...mockCustomer, ...createDto, id: 2 };
      customerRepository.save.mockResolvedValue(savedCustomer);

      const result = await service.create(createDto, userId);

      expect(customerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Customer',
          address: '456 New Street',
          telephone: '0987654321',
          email: 'new@example.com',
          create_by: 1,
          update_by: 1,
          isenabled: true,
        }),
      );

      expect(result.code).toBe(1);
      expect(result.status).toBe(true);
      expect(result.message).toBe('เพิ่มข้อมูลลูกค้าสำเร็จ');
      expect(result.data.name).toBe('New Customer');
    });
  });

  // ... (rest of the tests are unchanged) ...

  // ----------------------------------------
  //  Test: getCustomer (QueryBuilder)
  // ----------------------------------------
  describe('getCustomer', () => {
    it('should return active customers data', async () => {
      const mockResult = [mockCustomer];
      mockQueryBuilder.getMany.mockResolvedValue(mockResult);

      const result = await service.getCustomer();

      expect(customerRepository.createQueryBuilder).toHaveBeenCalledWith('c');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'c.id',
        'c.name',
        'c.address',
        'c.email',
        'c.telephone',
        'c.status',
      ]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('isenabled = true');
      expect(mockQueryBuilder.getMany).toHaveBeenCalledTimes(1);

      expect(result.code).toBe(0); // Service คืน 0 เมื่อสำเร็จ
      expect(result.status).toBe(true);
      expect(result.data).toEqual(mockResult);
    });

    it('should return error object if query fails', async () => {
      const error = new Error('Database connection lost');
      mockQueryBuilder.getMany.mockRejectedValue(error);

      const result = await service.getCustomer();

      expect(result.code).toBe(1); // Service คืน 1 เมื่อ fail
      expect(result.status).toBe(false);
      expect(result.message).toBe(error);
    });
  });

  // ----------------------------------------
  //  Test: getAllCustomer (QueryBuilder)
  // ----------------------------------------
  describe('getAllCustomer', () => {
    it('should return customer id and name for dropdown', async () => {
      const mockRawResult = [{ id: 1, name: 'Test Customer' }];
      mockQueryBuilder.getRawMany.mockResolvedValue(mockRawResult);

      const result = await service.getAllCustomer();

      expect(customerRepository.createQueryBuilder).toHaveBeenCalledWith('c');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'c.id as id',
        'c.name as name',
      ]);
      expect(mockQueryBuilder.groupBy).toHaveBeenCalledWith('c.id');
      expect(mockQueryBuilder.getRawMany).toHaveBeenCalledTimes(1);

      expect(result.code).toBe(1);
      expect(result.status).toBe(true);
      expect(result.data).toEqual(mockRawResult);
    });

    it('should return error object if query fails', async () => {
      const error = new Error('Query failed');
      mockQueryBuilder.getRawMany.mockRejectedValue(error);

      const result = await service.getAllCustomer();

      expect(result.code).toBe(0);
      expect(result.status).toBe(false);
      expect(result.message).toBe('Failed to fetch all projects');
      expect(result.error).toBe(error.message);
    });
  });

  // ----------------------------------------
  //  Test: update
  // ----------------------------------------
  describe('update', () => {
    const updateDto: UpdateCustomerDto = {
      name: 'Updated Name',
      address: 'Updated Address',
    };
    const userId = 2;

    it('should update customer successfully', async () => {
      const existingCustomer = { ...mockCustomer, id: 1 };
      customerRepository.findOneBy.mockResolvedValue(existingCustomer);

      const updatedCustomer = {
        ...existingCustomer,
        ...updateDto,
        update_by: userId,
      };
      customerRepository.save.mockResolvedValue(updatedCustomer);

      const result = await service.update(1, updateDto, userId);

      expect(customerRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      // ตรวจสอบว่า save ถูกเรียกด้วย partial object ที่ถูกต้อง
      expect(customerRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          name: 'Updated Name',
          address: 'Updated Address',
          update_by: userId,
          update_date: expect.any(Date),
        }),
      );
      expect(result.code).toBe(1);
      expect(result.message).toBe('อัพเดตข้อมูลลูกค้าสำเร็จ');
      expect(result.data).toEqual(updatedCustomer);
    });

    it('should return error if customer not found', async () => {
      customerRepository.findOneBy.mockResolvedValue(null);

      const result = await service.update(999, updateDto, userId);

      expect(customerRepository.findOneBy).toHaveBeenCalledWith({ id: 999 });
      expect(customerRepository.save).not.toHaveBeenCalled();
      expect(result.code).toBe(0);
      expect(result.message).toBe('ไม่พบข้อมูลลูกค้า');
    });

    it('should return error if customer is disabled', async () => {
      const disabledCustomer = { ...mockCustomer, id: 1, isenabled: false };
      customerRepository.findOneBy.mockResolvedValue(disabledCustomer);

      const result = await service.update(1, updateDto, userId);

      expect(customerRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(customerRepository.save).not.toHaveBeenCalled();
      expect(result.code).toBe(0);
      expect(result.message).toBe('ไม่พบข้อมูลลูกค้า');
    });

    it('should return error if save fails', async () => {
      const existingCustomer = { ...mockCustomer, id: 1 };
      customerRepository.findOneBy.mockResolvedValue(existingCustomer);
      customerRepository.save.mockRejectedValue(new Error('DB Error'));

      const result = await service.update(1, updateDto, userId);

      expect(result.code).toBe(0);
      expect(result.message).toContain('เกิดข้อผิดพลาดในการอัพเดต');
    });
  });

  // ----------------------------------------
  //  Test: remove (Soft Delete)
  // ----------------------------------------
  describe('remove', () => {
    it('should soft delete customer successfully', async () => {
      const existingCustomer = { ...mockCustomer, id: 1, isenabled: true };
      customerRepository.findOneBy.mockResolvedValue(existingCustomer);
      customerRepository.save.mockResolvedValue({
        ...existingCustomer,
        isenabled: false,
      });

      const result = await service.remove(1);

      expect(customerRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      // ตรวจสอบว่า save ถูกเรียกด้วย object ที่ `isenabled` ถูกตั้งค่าเป็น false
      expect(customerRepository.save).toHaveBeenCalledWith({
        ...existingCustomer,
        isenabled: false,
      });
      expect(result.code).toBe(1);
      expect(result.message).toBe('ลบข้อมูลลูกค้าสำเร็จ');
    });

    it('should return error if customer not found', async () => {
      customerRepository.findOneBy.mockResolvedValue(null);

      const result = await service.remove(999);

      expect(customerRepository.findOneBy).toHaveBeenCalledWith({ id: 999 });
      expect(customerRepository.save).not.toHaveBeenCalled();
      expect(result.code).toBe(0);
      expect(result.message).toBe('ไม่พบข้อมูลลูกค้า');
    });

    it('should return error if customer is already disabled', async () => {
      const disabledCustomer = { ...mockCustomer, id: 1, isenabled: false };
      customerRepository.findOneBy.mockResolvedValue(disabledCustomer);

      const result = await service.remove(1);

      expect(customerRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(customerRepository.save).not.toHaveBeenCalled();
      expect(result.code).toBe(0);
      expect(result.message).toBe('ไม่พบข้อมูลลูกค้า');
    });
  });
});