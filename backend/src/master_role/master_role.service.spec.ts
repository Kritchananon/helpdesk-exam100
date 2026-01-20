import { Test, TestingModule } from '@nestjs/testing';
import { MasterRoleService } from './master_role.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MasterRole } from './entities/master_role.entity';
import { Repository } from 'typeorm'; // ObjectLiteral no longer needed
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateMasterRoleDto } from './dto/create-master_role.dto';
import { UpdateMasterRoleDto } from './dto/update-master_role.dto';
import { Users } from '../users/entities/user.entity';

// ===================================================================
//
// THIS IS THE CORRECTED SECTION
//
// ===================================================================

// We define a specific type for our mock repository.
// This lists *only* the methods we are mocking.
type MockMasterRoleRepository = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
};

// This function now returns the specific type.
const createMockRepository = (): MockMasterRoleRepository => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

// ===================================================================
//
// END OF CORRECTIONS
//
// ===================================================================

describe('MasterRoleService', () => {
  let service: MasterRoleService;
  // Use the new, specific type here
  let repo: MockMasterRoleRepository;

  const mockMasterRole = {
    id: 1,
    role_name: 'test_role',
    userRole: [],
    userAllowRole: [],
  } as MasterRole;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MasterRoleService,
        {
          provide: getRepositoryToken(MasterRole),
          useValue: createMockRepository(), // This provides the mock
        },
      ],
    }).compile();

    service = module.get<MasterRoleService>(MasterRoleService);
    repo = module.get(getRepositoryToken(MasterRole)); // We get the mock
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a new role', async () => {
      const createDto: CreateMasterRoleDto = { role_name: 'new_role' };
      const newRole = { id: 2, ...createDto } as MasterRole;

      // All '...is possibly undefined' errors are now gone
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(newRole);
      repo.save.mockResolvedValue(newRole);

      await expect(service.create(createDto)).resolves.toEqual(newRole);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { role_name: createDto.role_name },
      });
      expect(repo.create).toHaveBeenCalledWith(createDto);
      expect(repo.save).toHaveBeenCalledWith(newRole);
    });

    it('should throw ConflictException if role name already exists', async () => {
      const createDto: CreateMasterRoleDto = { role_name: 'test_role' };
      repo.findOne.mockResolvedValue(mockMasterRole);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return an array of roles with relations', async () => {
      const roles = [mockMasterRole];
      repo.find.mockResolvedValue(roles);
      await expect(service.findAll()).resolves.toEqual(roles);
      expect(repo.find).toHaveBeenCalledWith({ relations: ['userAllowRoles'] });
    });
  });

  describe('findOne', () => {
    it('should return a single role if found', async () => {
      repo.findOne.mockResolvedValue(mockMasterRole);
      await expect(service.findOne(1)).resolves.toEqual(mockMasterRole);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['userAllowRoles'],
      });
    });

    it('should throw NotFoundException if role not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should successfully update a role', async () => {
      const updateDto: UpdateMasterRoleDto = { role_name: 'updated_role' };
      const updatedRole = { ...mockMasterRole, ...updateDto };

      repo.findOne.mockResolvedValueOnce(mockMasterRole);
      repo.findOne.mockResolvedValueOnce(null);
      repo.save.mockResolvedValue(updatedRole);

      await expect(service.update(1, updateDto)).resolves.toEqual(updatedRole);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['userAllowRoles'],
      });
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { role_name: updateDto.role_name },
      });
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining(updateDto));
    });

    it('should throw ConflictException if updated role name already exists', async () => {
      const updateDto: UpdateMasterRoleDto = { role_name: 'existing_role' };
      const existingRole = { id: 2, role_name: 'existing_role' } as MasterRole;

      repo.findOne.mockResolvedValueOnce(mockMasterRole);
      repo.findOne.mockResolvedValueOnce(existingRole);

      await expect(service.update(1, updateDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException if role to update not found', async () => {
        const updateDto: UpdateMasterRoleDto = { role_name: 'updated_role' };
        repo.findOne.mockResolvedValueOnce(null);
  
        await expect(service.update(999, updateDto)).rejects.toThrow(
          NotFoundException,
        );
      });
  });

  describe('remove', () => {
    it('should successfully remove a role', async () => {
      const roleToRemove = { ...mockMasterRole, userAllowRole: [] }; // ไม่มี user
      repo.findOne.mockResolvedValue(roleToRemove);
      repo.remove.mockResolvedValue(roleToRemove);

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['userAllowRoles'],
      });
      expect(repo.remove).toHaveBeenCalledWith(roleToRemove);
    });

    it('should throw NotFoundException if role not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if role is assigned to users', async () => {
      const roleWithUsers = {
        ...mockMasterRole,
        userAllowRole: [{ id: 1 } as Users],
      };
      repo.findOne.mockResolvedValue(roleWithUsers);

      await expect(service.remove(1)).rejects.toThrow(ConflictException);
      expect(repo.remove).not.toHaveBeenCalled();
    });
  });

  describe('findByName', () => {
    it('should return a role by name', async () => {
      repo.findOne.mockResolvedValue(mockMasterRole);
      await expect(service.findByName('test_role')).resolves.toEqual(
        mockMasterRole,
      );
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { role_name: 'test_role' },
      });
    });

    it('should throw NotFoundException if role not found by name', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findByName('non_existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAllRoles', () => {
    it('should return all roles ordered by ID', async () => {
      const roles = [mockMasterRole];
      repo.find.mockResolvedValue(roles);
      await expect(service.getAllRoles()).resolves.toEqual(roles);
      expect(repo.find).toHaveBeenCalledWith({ order: { id: 'ASC' } });
    });
  });

  describe('getRoleById', () => {
    it('should return a single role by ID', async () => {
      repo.findOne.mockResolvedValue(mockMasterRole);
      await expect(service.getRoleById(1)).resolves.toEqual(mockMasterRole);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should return null if role not found by ID', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.getRoleById(999)).resolves.toBeNull();
    });
  });
});