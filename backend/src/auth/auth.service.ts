import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../users/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

interface AuthResponse {
  code: number;
  status: boolean;
  message: string;
  user: {
    id: number;
    username: string;
  } | null;
  access_token: string | null;
  expires_in?: string;
  expires_at?: string;
  token_expires_timestamp?: number; // เพิ่ม timestamp
  permission?: number[]; // เพิ่ม permission field
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Users)
    private userRepo: Repository<Users>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }

  async register(dto: { username: string; password: string }) {
    const existingUser = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existingUser) {
      throw new UnauthorizedException('Username already exists');
    }
    // เข้ารหัสรหัสผ่าน
    const hashed = await bcrypt.hash(dto.password, 10);
    // สร้างผู้ใช้ใหม่
    const newuser = this.userRepo.create({
      username: dto.username,
      password: hashed
    });

    await this.userRepo.save(newuser);

    return {
      code: 1,
      status: true,
      message: 'User registered successfully',
    };
  }

  async validateUser(username: string, password: string): Promise<any> {
    console.log('Attempting to validate user:', username);

    const user = await this.userRepo.findOne({
      where: { username: username },
      select: ['id', 'username', 'password']
    });

    if (!user) {
      console.log('User not found:', username);
      return null;
    }

    console.log('Found user ID:', user.id, 'Username:', user.username);

    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password validation result:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('Invalid password for user:', username);
      return null;
    }

    const { password: _, ...result } = user;
    console.log('Validation successful, returning user:', result);

    return result;
  }

// ใน auth.service.ts - แก้ไข login method (บรรทัดที่ 85-86)
async login(user: any): Promise<AuthResponse> {
  // เช็ค null ก่อน access properties
  if (!user) {
    console.log('Login failed: user is null or undefined');
    return {
      code: 0,
      status: false,
      message: 'Invalid user data',
      user: null,
      access_token: null
    };
  }

  console.log('Login processing for user:', user.username, 'ID:', user.id);
  
  if (!user.id || !user.username) {
    console.error('Invalid user object in login:', user);
    return {
      code: 0,
      status: false,
      message: 'Invalid user data',
      user: null,
      access_token: null
    };
  }
  
  // สร้าง JWT payload
  const payload = { 
    username: user.username, 
    sub: user.id,
  };

  console.log('JWT payload:', payload);
  
  const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '3h';
  console.log('Token will expire in:', expiresIn);
  
  // สร้าง access token
  const accessToken = this.jwtService.sign(payload);
  
  console.log('Generated token for user:', user.username);
  
  // คำนวณ expires_at สำหรับ frontend
  const expiresInSeconds = this.parseExpiresIn(expiresIn);
  const now = Math.floor(Date.now() / 1000);
  const expiresTimestamp = now + expiresInSeconds;
  
  // ดึง permissions ของ user
  const permissions = await this.getUserPermissions(user.id);
  
  return {
    code: 1,
    status: true,
    message: 'Login successful',
    user: {
      id: user.id,
      username: user.username,
    },
    access_token: accessToken,
    expires_in: expiresIn,
    expires_at: new Date(expiresTimestamp * 1000).toISOString(),
    token_expires_timestamp: expiresTimestamp,
    permission: permissions,
  };
}

  // เพิ่ม method สำหรับดึง permissions ของ user จาก database
  async getUserPermissions(userId: number): Promise<number[]> {
    try {
      // ใช้ raw query ดึง permissions จาก user_allow_role table
      const userRoles = await this.userRepo.query(`
        SELECT role_id 
        FROM users_allow_role 
        WHERE user_id = $1
      `, [userId]);

      if (!userRoles || userRoles.length === 0) {
        console.log(`No roles found for user ${userId}`);
        return [];
      }

      // ดึง role_id ออกมา
      const roleIds = userRoles.map(r => r.role_id);
      console.log(`User ${userId} has roles:`, roleIds);

      // return role_ids ที่เป็น permissions
      return roleIds;

    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  // Helper method สำหรับแปลง expires_in เป็น seconds
  private parseExpiresIn(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));

    switch (unit) {
      case 'h':
        return value * 60 * 60; // hours to seconds
      case 'm':
        return value * 60; // minutes to seconds
      case 's':
        return value; // seconds
      case 'd':
        return value * 24 * 60 * 60; // days to seconds
      default:
        return 3 * 60 * 60; // default 3 hours
    }
  }

  // เพิ่ม method สำหรับตรวจสอบ token
  async validateToken(token: string) {
    let decoded: any; // 1. ประกาศ decoded ไว้ข้างนอก

    // 2. try...catch บล็อกนี้ จะใช้สำหรับ 'verify' token เท่านั้น
    try {
      decoded = this.jwtService.verify(token);
    } catch (error) {
      // 2.1 ถ้า token หมดอายุ
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          message: 'Token expired',
          error: 'TOKEN_EXPIRED',
          statusCode: 401,
        });
      }
      // 2.2 ถ้า token ผิดรูปแบบ หรืออื่นๆ
      throw new UnauthorizedException('Invalid token');
    }

    // 3. ถ้า verify ผ่าน ค่อยมาหา user ข้างนอก
    const user = await this.userRepo.findOne({
      where: { id: decoded.sub },
      select: ['id', 'username'],
    });

    // 4. ถ้า user ไม่เจอ โยน Error (และมันจะไม่ถูก catch แล้ว)
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 5. ถ้าทุกอย่างถูกต้อง คืนค่า user
    return user;
  }

  // เพิ่ม method สำหรับตรวจสอบว่า token ใกล้หมดอายุหรือไม่
  async checkTokenExpiration(token: string): Promise<{
    isExpiring: boolean;
    expiresAt: Date;
    minutesLeft: number;
    shouldRefresh: boolean;
  }> {
    try {
      const decoded = this.jwtService.decode(token) as any;
      const expiresAt = new Date(decoded.exp * 1000);
      const now = new Date();
      const timeDiff = expiresAt.getTime() - now.getTime();
      const minutesLeft = Math.floor(timeDiff / (1000 * 60));

      return {
        isExpiring: minutesLeft <= 15, // เตือนเมื่อเหลือ 15 นาที
        expiresAt,
        minutesLeft,
        shouldRefresh: minutesLeft <= 5, // ควร refresh เมื่อเหลือ 5 นาที
      };
    } catch (error) {
      return {
        isExpiring: true,
        expiresAt: new Date(),
        minutesLeft: 0,
        shouldRefresh: true,
      };
    }
  }
} 