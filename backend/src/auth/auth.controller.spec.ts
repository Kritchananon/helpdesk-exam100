// auth.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt_auth.guard';

// Mock AuthService ทั้งหมด
const mockAuthService = {
  register: jest.fn(),
  validateUser: jest.fn(),
  login: jest.fn(),
  getUserPermissions: jest.fn(),
  checkTokenExpiration: jest.fn(),
  validateToken: jest.fn(),
};

// Mock JwtAuthGuard เพื่อให้ bypass ได้
const mockJwtAuthGuard = {
  canActivate: jest.fn(() => true), // อนุญาตให้ผ่าน Guard เสมอ
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<typeof mockAuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService, // ใช้ mock service
        },
      ],
    })
      .overrideGuard(JwtAuthGuard) // Override Guard ที่ใช้ @UseGuards
      .useValue(mockJwtAuthGuard) // ให้ใช้ mock guard แทน
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // เคลียร์ mocks หลังจบ test
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ----------------------------------------
  //  Test: register
  // ----------------------------------------
  describe('register', () => {
    it('should call authService.register and return the result', async () => {
      const registerDto = { username: 'newuser', password: 'password123' };
      const expectedResult = {
        code: 1,
        status: true,
        message: 'User registered successfully',
      };
      
      authService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(expectedResult);
    });
  });

  // ----------------------------------------
  //  Test: login
  // ----------------------------------------
  describe('login', () => {
    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'password123',
    };

    it('should login successfully with valid credentials', async () => {
      const mockUser = { id: 1, username: 'testuser' };
      const mockLoginResponse = {
        code: 1,
        status: true,
        message: 'Login successful',
        user: mockUser,
        access_token: 'mock-jwt-token',
        permission: [1, 2, 3],
      };

      // Mock chain: validateUser -> login
      authService.validateUser.mockResolvedValue(mockUser);
      authService.login.mockResolvedValue(mockLoginResponse as any);

      const result = await controller.login(loginDto);

      expect(authService.validateUser).toHaveBeenCalledWith(
        loginDto.username,
        loginDto.password,
      );
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockLoginResponse);
    });

    it('should return error response for invalid credentials', async () => {
      authService.validateUser.mockResolvedValue(null); // Mock validateUser ล้มเหลว

      const result = await controller.login(loginDto);

      expect(authService.validateUser).toHaveBeenCalledWith(
        loginDto.username,
        loginDto.password,
      );
      expect(authService.login).not.toHaveBeenCalled(); // ต้องไม่เรียก login
      expect(result).toEqual({
        code: 0,
        status: false,
        message: 'Invalid username or password',
        user: null,
        access_token: null,
      });
    });
  });

  // ----------------------------------------
  //  Test: getProfile
  // ----------------------------------------
  describe('getProfile', () => {
    it('should return user profile with permissions', async () => {
      const mockRequest = {
        user: { id: 1, username: 'testuser' }, // ข้อมูล user ที่ได้จาก Guard
      };
      const mockPermissions = [1, 2, 3];

      authService.getUserPermissions.mockResolvedValue(mockPermissions);

      const result = await controller.getProfile(mockRequest);

      expect(authService.getUserPermissions).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        code: 1,
        status: true,
        message: 'Profile retrieved successfully',
        user: mockRequest.user,
        permission: mockPermissions,
      });
    });
  });

  // ----------------------------------------
  //  Test: checkToken
  // ----------------------------------------
  describe('checkToken', () => {
    const authHeader = 'Bearer mock-jwt-token';
    const mockRequest = { user: { id: 1, username: 'testuser' } };
    const mockTokenInfo = {
      isExpiring: false,
      shouldRefresh: false,
      expiresAt: new Date('2024-01-01T12:00:00.000Z'),
      minutesLeft: 30,
    };
    const mockPermissions = [1, 2, 3];

    it('should return token status when token is valid', async () => {
      authService.checkTokenExpiration.mockResolvedValue(mockTokenInfo);
      authService.getUserPermissions.mockResolvedValue(mockPermissions);

      const result = await controller.checkToken(authHeader, mockRequest);

      expect(authService.checkTokenExpiration).toHaveBeenCalledWith('mock-jwt-token');
      expect(authService.getUserPermissions).toHaveBeenCalledWith(1);
      expect(result.code).toBe(1);
      expect(result.data.isValid).toBe(true);
      expect(result.data.user).toEqual(mockRequest.user);
    });

    it('should throw HttpException when service throws an error', async () => {
      authService.checkTokenExpiration.mockRejectedValue(new Error('Token expired'));

      // ทดสอบว่า controller catch error และ throw HttpException
      await expect(
        controller.checkToken(authHeader, mockRequest),
      ).rejects.toThrow(HttpException);
    });
  });

  // ----------------------------------------
  //  Test: logout
  // ----------------------------------------
  describe('logout', () => {
    it('should return logout success message', async () => {
      const result = await controller.logout();

      expect(result).toEqual({
        code: 1,
        status: true,
        message: 'Logout successful. Please remove token from client storage.',
        data: {
          instruction: 'Remove access_token from localStorage/sessionStorage',
        },
      });
    });
  });

  // ----------------------------------------
  //  Test: validateToken
  // ----------------------------------------
  describe('validateToken', () => {
    const token = 'mock-jwt-token';
    const mockUser = { id: 1, username: 'testuser' };
    const mockTokenInfo = {
      isExpiring: false,
      shouldRefresh: false,
      expiresAt: new Date('2024-01-01T12:00:00.000Z'),
      minutesLeft: 30,
    };
    const mockPermissions = [1, 2, 3];

    it('should validate token successfully', async () => {
      authService.validateToken.mockResolvedValue(mockUser as any);
      authService.checkTokenExpiration.mockResolvedValue(mockTokenInfo);
      authService.getUserPermissions.mockResolvedValue(mockPermissions);

      const result = await controller.validateToken(token);

      expect(authService.validateToken).toHaveBeenCalledWith(token);
      expect(authService.checkTokenExpiration).toHaveBeenCalledWith(token);
      expect(authService.getUserPermissions).toHaveBeenCalledWith(mockUser.id);
      expect(result.code).toBe(1);
      expect(result.message).toBe('Token is valid');
      expect(result.data.user).toEqual(mockUser);
    });

    it('should throw HttpException when token is missing', async () => {
      await expect(controller.validateToken('')).rejects.toThrow(HttpException);
      await expect(controller.validateToken('')).rejects.toThrow(
        'Token is required',
      );
    });

    it('should throw HttpException when token validation fails', async () => {
      authService.validateToken.mockRejectedValue(new Error('Token expired'));

      await expect(controller.validateToken(token)).rejects.toThrow(
        HttpException,
      );
      await expect(controller.validateToken(token)).rejects.toThrow(
        'Token expired',
      );
    });
  });
});