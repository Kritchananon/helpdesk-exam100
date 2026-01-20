import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Request } from 'express';
import { PermissionGuard } from '../permission/permission.guard';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { AuthGuard } from '@nestjs/passport';
import { Users } from './entities/user.entity';
import { CreateUserAllowRoleDto } from '../user_allow_role/dto/create-user_allow_role.dto';

// --- Mock Data ---

const mockUser: Partial<Users> = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  firstname: 'Test',
  lastname: 'User',
  phone: '1234567890',
  isenabled: true,
  create_by: 1,
  update_by: 1,
};

const mockRequest = {
  user: {
    id: 1,
    username: 'testuser',
    roles: [1],
  },
} as unknown as Request;

// --- Mock Service ---

// สร้าง MockUserService ที่มี jest.fn() สำหรับทุก method ใน service ที่ controller เรียกใช้
const mockUserService = {
  create: jest.fn(),
  userAccount: jest.fn(),
  getAllUser: jest.fn(),
  getUserAccountById: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

// --- Test Suite ---

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService, // ใช้ mockUserService ที่เราสร้าง
        },
      ],
    })
      // Override Guards ทั้งหมดที่ Controller ใช้
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService); // ได้ตัว mock มา
  });

  // Reset mock หลังแต่ละ test
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- Test Cases for each method ---

  describe('create', () => {
    it('should create a new user with roles', async () => {
      const body = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        firstname: 'New',
        lastname: 'User',
        phone: '1234567890',
        role_id: [1, 2], // Role ที่ส่งมา
      };

      const expectedResult = {
        code: '1',
        message: 'บันทึกสำเร็จ',
        data: { ...mockUser, ...body, id: 2 },
      };

      // Mock service 'create'
      mockUserService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(body, mockRequest);

      // ตรวจสอบผลลัพธ์
      expect(result).toEqual(expectedResult);

      // ตรวจสอบว่า controller สร้าง DTOs ถูกต้องก่อนเรียก service
      const expectedCreateUserDto = {
        username: 'newuser',
        password: 'password123',
        email: 'newuser@example.com',
        firstname: 'New',
        lastname: 'User',
        phone: '1234567890',
        create_by: mockRequest.user!['id'],
        update_by: mockRequest.user!['id'],
      };

      const expectedCreateUserAllowRoleDto = {
        role_id: [1, 2],
      };

      // ตรวจสอบว่า service.create ถูกเรียกด้วย DTOs ที่ถูกต้อง
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining(expectedCreateUserDto),
        expect.objectContaining(expectedCreateUserAllowRoleDto),
      );
    });

    it('should create a new user without roles', async () => {
      const body = {
        username: 'newuser2',
        email: 'newuser2@example.com',
        password: 'password123',
        firstname: 'New',
        lastname: 'User',
        phone: '1234567890',
        role_id: [], // ไม่มี Role
      };

      const expectedResult = {
        code: '1',
        message: 'บันทึกสำเร็จ',
        data: { ...mockUser, ...body, id: 3 },
      };

      mockUserService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(body, mockRequest);

      expect(result).toEqual(expectedResult);

      // ตรวจสอบว่า service.create ถูกเรียกโดยมี createUserAllowRoleDto เป็น undefined
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ username: 'newuser2' }),
        undefined, // เพราะ role_id เป็น array ว่าง
      );
    });
  });

  describe('getUserAccount', () => {
    it('should return user account information', async () => {
      const mockAccountData = [{ id: 1, name: 'Test User' }];
      mockUserService.userAccount.mockResolvedValue(mockAccountData);

      const result = await controller.getUserAccount();

      expect(result).toEqual(mockAccountData);
      expect(service.userAccount).toHaveBeenCalled();
    });
  });

  describe('allUsers', () => {
    it('should return all users', async () => {
      const mockUsersList = [
        { id: 1, name: 'User One' },
        { id: 2, name: 'User Two' },
      ];
      mockUserService.getAllUser.mockResolvedValue(mockUsersList);

      const result = await controller.allUsers();

      expect(result).toEqual(mockUsersList);
      expect(service.getAllUser).toHaveBeenCalled();
    });
  });

  describe('getUserById', () => {
    it('should return a single user by id', async () => {
      const mockUserData = {
        code: 1,
        status: 'success',
        data: { id: 1, username: 'testuser' },
      };
      mockUserService.getUserAccountById.mockResolvedValue(mockUserData);

      const result = await controller.getUserById(1);

      expect(result).toEqual(mockUserData);
      expect(service.getUserAccountById).toHaveBeenCalledWith(1);
    });
  });

  describe('update', () => {
    it('should update a user successfully', async () => {
      const updateUserDto: UpdateUserDto = {
        firstname: 'Updated',
        lastname: 'User',
      };
      const expectedResult = {
        code: '1',
        message: 'อัปเดตสำเร็จ',
        data: { ...mockUser, firstname: 'Updated' },
      };

      mockUserService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(
        '1',
        updateUserDto,
        mockRequest,
      );

      expect(result).toEqual(expectedResult);

      // ตรวจสอบว่า controller ส่ง DTO ที่มีการเพิ่ม update_by และ create_by ไป
      expect(service.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          firstname: 'Updated',
          lastname: 'User',
          update_by: mockRequest.user!['id'],
          create_by: mockRequest.user!['id'], // ตาม logic ใน controller
        }),
      );
    });
  });

  describe('remove', () => {
    it('should remove a user successfully', async () => {
      const expectedResult = { code: '1', message: 'ลบข้อมูลสำเร็จ' };
      mockUserService.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove('1');

      expect(result).toEqual(expectedResult);
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});