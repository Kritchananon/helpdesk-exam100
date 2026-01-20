import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    console.log('JwtAuthGuard.handleRequest called with:', { err, user, info });

    // ตรวจสอบ TOKEN EXPIRED
    if (info && info.name === 'TokenExpiredError') {
      console.log('Token has expired:', info.message);
      throw new UnauthorizedException({
        message: 'Token expired. Please login again.',
        statusCode: 401,
        error: 'TOKEN_EXPIRED',
        timestamp: new Date().toISOString(),
        data: {
          shouldRedirectToLogin: true,
          shouldTryRefreshToken: true,
          expiredAt: info.expiredAt,
        },
      });
    }

    // ตรวจสอบ Invalid Token
    if (info && info.name === 'JsonWebTokenError') {
      console.log('Invalid token format:', info.message);
      throw new UnauthorizedException({
        message: 'Invalid token format',
        statusCode: 401,
        error: 'INVALID_TOKEN',
        data: {
          shouldRedirectToLogin: true,
          shouldTryRefreshToken: false,
        },
      });
    }

    if (err || !user) {
      console.log('JwtAuthGuard Error:', err);
      console.log('User:', user);
      console.log('Info:', info);
      
      const errorMessage = info instanceof Error ? info.message : 'No auth token';
      throw err || new UnauthorizedException({
        message: errorMessage,
        statusCode: 401,
        error: 'UNAUTHORIZED',
        data: {
          shouldRedirectToLogin: true,
          shouldTryRefreshToken: false,
        },
      });
    }

    console.log('JWT validation successful for user:', user);
    return user;
  }
}
