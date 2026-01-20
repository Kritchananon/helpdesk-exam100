// permission.guard.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { PermissionGuard } from './permission.guard';
import { PermissionService } from '../permission/permission.service';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest'; // library นี้ช่วยสร้าง mock ที่ซับซ้อนได้ง่าย

// ถ้าไม่ใช้ @golevelup/ts-jest สามารถสร้าง mock ExecutionContext เองได้
const createMockExecutionContext = (
  user: any,
  config: any,
): ExecutionContext => {
  const mockContext = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({
        user: user,
        params: { id: '123' }, // สำหรับ test allowOwner
        route: { path: '/ticket/123' },
      }),
    }),
  } as unknown as ExecutionContext;

  return mockContext;
};

// Mock PermissionService
const mockPermissionService = {
  getUserRoleIds: jest.fn(),
  hasAnyRole: jest.fn(),
  // Mock 'canXxx' functions ที่ guard เรียกใช้
  canCreateUser: jest.fn(),
  canReadUser: jest.fn(),
  canDeleteUser: jest.fn(),
};

// Mock Reflector
const mockReflector = {
  getAllAndOverride: jest.fn(),
};

describe('PermissionGuard', () => {
  let guard: PermissionGuard;

  beforeEach(async () => {
    // ปิด Logger ชั่วคราวตอนรัน test จะได้ไม่รก console
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);

    // รีเซ็ต mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if no permission config is found', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(null);
    const mockContext = createMockExecutionContext({ id: 1 }, null);
    
    const result = await guard.canActivate(mockContext);
    expect(result).toBe(true);
  });

  it('should deny access if no user is found in request', async () => {
    const config = { roles: [13] };
    mockReflector.getAllAndOverride.mockReturnValue(config);
    const mockContext = createMockExecutionContext(null, config); // ไม่มี user

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(false);
  });

  it('should deny access if no valid userId is found in user object', async () => {
    const config = { roles: [13] };
    const user = { username: 'test-user' }; // ไม่มี id, sub, userId
    mockReflector.getAllAndOverride.mockReturnValue(config);
    const mockContext = createMockExecutionContext(user, config);

    const result = await guard.canActivate(mockContext);
    expect(result).toBe(false);
  });
  
  it('should extract userId from user.id', async () => {
    const config = { roles: [1] };
    const user = { id: 123 };
    mockReflector.getAllAndOverride.mockReturnValue(config);
    mockPermissionService.getUserRoleIds.mockResolvedValue([1]);
    mockPermissionService.hasAnyRole.mockResolvedValue(true);
    const mockContext = createMockExecutionContext(user, config);

    await guard.canActivate(mockContext);
    expect(mockPermissionService.getUserRoleIds).toHaveBeenCalledWith(123);
  });
  
  it('should extract userId from user.sub (string)', async () => {
    const config = { roles: [1] };
    const user = { sub: '456' }; // test string id
    mockReflector.getAllAndOverride.mockReturnValue(config);
    mockPermissionService.getUserRoleIds.mockResolvedValue([1]);
    mockPermissionService.hasAnyRole.mockResolvedValue(true);
    const mockContext = createMockExecutionContext(user, config);

    await guard.canActivate(mockContext);
    expect(mockPermissionService.getUserRoleIds).toHaveBeenCalledWith(456); // ควรถูกแปลงเป็น number
  });

  describe('Role-Based Checks', () => {
    it('should allow access if user has the required role', async () => {
      const config = { roles: [13] }; // ต้องการ ADMIN
      const user = { id: 1 };
      mockReflector.getAllAndOverride.mockReturnValue(config);
      const mockContext = createMockExecutionContext(user, config);
      
      mockPermissionService.getUserRoleIds.mockResolvedValue([13, 19]); // User มี ADMIN, SUPERVISOR
      mockPermissionService.hasAnyRole.mockResolvedValue(true);

      const result = await guard.canActivate(mockContext);
      
      expect(result).toBe(true);
      expect(mockPermissionService.hasAnyRole).toHaveBeenCalledWith(1, [13], [13, 19]);
    });

    it('should deny access if user does not have the required role', async () => {
      const config = { roles: [13] }; // ต้องการ ADMIN
      const user = { id: 2 };
      mockReflector.getAllAndOverride.mockReturnValue(config);
      const mockContext = createMockExecutionContext(user, config);
      
      mockPermissionService.getUserRoleIds.mockResolvedValue([1, 3]); // User มีแค่ USER, UPDATER
      mockPermissionService.hasAnyRole.mockResolvedValue(false);

      const result = await guard.canActivate(mockContext);
      
      expect(result).toBe(false);
    });
  });

  describe('Action-Based Checks', () => {
    it('should allow access for a single action', async () => {
      const config = { action: 'create_user' };
      const user = { id: 1 };
      mockReflector.getAllAndOverride.mockReturnValue(config);
      const mockContext = createMockExecutionContext(user, config);

      mockPermissionService.getUserRoleIds.mockResolvedValue([15]);
      mockPermissionService.canCreateUser.mockResolvedValue(true); // Mock service logic

      const result = await guard.canActivate(mockContext);
      
      expect(result).toBe(true);
      expect(mockPermissionService.canCreateUser).toHaveBeenCalledWith(1, [15]);
    });

    it('should allow access for multiple actions (OR logic)', async () => {
      const config = { actions: ['create_user', 'delete_user'], logicType: 'OR' };
      const user = { id: 1 };
      mockReflector.getAllAndOverride.mockReturnValue(config);
      const mockContext = createMockExecutionContext(user, config);

      mockPermissionService.getUserRoleIds.mockResolvedValue([15]); // มีสิทธิ์แค่ Role 15 (create)
      mockPermissionService.canCreateUser.mockResolvedValue(true);
      mockPermissionService.canDeleteUser.mockResolvedValue(false); // ไม่มีสิทธิ์ Role 16 (delete)

      const result = await guard.canActivate(mockContext);
      
      expect(result).toBe(true); // เพราะเป็น OR
    });

    it('should deny access for multiple actions (AND logic)', async () => {
      const config = { actions: ['create_user', 'delete_user'], logicType: 'AND' };
      const user = { id: 1 };
      mockReflector.getAllAndOverride.mockReturnValue(config);
      const mockContext = createMockExecutionContext(user, config);

      mockPermissionService.getUserRoleIds.mockResolvedValue([15]); // มีสิทธิ์แค่ Role 15 (create)
      mockPermissionService.canCreateUser.mockResolvedValue(true);
      mockPermissionService.canDeleteUser.mockResolvedValue(false); // ไม่มีสิทธิ์ Role 16 (delete)

      const result = await guard.canActivate(mockContext);
      
      expect(result).toBe(false); // เพราะเป็น AND
    });

    it('should deny access if action method is not found', async () => {
      const config = { action: 'non_existent_action' }; // action ที่ไม่มีใน actionMap
      const user = { id: 1 };
      mockReflector.getAllAndOverride.mockReturnValue(config);
      const mockContext = createMockExecutionContext(user, config);
      mockPermissionService.getUserRoleIds.mockResolvedValue([1]);

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(false);
    });
  });
  
  describe('Error Handling', () => {
    it('should deny access if PermissionService throws an error', async () => {
      const config = { roles: [1] };
      const user = { id: 1 };
      mockReflector.getAllAndOverride.mockReturnValue(config);
      const mockContext = createMockExecutionContext(user, config);
      
      // บังคับให้เกิด error
      mockPermissionService.getUserRoleIds.mockRejectedValue(new Error('DB Connection Error'));
      
      const result = await guard.canActivate(mockContext);
      expect(result).toBe(false);
    });
  });
});