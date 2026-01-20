import { Test, TestingModule } from '@nestjs/testing';
import { UserAllowRoleService } from './user_allow_role.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserAllowRole } from './entities/user_allow_role.entity';
import { MasterRole } from '../master_role/entities/master_role.entity';
import { Users } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserAllowRoleDto } from './dto/create-user_allow_role.dto';

describe('UserAllowRoleService', () => {
  let service: UserAllowRoleService;
  let userAllowRoleRepository: Repository<UserAllowRole>;
  let masterRoleRepository: Repository<MasterRole>;

  const mockUser: Users = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    firstname: 'Test',
    lastname: 'User',
    password: 'test123',
    phone: '0123456789',
    create_date: new Date(),
    create_by: 1,
    update_date: new Date(),
    update_by: 1,
    isenabled: true,
    customerProjects: [],
    role: [],  // relation กับ MasterRole
    userAllowRoles: [],
  };

  const mockMasterRole: MasterRole = {
    id: 1,
    role_name: 'แจ้งปัญหา',
    userRole: [],        // relation กับ UserAllowRole
    userAllowRole: [],   // relation กับ Users
  };

  const mockUserAllowRole: UserAllowRole = {
    user_id: 1,
    role_id: 1,
    user: mockUser,
    role: mockMasterRole,
  };

  const mockUserAllowRoleRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockMasterRoleRepository = {
    findBy: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAllowRoleService,
        {
          provide: getRepositoryToken(UserAllowRole),
          useValue: mockUserAllowRoleRepository,
        },
        {
          provide: getRepositoryToken(MasterRole),
          useValue: mockMasterRoleRepository,
        },
      ],
    }).compile();

    service = module.get<UserAllowRoleService>(UserAllowRoleService);
    userAllowRoleRepository = module.get<Repository<UserAllowRole>>(
      getRepositoryToken(UserAllowRole),
    );
    masterRoleRepository = module.get<Repository<MasterRole>>(
      getRepositoryToken(MasterRole),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });


  describe('create', () => {
    const createDto: CreateUserAllowRoleDto = {
      user_id: 1,
      role_id: [1, 2],
    };

    it('should create user role assignments successfully', async () => {
      const mockRoles = [
        { id: 1, role_name: 'แจ้งปัญหา' },
        { id: 2, role_name: 'แก้ไขปัญหา' },
      ];
      const mockExistingRoles = [];
      const mockNewAssignments = [
        { user_id: 1, role_id: 1 },
        { user_id: 1, role_id: 2 },
      ];

      mockMasterRoleRepository.findBy.mockResolvedValue(mockRoles);
      mockUserAllowRoleRepository.find.mockResolvedValue(mockExistingRoles);
      mockUserAllowRoleRepository.create.mockImplementation((data) => data);
      mockUserAllowRoleRepository.save.mockResolvedValue(mockNewAssignments);
      jest.spyOn(service, 'findByUserId').mockResolvedValue([mockUserAllowRole]);

      const result = await service.create(createDto);

      expect(mockMasterRoleRepository.findBy).toHaveBeenCalledWith({
        id: expect.objectContaining({ _type: 'in', _value: [1, 2] }),
      });
      expect(mockUserAllowRoleRepository.save).toHaveBeenCalled();
      expect(result).toEqual([mockUserAllowRole]);
    });

    it('should throw NotFoundException if roles not found', async () => {
      mockMasterRoleRepository.findBy.mockResolvedValue([]);

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockMasterRoleRepository.findBy).toHaveBeenCalled();
    });

    it('should throw ConflictException if all roles already assigned', async () => {
      const mockRoles = [
        { id: 1, role_name: 'Admin' },
        { id: 2, role_name: 'User' },
      ];
      const mockExistingRoles = [
        { user_id: 1, role_id: 1 },
        { user_id: 1, role_id: 2 },
      ];

      mockMasterRoleRepository.findBy.mockResolvedValue(mockRoles);
      mockUserAllowRoleRepository.find.mockResolvedValue(mockExistingRoles);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should create only new role assignments', async () => {
      const mockRoles = [
        { id: 1, role_name: 'แจ้งปัญหา' },
        { id: 2, role_name: 'แก้ไขปัญหา' },
      ];
      const mockExistingRoles = [{ user_id: 1, role_id: 1 }];

      mockMasterRoleRepository.findBy.mockResolvedValue(mockRoles);
      mockUserAllowRoleRepository.find.mockResolvedValue(mockExistingRoles);
      mockUserAllowRoleRepository.create.mockImplementation((data) => data);
      mockUserAllowRoleRepository.save.mockResolvedValue([]);
      jest.spyOn(service, 'findByUserId').mockResolvedValue([mockUserAllowRole]);

      const result = await service.create(createDto);

      expect(mockUserAllowRoleRepository.create).toHaveBeenCalledWith({
        user_id: 1,
        role_id: 2,
      });
      expect(result).toEqual([mockUserAllowRole]);
    });
  });

  describe('findAll', () => {
    it('should return all user role assignments', async () => {
      const mockUserRoles = [mockUserAllowRole];
      mockUserAllowRoleRepository.find.mockResolvedValue(mockUserRoles);

      const result = await service.findAll();

      expect(mockUserAllowRoleRepository.find).toHaveBeenCalledWith({
        relations: ['role'],
      });
      expect(result).toEqual(mockUserRoles);
    });
  });

  describe('findByUserId', () => {
    it('should return user role assignments by user id', async () => {
      const mockUserRoles = [mockUserAllowRole];
      mockUserAllowRoleRepository.find.mockResolvedValue(mockUserRoles);

      const result = await service.findByUserId(1);

      expect(mockUserAllowRoleRepository.find).toHaveBeenCalledWith({
        where: { user_id: 1 },
        relations: ['role'],
      });
      expect(result).toEqual(mockUserRoles);
    });
  });

  describe('findByRoleId', () => {
    it('should return user role assignments by role id', async () => {
      const mockUserRoles = [mockUserAllowRole];
      mockMasterRoleRepository.findOne.mockResolvedValue(mockMasterRole);
      mockUserAllowRoleRepository.find.mockResolvedValue(mockUserRoles);

      const result = await service.findByRoleId(1);

      expect(mockMasterRoleRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(mockUserAllowRoleRepository.find).toHaveBeenCalledWith({
        where: { role_id: 1 },
        relations: ['role'],
      });
      expect(result).toEqual(mockUserRoles);
    });

    it('should throw NotFoundException if role not found', async () => {
      mockMasterRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.findByRoleId(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findOne', () => {
    it('should return specific user role assignment', async () => {
      mockUserAllowRoleRepository.findOne.mockResolvedValue(mockUserAllowRole);

      const result = await service.findOne(1, 1);

      expect(mockUserAllowRoleRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 1, role_id: 1 },
        relations: ['role'],
      });
      expect(result).toEqual(mockUserAllowRole);
    });

    it('should throw NotFoundException if assignment not found', async () => {
      mockUserAllowRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove user role assignment successfully', async () => {
      mockUserAllowRoleRepository.findOne.mockResolvedValue(mockUserAllowRole);
      mockUserAllowRoleRepository.remove.mockResolvedValue(mockUserAllowRole);

      await service.remove(1, 1);

      expect(mockUserAllowRoleRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 1, role_id: 1 },
      });
      expect(mockUserAllowRoleRepository.remove).toHaveBeenCalledWith(
        mockUserAllowRole,
      );
    });

    it('should throw NotFoundException if assignment not found', async () => {
      mockUserAllowRoleRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeMultiple', () => {
    it('should remove multiple user role assignments successfully', async () => {
      const mockUserRoles = [mockUserAllowRole];
      mockUserAllowRoleRepository.find.mockResolvedValue(mockUserRoles);
      mockUserAllowRoleRepository.remove.mockResolvedValue(mockUserRoles);

      await service.removeMultiple(1, [1, 2]);

      expect(mockUserAllowRoleRepository.find).toHaveBeenCalledWith({
        where: {
          user_id: 1,
          role_id: expect.objectContaining({ _type: 'in', _value: [1, 2] }),
        },
      });
      expect(mockUserAllowRoleRepository.remove).toHaveBeenCalledWith(
        mockUserRoles,
      );
    });

    it('should throw NotFoundException if no assignments found', async () => {
      mockUserAllowRoleRepository.find.mockResolvedValue([]);

      await expect(service.removeMultiple(1, [999])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeAllByUserId', () => {
    it('should remove all user role assignments by user id', async () => {
      mockUserAllowRoleRepository.delete.mockResolvedValue({ affected: 2 });

      await service.removeAllByUserId(1);

      expect(mockUserAllowRoleRepository.delete).toHaveBeenCalledWith({
        user_id: 1,
      });
    });
  });

  describe('removeAllByRoleId', () => {
    it('should remove all user role assignments by role id', async () => {
      mockUserAllowRoleRepository.delete.mockResolvedValue({ affected: 3 });

      await service.removeAllByRoleId(1);

      expect(mockUserAllowRoleRepository.delete).toHaveBeenCalledWith({
        role_id: 1,
      });
    });
  });

  describe('userHasRole', () => {
    it('should return true if user has role', async () => {
      mockUserAllowRoleRepository.findOne.mockResolvedValue(mockUserAllowRole);

      const result = await service.userHasRole(1, 1);

      expect(result).toBe(true);
      expect(mockUserAllowRoleRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 1, role_id: 1 },
      });
    });

    it('should return false if user does not have role', async () => {
      mockUserAllowRoleRepository.findOne.mockResolvedValue(null);

      const result = await service.userHasRole(1, 999);

      expect(result).toBe(false);
    });
  });

  describe('userHasAnyRole', () => {
    it('should return true if user has any of the roles', async () => {
      mockUserAllowRoleRepository.count.mockResolvedValue(1);

      const result = await service.userHasAnyRole(1, [1, 2]);

      expect(result).toBe(true);
      expect(mockUserAllowRoleRepository.count).toHaveBeenCalledWith({
        where: {
          user_id: 1,
          role_id: expect.objectContaining({ _type: 'in', _value: [1, 2] }),
        },
      });
    });

    it('should return false if user does not have any roles', async () => {
      mockUserAllowRoleRepository.count.mockResolvedValue(0);

      const result = await service.userHasAnyRole(1, [999]);

      expect(result).toBe(false);
    });
  });

  describe('userHasAllRoles', () => {
    it('should return true if user has all roles', async () => {
      mockUserAllowRoleRepository.count.mockResolvedValue(2);

      const result = await service.userHasAllRoles(1, [1, 2]);

      expect(result).toBe(true);
      expect(mockUserAllowRoleRepository.count).toHaveBeenCalledWith({
        where: {
          user_id: 1,
          role_id: expect.objectContaining({ _type: 'in', _value: [1, 2] }),
        },
      });
    });

    it('should return false if user does not have all roles', async () => {
      mockUserAllowRoleRepository.count.mockResolvedValue(1);

      const result = await service.userHasAllRoles(1, [1, 2]);

      expect(result).toBe(false);
    });
  });

  // แก้ไข test ให้ตรงกับค่าจริงในระบบ
  describe('getUserRoleNames', () => {
    it('should return user role names', async () => {
      const mockUserRoles = [
        {
          user_id: 1,
          role_id: 1,
          user: mockUser,
          role: { id: 1, role_name: 'แจ้งปัญหา' }, // แก้เป็นชื่อจริง
        },
        {
          user_id: 1,
          role_id: 2,
          user: mockUser,
          role: { id: 2, role_name: 'แก้ไขปัญหา' }, // แก้เป็นชื่อจริง
        },
      ];
      mockUserAllowRoleRepository.find.mockResolvedValue(mockUserRoles);

      const result = await service.getUserRoleNames(1);

      expect(result).toEqual(['แจ้งปัญหา', 'แก้ไขปัญหา']); // แก้ expectation
    });
  });

  describe('replaceUserRoles', () => {
    it('should replace user roles successfully', async () => {
      const mockResult = [mockUserAllowRole];
      jest.spyOn(service, 'removeAllByUserId').mockResolvedValue();
      jest.spyOn(service, 'create').mockResolvedValue(mockResult);

      const result = await service.replaceUserRoles(1, [1, 2]);

      expect(service.removeAllByUserId).toHaveBeenCalledWith(1);
      expect(service.create).toHaveBeenCalledWith({
        user_id: 1,
        role_id: [1, 2],
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getUsersByRole', () => {
    it('should return users by role', async () => {
      const mockUserAllowRoles = [
        {
          user_id: 1,
          role_id: 1,
          user: mockUser,
          role: mockMasterRole,
        },
      ];
      mockUserAllowRoleRepository.find.mockResolvedValue(mockUserAllowRoles);

      const result = await service.getUsersByRole(1);

      expect(result).toEqual([mockUser]);
      expect(mockUserAllowRoleRepository.find).toHaveBeenCalledWith({
        where: { role_id: 1 },
        relations: ['user'],
      });
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});