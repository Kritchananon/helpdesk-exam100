import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { MasterRoleController } from './master_role.controller';
import { MasterRoleService } from './master_role.service';
import { CreateMasterRoleDto } from './dto/create-master_role.dto';
import { UpdateMasterRoleDto } from './dto/update-master_role.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { HttpStatus } from '@nestjs/common';

// Mock Decorator (ยังคงเดิม เพราะ Decorator ทำงานตอน compile)
jest.mock('../permission/permission.decorator', () => ({
  RequireAnyAction: () => () => {},
}));

describe('MasterRoleController', () => {
  let controller: MasterRoleController;
  let service: MasterRoleService;

  const mockMasterRole = {
    id: 1,
    role_name: 'test_role',
    userRole: [],
    userAllowRole: [],
  };

  const mockMasterRoleService = {
    create: jest.fn(),
    getAllRoles: jest.fn(),
    findOne: jest.fn(),
    findByName: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MasterRoleController],
      providers: [
        {
          provide: MasterRoleService,
          useValue: mockMasterRoleService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true }) // Mock JwtAuthGuard
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true }) // Mock PermissionGuard
      .compile();

    controller = module.get<MasterRoleController>(MasterRoleController);
    service = module.get<MasterRoleService>(MasterRoleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new role and return it', async () => {
      const createDto: CreateMasterRoleDto = { role_name: 'test_role' };
      const result = { id: 1, ...createDto };
      mockMasterRoleService.create.mockResolvedValue(result);

      expect(await controller.create(createDto)).toBe(result);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of all roles', async () => {
      const result = [mockMasterRole];
      mockMasterRoleService.getAllRoles.mockResolvedValue(result);

      expect(await controller.findAll()).toBe(result);
      expect(service.getAllRoles).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single role by ID', async () => {
      const roleId = 1;
      mockMasterRoleService.findOne.mockResolvedValue(mockMasterRole);

      expect(await controller.findOne(roleId)).toBe(mockMasterRole);
      expect(service.findOne).toHaveBeenCalledWith(roleId);
    });
  });

  describe('findByName', () => {
    it('should return a single role by name', async () => {
      const roleName = 'test_role';
      mockMasterRoleService.findByName.mockResolvedValue(mockMasterRole);

      expect(await controller.findByName(roleName)).toBe(mockMasterRole);
      expect(service.findByName).toHaveBeenCalledWith(roleName);
    });
  });

  describe('update', () => {
    it('should update a role and return the updated role', async () => {
      const roleId = 1;
      const updateDto: UpdateMasterRoleDto = { role_name: 'updated_role' };
      const result = { ...mockMasterRole, ...updateDto };
      mockMasterRoleService.update.mockResolvedValue(result);

      expect(await controller.update(roleId, updateDto)).toBe(result);
      expect(service.update).toHaveBeenCalledWith(roleId, updateDto);
    });
  });

  describe('remove', () => {
    it('should remove a role and return nothing (void)', async () => {
      const roleId = 1;
      mockMasterRoleService.remove.mockResolvedValue(undefined);

      expect(await controller.remove(roleId)).toBeUndefined();
      expect(service.remove).toHaveBeenCalledWith(roleId);
    });
  });
});