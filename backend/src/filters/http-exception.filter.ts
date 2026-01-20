import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    // Log ข้อผิดพลาดเพื่อดีบัก
    console.error('Exception caught in filter:');
    console.error(exception);
    
    if (exception instanceof Error) {
      console.error('Stack trace:', exception.stack);
    }
    
    const status = 
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    
    // ส่งข้อความผิดพลาดกลับไปให้ client
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: exception instanceof Error ? exception.message : 'Internal server error',
    });
  }
}
