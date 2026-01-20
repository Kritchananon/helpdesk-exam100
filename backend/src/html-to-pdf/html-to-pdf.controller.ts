import {
  Controller,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Res,
  UseGuards
} from '@nestjs/common';
import { Response } from 'express';
import { HtmlToPdfService } from './html-to-pdf.service';
import { HtmlToPdfDto } from './dto/create-html-to-pdf.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard'; // สร้าง guard สำหรับตรวจสอบ token

@Controller('api/pdf')
@UseGuards(JwtAuthGuard) // ใช้ guard เพื่อตรวจสอบ token
export class HtmlToPdfController {
  constructor(private readonly htmlToPdfService: HtmlToPdfService) { }

  @Post('generate')
  async generatePdf(
    @Body() data: HtmlToPdfDto,
    @Res() res: Response,
    @Headers('authorization') authHeader?: string
  ) {
    try {
      // ตรวจสอบ authorization header
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new HttpException('Invalid token format', HttpStatus.UNAUTHORIZED);
      }

      // Generate PDF
      const pdfBuffer = await this.htmlToPdfService.generatePdf(data);

      // Set response headers
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${data.reportNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      });

      // Send PDF buffer
      res.send(pdfBuffer);

    } catch (error) {
      throw new HttpException(
        error.message || 'Internal server error',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}