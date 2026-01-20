// auth.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Users } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt ทั้ง module
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  let service: AuthService;
  // สร้าง type-safe mocks สำหรับ dependencies
  let userRepository: jest.Mocked<Repository<Users>>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  // ข้อมูลจำลองสำหรับ user
  const mockUser: Users = {
    id: 1,
    username: 'testuser',
    password: 'hashedpassword',
  } as Users; // Cast as Users เพื่อให้ตรง type

  const mockUserWithoutPassword = {
    id: 1,
    username: 'testuser',
  };

  beforeEach(async () => {
    // สร้าง Mocks สำหรับแต่ละ function ที่เราจะใช้
    const mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      query: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(Users),
          useValue: mockUserRepository, // ใช้ mock repository
        },
        {
          provide: JwtService,
          useValue: mockJwtService, // ใช้ mock jwtService
        },
        {
          provide: ConfigService,
          useValue: mockConfigService, // ใช้ mock configService
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    // ดึง mock instances มาเก็บไว้ในตัวแปร
    userRepository = module.get(getRepositoryToken(Users));
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // เคลียร์ mock calls ทุกครั้งหลังจบ test
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ----------------------------------------
  //  Test: register
  // ----------------------------------------
  describe('register', () => {
    const registerDto = {
      username: 'newuser',
      password: 'password123',
    };

    it('should register a new user successfully', async () => {
      // Setup mocks
      userRepository.findOne.mockResolvedValue(null); // ไม่พบ user ซ้ำ
      mockedBcrypt.hash.mockResolvedValue('hashedpassword' as never); // Mock การ hash
      userRepository.create.mockReturnValue(mockUser as any); // Mock การ create
      userRepository.save.mockResolvedValue(mockUser as any); // Mock การ save

      const result = await service.register(registerDto);

      // Assertions
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { username: registerDto.username },
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(userRepository.create).toHaveBeenCalledWith({
        username: registerDto.username,
        password: 'hashedpassword',
      });
      expect(userRepository.save).toHaveBeenCalled();
      expect(result).toEqual({
        code: 1,
        status: true,
        message: 'User registered successfully',
      });
    });

    it('should throw UnauthorizedException if username already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any); // พบ user ซ้ำ

      // Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.register(registerDto)).rejects.toThrow(
        'Username already exists',
      );
    });
  });

  // ----------------------------------------
  //  Test: validateUser
  // ----------------------------------------
  describe('validateUser', () => {
    it('should return user data (without password) when credentials are valid', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(true as never); // Password ตรงกัน

      const result = await service.validateUser('testuser', 'password123');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        select: ['id', 'username', 'password'],
      });
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashedpassword',
      );
      expect(result).toEqual(mockUserWithoutPassword);
    });

    it('should return null when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null); // ไม่พบ user

      const result = await service.validateUser('nonexistent', 'password123');
      expect(userRepository.findOne).toHaveBeenCalled();
      expect(mockedBcrypt.compare).not.toHaveBeenCalled(); // ต้องไม่เรียก compare
      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);
      mockedBcrypt.compare.mockResolvedValue(false as never); // Password ไม่ตรง

      const result = await service.validateUser('testuser', 'wrongpassword');
      expect(userRepository.findOne).toHaveBeenCalled();
      expect(mockedBcrypt.compare).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  // ----------------------------------------
  //  Test: login
  // ----------------------------------------
  describe('login', () => {
    const mockPermissions = [1, 2, 3];

    beforeEach(() => {
      // Mock config และ dependencies ที่ login ใช้
      configService.get.mockImplementation((key: string) => {
        if (key === 'JWT_EXPIRES_IN') return '15m';
        return null;
      });
      jwtService.sign.mockReturnValue('mock-jwt-token');
      
      // Mock `getUserPermissions` ที่ถูกเรียกภายใน `login`
      // เราใช้ jest.spyOn เพราะมันเป็น method ใน service เดียวกัน
      jest
        .spyOn(service, 'getUserPermissions')
        .mockResolvedValue(mockPermissions);
    });

    it('should return login response successfully', async () => {
      const user = mockUserWithoutPassword;
      
      const result = await service.login(user);

      expect(jwtService.sign).toHaveBeenCalledWith({
        username: user.username,
        sub: user.id,
      });
      expect(service.getUserPermissions).toHaveBeenCalledWith(user.id);
      expect(result.code).toBe(1);
      expect(result.status).toBe(true);
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.permission).toEqual(mockPermissions);
      expect(result.user).toEqual(user);
      expect(result.expires_in).toBe('15m');
    });

    it('should return error response for null user data', async () => {
      const result = await service.login(null);
      expect(result.code).toBe(0);
      expect(result.message).toBe('Invalid user data');
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should return error response for user without id', async () => {
      const incompleteUser = { username: 'test' }; // ไม่มี id
      const result = await service.login(incompleteUser);
      expect(result.code).toBe(0);
      expect(result.message).toBe('Invalid user data');
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------
  //  Test: getUserPermissions
  // ----------------------------------------
  describe('getUserPermissions', () => {
    it('should return an array of role IDs', async () => {
      const mockRoles = [{ role_id: 1 }, { role_id: 2 }, { role_id: 3 }];
      userRepository.query.mockResolvedValue(mockRoles);

      const result = await service.getUserPermissions(1);

      expect(userRepository.query).toHaveBeenCalledTimes(1);
      expect(userRepository.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT role_id'), // เช็คว่า query ถูกต้อง
        [1],
      );
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return an empty array when no roles are found', async () => {
      userRepository.query.mockResolvedValue([]);
      const result = await service.getUserPermissions(1);
      expect(result).toEqual([]);
    });

    it('should return an empty array on database error', async () => {
      userRepository.query.mockRejectedValue(new Error('Database error'));
      const result = await service.getUserPermissions(1);
      expect(result).toEqual([]);
    });
  });

  // ----------------------------------------
  //  Test: validateToken
  // ----------------------------------------
  describe('validateToken', () => {
    let decoded: any; // 1. ประกาศ decoded ไว้ข้างนอก
    
    it('should validate token and return user', async () => {
      const mockDecoded = { sub: 1, username: 'testuser' };
      jwtService.verify.mockReturnValue(mockDecoded); // Mockการ verify
      userRepository.findOne.mockResolvedValue(mockUserWithoutPassword as any); // Mockการค้นหา user

      const result = await service.validateToken('valid-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        select: ['id', 'username'],
      });
      expect(result).toEqual(mockUserWithoutPassword);
    });

    it('should throw UnauthorizedException for expired token', async () => {
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';
      jwtService.verify.mockImplementation(() => {
        throw expiredError;
      });

      await expect(service.validateToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.validateToken('expired-token')).rejects.toThrow(
        'Token expired',
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      // ----------------------------------------------------
      //  👇 **เพิ่ม 2 บรรทัดนี้เข้าไปครับ** 👇
      const mockDecoded = { sub: 999, username: 'nonexistent' };
      jwtService.verify.mockReturnValue(mockDecoded);
      // ----------------------------------------------------

      userRepository.findOne.mockResolvedValue(null); // User ไม่พบ

      await expect(service.validateToken('valid-token')).rejects.toThrow(
        UnauthorizedException, // ควรเช็ค Type ด้วย
      );
      await expect(service.validateToken('valid-token')).rejects.toThrow(
        'User not found', // เช็ค Message
      );
    });
  });

  // ----------------------------------------
  //  Test: checkTokenExpiration
  // ----------------------------------------
  describe('checkTokenExpiration', () => {
    it('should return correct info for a valid token (30 mins left)', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 1800; // 30 นาที
      jwtService.decode.mockReturnValue({ exp: futureExp });

      const result = await service.checkTokenExpiration('valid-token');

      expect(result.isExpiring).toBe(false);
      expect(result.shouldRefresh).toBe(false);
      expect(result.minutesLeft).toBeGreaterThan(28); // เผื่อ delay
    });

    it('should return isExpiring=true (10 mins left)', async () => {
      const soonExp = Math.floor(Date.now() / 1000) + 600; // 10 นาที
      jwtService.decode.mockReturnValue({ exp: soonExp });

      const result = await service.checkTokenExpiration('expiring-token');

      expect(result.isExpiring).toBe(true);
      expect(result.shouldRefresh).toBe(false);
      expect(result.minutesLeft).toBeLessThanOrEqual(10);
    });

    it('should return shouldRefresh=true (4 mins left)', async () => {
      const refreshExp = Math.floor(Date.now() / 1000) + 240; // 4 นาที
      jwtService.decode.mockReturnValue({ exp: refreshExp });

      const result = await service.checkTokenExpiration('refresh-token');

      expect(result.isExpiring).toBe(true);
      expect(result.shouldRefresh).toBe(true);
      expect(result.minutesLeft).toBeLessThanOrEqual(4);
    });

    it('should return expired status when decode fails', async () => {
      jwtService.decode.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await service.checkTokenExpiration('invalid-token');

      expect(result.isExpiring).toBe(true);
      expect(result.shouldRefresh).toBe(true);
      expect(result.minutesLeft).toBe(0);
    });
  });
});