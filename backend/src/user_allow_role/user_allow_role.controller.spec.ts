import { Test, TestingModule } from '@nestjs/testing';
import { UserAllowRoleController } from './user_allow_role.controller';
import { UserAllowRoleService } from './user_allow_role.service';
import { CreateUserAllowRoleDto } from './dto/create-user_allow_role.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';

describe('UserAllowRoleController', () => {
  let controller: UserAllowRoleController;
  let service: UserAllowRoleService;

  const mockUserAllowRoleService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByUserId: jest.fn(),
    findByRoleId: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    removeMultiple: jest.fn(),
    removeAllByUserId: jest.fn(),
    removeAllByRoleId: jest.fn(),
    userHasRole: jest.fn(),
    userHasAnyRole: jest.fn(),
    userHasAllRoles: jest.fn(),
    getUserRoleNames: jest.fn(),
    replaceUserRoles: jest.fn(),
  };

  const mockUserAllowRole = {
    user_id: 1,
    role_id: 1,
    user: {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      firstname: 'Test',
      lastname: 'User',
    },
    role: {
      id: 1,
      role_name: 'Admin',
      role_description: 'Administrator role',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserAllowRoleController],
      providers: [
        {
          provide: UserAllowRoleService,
          useValue: mockUserAllowRoleService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<UserAllowRoleController>(UserAllowRoleController);
    service = module.get<UserAllowRoleService>(UserAllowRoleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create user role assignments successfully', async () => {
      const createDto: CreateUserAllowRoleDto = {
        user_id: 1,
        role_id: [1, 2],
      };
      const expectedResult = [mockUserAllowRole];

      mockUserAllowRoleService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('replaceUserRoles', () => {
    it('should replace user roles successfully', async () => {
      const userId = 1;
      const body = { role_ids: [1, 2] };
      const expectedResult = [mockUserAllowRole];

      mockUserAllowRoleService.replaceUserRoles.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.replaceUserRoles(userId, body);

      expect(service.replaceUserRoles).toHaveBeenCalledWith(userId, [1, 2]);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should return all user role assignments', async () => {
      const expectedResult = [mockUserAllowRole];
      mockUserAllowRoleService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findByUserId', () => {
    it('should return user role assignments by user id', async () => {
      const userId = 1;
      const expectedResult = [mockUserAllowRole];

      mockUserAllowRoleService.findByUserId.mockResolvedValue(expectedResult);

      const result = await controller.findByUserId(userId);

      expect(service.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findByRoleId', () => {
    it('should return user role assignments by role id', async () => {
      const roleId = 1;
      const expectedResult = [mockUserAllowRole];

      mockUserAllowRoleService.findByRoleId.mockResolvedValue(expectedResult);

      const result = await controller.findByRoleId(roleId);

      expect(service.findByRoleId).toHaveBeenCalledWith(roleId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return specific user role assignment', async () => {
      const userId = 1;
      const roleId = 1;

      mockUserAllowRoleService.findOne.mockResolvedValue(mockUserAllowRole);

      const result = await controller.findOne(userId, roleId);

      expect(service.findOne).toHaveBeenCalledWith(userId, roleId);
      expect(result).toEqual(mockUserAllowRole);
    });
  });

  describe('checkUserHasRole', () => {
    it('should return true if user has role', async () => {
      const userId = 1;
      const roleId = 1;

      mockUserAllowRoleService.userHasRole.mockResolvedValue(true);

      const result = await controller.checkUserHasRole(userId, roleId);

      expect(service.userHasRole).toHaveBeenCalledWith(userId, roleId);
      expect(result).toEqual({ hasRole: true });
    });

    it('should return false if user does not have role', async () => {
      const userId = 1;
      const roleId = 999;

      mockUserAllowRoleService.userHasRole.mockResolvedValue(false);

      const result = await controller.checkUserHasRole(userId, roleId);

      expect(service.userHasRole).toHaveBeenCalledWith(userId, roleId);
      expect(result).toEqual({ hasRole: false });
    });
  });

  describe('checkUserHasAnyRoles', () => {
    it('should return true if user has any of the roles', async () => {
      const userId = 1;
      const body = { role_ids: [1, 2] };

      mockUserAllowRoleService.userHasAnyRole.mockResolvedValue(true);

      const result = await controller.checkUserHasAnyRoles(userId, body);

      expect(service.userHasAnyRole).toHaveBeenCalledWith(userId, [1, 2]);
      expect(result).toEqual({ hasAnyRole: true });
    });

    it('should return false if user does not have any roles', async () => {
      const userId = 1;
      const body = { role_ids: [999] };

      mockUserAllowRoleService.userHasAnyRole.mockResolvedValue(false);

      const result = await controller.checkUserHasAnyRoles(userId, body);

      expect(service.userHasAnyRole).toHaveBeenCalledWith(userId, [999]);
      expect(result).toEqual({ hasAnyRole: false });
    });
  });

  describe('checkUserHasAllRoles', () => {
    it('should return true if user has all roles', async () => {
      const userId = 1;
      const body = { role_ids: [1, 2] };

      mockUserAllowRoleService.userHasAllRoles.mockResolvedValue(true);

      const result = await controller.checkUserHasAllRoles(userId, body);

      expect(service.userHasAllRoles).toHaveBeenCalledWith(userId, [1, 2]);
      expect(result).toEqual({ hasAllRoles: true });
    });

    it('should return false if user does not have all roles', async () => {
      const userId = 1;
      const body = { role_ids: [1, 2] };

      mockUserAllowRoleService.userHasAllRoles.mockResolvedValue(false);

      const result = await controller.checkUserHasAllRoles(userId, body);

      expect(service.userHasAllRoles).toHaveBeenCalledWith(userId, [1, 2]);
      expect(result).toEqual({ hasAllRoles: false });
    });
  });

  describe('getUserRoleNames', () => {
    it('should return user role names', async () => {
      const userId = 1;
      const expectedResult = ['Admin', 'User'];

      mockUserAllowRoleService.getUserRoleNames.mockResolvedValue(
        expectedResult,
      );

      const result = await controller.getUserRoleNames(userId);

      expect(service.getUserRoleNames).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('remove', () => {
    it('should remove user role assignment successfully', async () => {
      const userId = 1;
      const roleId = 1;

      mockUserAllowRoleService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(userId, roleId);

      expect(service.remove).toHaveBeenCalledWith(userId, roleId);
      expect(result).toBeUndefined();
    });
  });

  describe('removeMultiple', () => {
    it('should remove multiple user role assignments successfully', async () => {
      const userId = 1;
      const body = { role_ids: [1, 2] };

      mockUserAllowRoleService.removeMultiple.mockResolvedValue(undefined);

      const result = await controller.removeMultiple(userId, body);

      expect(service.removeMultiple).toHaveBeenCalledWith(userId, [1, 2]);
      expect(result).toBeUndefined();
    });
  });

  describe('removeAllByUserId', () => {
    it('should remove all user role assignments by user id', async () => {
      const userId = 1;

      mockUserAllowRoleService.removeAllByUserId.mockResolvedValue(undefined);

      const result = await controller.removeAllByUserId(userId);

      expect(service.removeAllByUserId).toHaveBeenCalledWith(userId);
      expect(result).toBeUndefined();
    });
  });

  describe('removeAllByRoleId', () => {
    it('should remove all user role assignments by role id', async () => {
      const roleId = 1;

      mockUserAllowRoleService.removeAllByRoleId.mockResolvedValue(undefined);

      const result = await controller.removeAllByRoleId(roleId);

      expect(service.removeAllByRoleId).toHaveBeenCalledWith(roleId);
      expect(result).toBeUndefined();
    });
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});