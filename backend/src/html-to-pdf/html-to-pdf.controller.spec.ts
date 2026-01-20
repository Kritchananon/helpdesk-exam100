import { Test, TestingModule } from '@nestjs/testing';
import { HtmlToPdfController } from './html-to-pdf.controller';
import { HtmlToPdfService } from './html-to-pdf.service';
import { HtmlToPdfDto } from './dto/create-html-to-pdf.dto';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';

// Mock Service
const mockHtmlToPdfService = {
  generatePdf: jest.fn(),
};

// Mock DTO และ Buffer
const mockDto: HtmlToPdfDto = {
  reportNumber: 'RP-1234',
  /* ... (ใส่ field ที่จำเป็น) ... */
} as HtmlToPdfDto; // ใช้ as เพื่อความรวดเร็วในการ test

const mockPdfBuffer = Buffer.from('test-pdf-buffer');
const mockAuthHeader = 'Bearer valid.token.here';

describe('HtmlToPdfController', () => {
  let controller: HtmlToPdfController;
  let service: HtmlToPdfService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HtmlToPdfController],
      providers: [
        {
          provide: HtmlToPdfService,
          useValue: mockHtmlToPdfService, // ใช้ Mock Service
        },
      ],
    })
      .overrideGuard(JwtAuthGuard) // เรา override Guard ให้ผ่านเสมอใน unit test
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<HtmlToPdfController>(HtmlToPdfController);
    service = module.get<HtmlToPdfService>(HtmlToPdfService);

    // เคลียร์ mock calls
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generatePdf', () => {
    // สร้าง Mock Response object
    // เราต้อง mock แบบ chainable (return 'this') สำหรับ .set
    const mockResponse = {
      set: jest.fn(() => mockResponse),
      send: jest.fn(() => mockResponse),
    } as unknown as Response;

    it('should generate PDF and send response successfully', async () => {
      // ตั้งค่าให้ service mock คืนค่า buffer
      (service.generatePdf as jest.Mock).mockResolvedValue(mockPdfBuffer);

      await controller.generatePdf(mockDto, mockResponse, mockAuthHeader);

      // 1. ตรวจสอบว่า service ถูกเรียกด้วย DTO ที่ถูกต้อง
      expect(service.generatePdf).toHaveBeenCalledWith(mockDto);

      // 2. ตรวจสอบว่ามีการตั้งค่า Header ถูกต้อง
      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${mockDto.reportNumber}.pdf"`,
        'Content-Length': mockPdfBuffer.length.toString(),
      });

      // 3. ตรวจสอบว่ามีการส่ง Buffer กลับไป
      expect(mockResponse.send).toHaveBeenCalledWith(mockPdfBuffer);
    });

    it('should throw HttpException for a missing token', async () => {
      await expect(
        controller.generatePdf(mockDto, mockResponse, undefined)
      ).rejects.toThrow(
        new HttpException('Invalid token format', HttpStatus.UNAUTHORIZED)
      );

      // ตรวจสอบว่า service และ response.send ไม่ถูกเรียก
      expect(service.generatePdf).not.toHaveBeenCalled();
      expect(mockResponse.send).not.toHaveBeenCalled();
    });

    it('should throw HttpException for invalid token format (no Bearer)', async () => {
      await expect(
        controller.generatePdf(mockDto, mockResponse, 'invalid.token')
      ).rejects.toThrow(
        new HttpException('Invalid token format', HttpStatus.UNAUTHORIZED)
      );

      // ตรวจสอบว่า service และ response.send ไม่ถูกเรียก
      expect(service.generatePdf).not.toHaveBeenCalled();
      expect(mockResponse.send).not.toHaveBeenCalled();
    });

    it('should throw HttpException if service fails', async () => {
      const errorMessage = 'Service failed to generate PDF';
      // ตั้งค่าให้ service mock throw error
      (service.generatePdf as jest.Mock).mockRejectedValue(
        new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR)
      );

      await expect(
        controller.generatePdf(mockDto, mockResponse, mockAuthHeader) // <-- เพิ่ม mockAuthHeader
      ).rejects.toThrow(
        new HttpException(errorMessage, HttpStatus.INTERNAL_SERVER_ERROR)
      );

      // ตรวจสอบว่า service ถูกเรียก
      expect(service.generatePdf).toHaveBeenCalledWith(mockDto);
      // ตรวจสอบว่า response.send ไม่ถูกเรียก
      expect(mockResponse.send).not.toHaveBeenCalled();
    });
  });
});