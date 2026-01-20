// customer_for_project.service.spec.ts (FIXED)

import { Test, TestingModule } from '@nestjs/testing';
import { CustomerForProjectService } from './customer_for_project.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CustomerForProject } from './entities/customer-for-project.entity';
import { Project } from '../project/entities/project.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Users } from '../users/entities/user.entity'; // NEW: Import Users
import { CreateCustomerForProjectDto } from './dto/create-customer_for_project.dto';
import { UpdateCustomerForProjectDto } from './dto/update-customer_for_project.dto';
import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

// NEW: สร้าง Type สำหรับ Mock Repository ให้ชัดเจน
type MockRepository<T = any> = {
  findOne: jest.Mock;
  findOneBy: jest.Mock;
  find: jest.Mock;
  findBy: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  createQueryBuilder: jest.Mock;
};

// NEW: Mock QueryBuilder
const mockQueryBuilder = {
  leftJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  setParameter: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  execute: jest.fn(),
};

describe('CustomerForProjectService', () => {
  let service: CustomerForProjectService;
  let cfpRepository: MockRepository<CustomerForProject>;
  let projectRepository: MockRepository<Project>;
  let customerRepository: MockRepository<Customer>;
  let userRepo: MockRepository<Users>; // NEW

  const mockProject = { id: 1, name: 'Test Project' } as any;
  const mockCustomer = { id: 1, name: 'Test Customer' } as any;
  const mockUser = { id: 1, firstname: 'Test', lastname: 'User' } as any;
  const mockCfpRecord = {
    id: 1,
    customerId: 1,
    projectId: 1,
    userId: 1,
    isenabled: true,
  } as any;

  beforeEach(async () => {
    // NEW: สร้าง mock repository functions
    const mockRepo = () => ({
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      find: jest.fn(),
      findBy: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerForProjectService,
        {
          provide: getRepositoryToken(CustomerForProject),
          useValue: mockRepo(),
        },
        { provide: getRepositoryToken(Project), useValue: mockRepo() },
        { provide: getRepositoryToken(Customer), useValue: mockRepo() },
        { provide: getRepositoryToken(Users), useValue: mockRepo() }, // NEW
      ],
    }).compile();

    service = module.get<CustomerForProjectService>(CustomerForProjectService);
    cfpRepository = module.get(getRepositoryToken(CustomerForProject));
    projectRepository = module.get(getRepositoryToken(Project));
    customerRepository = module.get(getRepositoryToken(Customer));
    userRepo = module.get(getRepositoryToken(Users)); // NEW

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ----------------------------------------
  //  Test: create (CHANGED)
  // ----------------------------------------
  describe('create', () => {
    // CHANGED: อัปเดต DTO
    const createDto: CreateCustomerForProjectDto = {
      customer_id: 1,
      project_id: 1,
      assigned_users: [{ user_id: 1 }, { user_id: 2 }],
      create_by: 1,
      update_by: 1,
    };

    it('should create new records for new users', async () => {
      projectRepository.findOneBy.mockResolvedValue(mockProject);
      customerRepository.findOneBy.mockResolvedValue(mockCustomer);

      // User 1: existing, User 2: new
      cfpRepository.findOne.mockResolvedValueOnce(mockCfpRecord); // User 1
      cfpRepository.findOne.mockResolvedValueOnce(null); // User 2

      const newRecord = { ...mockCfpRecord, id: 2, userId: 2 };
      cfpRepository.save.mockResolvedValue(newRecord);

      const result = await service.create(createDto);

      expect(projectRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(customerRepository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(cfpRepository.findOne).toHaveBeenCalledTimes(2);
      expect(cfpRepository.save).toHaveBeenCalledTimes(1); // บันทึกเฉพาะ user 2
      expect(cfpRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 2 }),
      );
      expect(result.code).toBe('2');
      expect(result.data).toEqual([newRecord]);
    });

    it('should return error if project not found', async () => {
      projectRepository.findOneBy.mockResolvedValue(null);
      const result = await service.create(createDto);
      expect(result.message).toBe('ไม่พบข้อมูลโปรเจค');
      expect(result.code).toBe('0');
    });

    it('should return error if customer not found', async () => {
      projectRepository.findOneBy.mockResolvedValue(mockProject);
      customerRepository.findOneBy.mockResolvedValue(null);
      const result = await service.create(createDto);
      expect(result.message).toBe('ไม่พบข้อมูลลูกค้า');
      expect(result.code).toBe('0');
    });
  });

  // ----------------------------------------
  //  Test: getCFPdata (NEW)
  // ----------------------------------------
  describe('getCFPdata', () => {
    it('should query and group data correctly', async () => {
      const mockRawData = [
        {
          project_id: 1,
          project_name: 'Project A',
          project_status: true,
          customer_id: 10,
          customer_name: 'Cust A',
          assigned_users: [{ user_id: 1, name: 'User 1' }],
          open_ticket_count: '2',
        },
        {
          project_id: 1,
          project_name: 'Project A',
          project_status: true,
          customer_id: 11,
          customer_name: 'Cust B',
          assigned_users: [{ user_id: 2, name: 'User 2' }],
          open_ticket_count: '1',
        },
      ];
      mockQueryBuilder.getRawMany.mockResolvedValue(mockRawData);

      const result = await service.getCFPdata();

      expect(customerRepository.createQueryBuilder).toHaveBeenCalledWith('c');
      expect(mockQueryBuilder.getRawMany).toHaveBeenCalled();
      expect(result.status).toBe(1);
      expect(result.data).toHaveLength(1); // ถูก group เหลือ 1 project
      expect(result.data[0].project_id).toBe(1);
      expect(result.data[0].customers).toHaveLength(2); // มี 2 customers
      expect(result.data[0].customers[0].customer_id).toBe(10);
      expect(result.data[0].customers[1].open_ticket_count).toBe(1);
    });
  });

  // ----------------------------------------
  //  Test: update (CHANGED)
  // ----------------------------------------
  describe('update', () => {
    const userId = 99; // User ที่ทำการ update

    it('should update assigned_users (add new, remove old)', async () => {
      const updateDto: UpdateCustomerForProjectDto = {
        assigned_users: [{ user_id: 2 }, { user_id: 3 }], // Add 2, 3
      };
      // Record หลักที่ต้องการอัปเดต
      const mainRecord = { ...mockCfpRecord, id: 1, projectId: 1, customerId: 1 };
      cfpRepository.findOneBy.mockResolvedValue(mainRecord);

      // User ที่มีอยู่เดิมในระบบ
      const existingRecords = [
        { ...mockCfpRecord, id: 1, userId: 1 }, // User 1 (จะถูกลบ)
        { ...mockCfpRecord, id: 2, userId: 2 }, // User 2 (ซ้ำ)
      ];
      cfpRepository.findBy.mockResolvedValue(existingRecords);

      // Mock user validation (สำหรับ user 3 ที่เป็น user ใหม่)
      userRepo.findOneBy.mockResolvedValue({ id: 3 }); // User 3 exists

      // Mock create/save (สำหรับ user 3)
      const newRecord = { ...mockCfpRecord, id: 3, userId: 3 };
      cfpRepository.create.mockReturnValue(newRecord);
      cfpRepository.save.mockResolvedValue(newRecord);

      // Mock query builder (สำหรับ soft delete user 1)
      mockQueryBuilder.execute.mockResolvedValue({ affected: 1 });
      cfpRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Mock findBy (สำหรับดึงข้อมูลล่าสุด)
      cfpRepository.findBy.mockResolvedValueOnce(existingRecords) // ตอนหา existing
        .mockResolvedValueOnce([ // ตอนดึงข้อมูลล่าสุด (หลัง update)
          { ...mockCfpRecord, id: 2, userId: 2 },
          { ...mockCfpRecord, id: 3, userId: 3 },
        ]);

      const result = await service.update(1, updateDto, userId);

      // 1. Validate user ใหม่ (user 3)
      expect(userRepo.findOneBy).toHaveBeenCalledTimes(2); // <-- FIX 1
      expect(userRepo.findOneBy).toHaveBeenCalledWith({ id: 2 }); // <-- FIX 2
      expect(userRepo.findOneBy).toHaveBeenCalledWith({ id: 3 }); // <-- FIX 3

      // 2. Add user ใหม่ (user 3)
      expect(cfpRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 3, create_by: userId }),
      );
      expect(cfpRepository.save).toHaveBeenCalledWith(newRecord);

      // 3. Remove user เก่า (user 1)
      expect(cfpRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(mockQueryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({ isenabled: false, update_by: userId }),
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'projectId = :projectId',
        { projectId: 1 },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'customerId = :customerId',
        { customerId: 1 },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'userId IN (:...usersToRemove)',
        { usersToRemove: [1] },
      );
      expect(mockQueryBuilder.execute).toHaveBeenCalled();

      // 4. Check ผลลัพธ์
      expect(result.status).toBe(1);
      expect(result.data).toHaveLength(2); // User 2, 3
      expect(result.data.map(u => u.userId)).toEqual([2, 3]);
    });

    it('should throw error if user_id in DTO not found', async () => {
      const updateDto: UpdateCustomerForProjectDto = {
        assigned_users: [{ user_id: 999 }], // User 999 ไม่มีจริง
      };
      cfpRepository.findOneBy.mockResolvedValue(mockCfpRecord);
      cfpRepository.findBy.mockResolvedValue([]);
      userRepo.findOneBy.mockResolvedValue(null); // User 999 not found

      await expect(service.update(1, updateDto, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if record not found', async () => {
      cfpRepository.findOneBy.mockResolvedValue(null);
      await expect(service.update(999, {}, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ----------------------------------------
  //  Test: remove (CHANGED)
  // ----------------------------------------
  describe('remove', () => {
    it('should soft delete a single record', async () => {
      const record = { ...mockCfpRecord, isenabled: true };
      cfpRepository.findBy.mockResolvedValue([record]);
      
      const result = await service.remove(1);

      expect(cfpRepository.findBy).toHaveBeenCalledWith({
        id: In([1]),
        isenabled: true,
      });
      expect(cfpRepository.save).toHaveBeenCalledWith([
        { ...record, isenabled: false },
      ]);
      expect(result.status).toBe(1);
      expect(result.message).toContain('1 รายการ');
      expect(result.data!.deletedCount).toBe(1);
    });

    it('should soft delete multiple records (using array)', async () => {
      const records = [
        { ...mockCfpRecord, id: 1, isenabled: true },
        { ...mockCfpRecord, id: 2, isenabled: true },
      ];
      cfpRepository.findBy.mockResolvedValue(records);

      const result = await service.remove([1, 2]);

      expect(cfpRepository.findBy).toHaveBeenCalledWith({
        id: In([1, 2]),
        isenabled: true,
      });
      // ตรวจสอบว่า record ทั้งสองถูก isenabled = false
      const expectedSave = [
        { ...records[0], isenabled: false },
        { ...records[1], isenabled: false },
      ];
      expect(cfpRepository.save).toHaveBeenCalledWith(expectedSave);
      expect(result.status).toBe(1);
      expect(result.message).toContain('2 รายการ');
      expect(result.data!.deletedCount).toBe(2);
    });

    it('should return error if no records found', async () => {
      cfpRepository.findBy.mockResolvedValue([]);
      const result = await service.remove(999);
      expect(result.status).toBe(0);
      expect(result.message).toBe('ไม่พบข้อมูล');
    });
  });

  // ----------------------------------------
  //  Test: getProjectsByCustomer
  // ----------------------------------------
  describe('getProjectsByCustomer', () => {
    it('should return unique projects', async () => {
      const records = [
        { ...mockCfpRecord, id: 1, project: { id: 100, name: 'Project A' } },
        { ...mockCfpRecord, id: 2, project: { id: 100, name: 'Project A' } },
        { ...mockCfpRecord, id: 3, project: { id: 101, name: 'Project B' } },
      ];
      cfpRepository.find.mockResolvedValue(records);

      const result = await service.getProjectsByCustomer(1);

      expect(cfpRepository.find).toHaveBeenCalledWith({
        where: { customerId: 1, isenabled: true },
        relations: ['project'],
      });
      expect(result.status).toBe(1);
      expect(result.data).toHaveLength(2); // A, B (ไม่ซ้ำ)
      expect(result.data![0].project.name).toBe('Project A');
      expect(result.data![1].project.name).toBe('Project B');
    });
  });
});