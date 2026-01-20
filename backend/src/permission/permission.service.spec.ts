// permission.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { PermissionService, UserPermissionInfo } from './permission.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { MasterRole } from '../master_role/entities/master_role.entity';
import { Users } from '../users/entities/user.entity';
import { DataSource, Repository, ObjectLiteral } from 'typeorm';

// สร้าง Mock Repositories
type MockRepository<T extends ObjectLiteral = ObjectLiteral> = Partial<Record<keyof Repository<T>, jest.Mock>>;
const createMockRepository = (): MockRepository => ({});

// สร้าง Mock DataSource
const mockDataSource = {
  query: jest.fn(),
};

// ตัวอย่างข้อมูลที่ query คืนค่า
const mockDbResult = [
  { user_id: 1, username: 'admin', role_id: 13, role_name: 'ADMIN' },
  { user_id: 1, username: 'admin', role_id: 19, role_name: 'SUPERVISOR' },
];

const mockUserResult: UserPermissionInfo = {
  userId: 1,
  username: 'admin',
  roles: [
    { roleId: 13, roleName: 'ADMIN' },
    { roleId: 19, roleName: 'SUPERVISOR' },
  ],
  permissions: [
    { permissionId: 13, permissionName: 'ADMIN' },
    { permissionId: 19, permissionName: 'SUPERVISOR' },
  ],
};

describe('PermissionService', () => {
  let service: PermissionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: getRepositoryToken(UserAllowRole),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(MasterRole),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Users),
          useValue: createMockRepository(),
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
    
    // รีเซ็ต mocks ก่อนทุกการทดสอบ
    mockDataSource.query.mockClear();
    service.clearAllCache();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserPermissionInfo', () => {
    it('should fetch user info and roles from DB', async () => {
      mockDataSource.query.mockResolvedValue(mockDbResult);

      const result = await service.getUserPermissionInfo(1);

      expect(result).toEqual(mockUserResult);
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.any(String), // ตรวจสอบแค่ว่ามีการเรียก query
        [1], // ตรวจสอบว่าเรียกด้วย userId ที่ถูกต้อง
      );
    });

    it('should use cache on subsequent calls', async () => {
      mockDataSource.query.mockResolvedValue(mockDbResult);

      // ครั้งที่ 1: ดึงจาก DB
      const result1 = await service.getUserPermissionInfo(1);
      expect(result1).toEqual(mockUserResult);
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);

      // ครั้งที่ 2: ควรดึงจาก Cache
      const result2 = await service.getUserPermissionInfo(1);
      expect(result2).toEqual(mockUserResult);
      // query ไม่ควรถูกเรียกอีก
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
    });

    it('should fetch from DB again after cache is cleared', async () => {
      mockDataSource.query.mockResolvedValue(mockDbResult);

      // ครั้งที่ 1: ดึงจาก DB (Cache ถูกสร้าง)
      await service.getUserPermissionInfo(1);
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearUserCache(1);

      // ครั้งที่ 2: ควรดึงจาก DB อีกครั้ง
      await service.getUserPermissionInfo(1);
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
    });

    it('should return null if user not found', async () => {
      mockDataSource.query.mockResolvedValue([]); // DB ไม่คืนอะไรเลย
      const result = await service.getUserPermissionInfo(999);
      expect(result).toBeNull();
    });
  });

  describe('Permission Checks (canXxx)', () => {
    const userPermissions = [1, 3, 13]; // User, Update Ticket, Admin

    it('canCreateTicket (Role 1) - should return true', async () => {
      const result = await service.canCreateTicket(1, userPermissions);
      expect(result).toBe(true);
    });

    it('canCreateUser (Role 15) - should return false', async () => {
      const result = await service.canCreateUser(1, userPermissions);
      expect(result).toBe(false);
    });

    it('canReadAllTickets (Role 13) - should return true', async () => {
      const result = await service.canReadAllTickets(1, userPermissions);
      expect(result).toBe(true);
    });

    it('canUpdateTicket (Role 3 or 19) - should return true (has Role 3)', async () => {
      const result = await service.canUpdateTicket(1, userPermissions);
      expect(result).toBe(true);
    });

    it('canDeleteTicket (Role 4 or 19) - should return false', async () => {
      const result = await service.canDeleteTicket(1, userPermissions);
      expect(result).toBe(false);
    });
  });

  describe('Role Checks (hasAnyRole / hasAllRoles)', () => {
    const userPermissions = [1, 3, 10];
    
    it('hasAnyRole - should return true if one role matches', async () => {
        const result = await service.hasAnyRole(1, [5, 10], userPermissions);
        expect(result).toBe(true);
    });

    it('hasAnyRole - should return false if no roles match', async () => {
        const result = await service.hasAnyRole(1, [5, 20], userPermissions);
        expect(result).toBe(false);
    });

    it('hasAllRoles - should return true if all roles match', async () => {
        const result = await service.hasAllRoles(1, [1, 10], userPermissions);
        expect(result).toBe(true);
    });

    it('hasAllRoles - should return false if one role is missing', async () => {
        const result = await service.hasAllRoles(1, [1, 3, 5], userPermissions);
        expect(result).toBe(false);
    });
  });
});