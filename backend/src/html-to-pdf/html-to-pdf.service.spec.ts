import { Test, TestingModule } from '@nestjs/testing';
import { HtmlToPdfService } from './html-to-pdf.service';
import { HtmlToPdfDto } from './dto/create-html-to-pdf.dto';
import { HttpException, HttpStatus } from '@nestjs/common';

// 1. นำเข้า puppeteer
import * as puppeteer from 'puppeteer';

// 2. สั่ง Auto-mock puppeteer ทันที
// (Jest จะ Hoist คำสั่งนี้ขึ้นไปทำงานก่อน import ทั้งหมด)
jest.mock('puppeteer');

// 3. import puppeteer ที่ "ถูก mock แล้ว"
// และ cast type เพื่อให้ TypeScript รู้จัก .mockResolvedValue
const mockedPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

// 4. สร้างตัวแปรสำหรับ mock object ที่เราจะใช้
const mockPdfBuffer = Buffer.from('test-pdf-buffer');

const mockPage = {
  setContent: jest.fn(),
  pdf: jest.fn(),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn(),
};

// --- สิ้นสุดการ Mock ---

describe('HtmlToPdfService', () => {
  let service: HtmlToPdfService;

  // ข้อมูล DTO สำหรับทดสอบ (เหมือนเดิม)
  const mockDto: HtmlToPdfDto = {
    reportNumber: 'RP-1234',
    reportDate: '2025-11-05',
    status: 'In Progress',
    reporter: 'Test User',
    priority: 'High',
    category: 'Bug',
    project: 'Test Project',
    issueTitle: 'PDF Generation Issue',
    issueDescription: 'This is a test description.',
    attachmentUrl: ['http://example.com/img1.png', 'http://example.com/img2.png'],
    assignee: 'Dev Team',
    estimatedCloseDate: '2025-11-10',
    deadline: '2025-11-12',
    estimateTime: '8h',
    leadTime: '2d',
    changeRequest: 'No',
    solutionDescription: 'Solution pending.',
    satisfactionRating: '4',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HtmlToPdfService],
    }).compile();

    service = module.get<HtmlToPdfService>(HtmlToPdfService);

    // 5. รีเซ็ต mock ทั้งหมด และตั้งค่า "Happy Path" (กรณีที่ทำงานปกติ)
    // เราจะควบคุม mock function ที่ได้มาจาก auto-mock โดยตรง
    jest.clearAllMocks(); // หรือ mockReset() ถ้าต้องการเคลียร์ implementation ด้วย
    
    mockedPuppeteer.launch.mockResolvedValue(mockBrowser as any);
    mockPage.pdf.mockResolvedValue(mockPdfBuffer);
    mockBrowser.newPage.mockResolvedValue(mockPage); // Ensure chain is reset
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateHtmlTemplate', () => {
    // ... (ส่วนนี้เหมือนเดิม ไม่มีการแก้ไข) ...
    it('should generate correct HTML from DTO', () => {
      const html = service.generateHtmlTemplate(mockDto);
      expect(html).toContain('เลขที่: <strong>RP-1234</strong>');
    });

    it('should handle missing attachments', () => {
      const dtoNoAttachment = { ...mockDto, attachmentUrl: [] };
      const html = service.generateHtmlTemplate(dtoNoAttachment);
      expect(html).toContain('ไม่พบไฟล์แนบ (Error 404 Not Found)');
    });

    it('should handle zero satisfaction rating', () => {
      const dtoZeroRating = { ...mockDto, satisfactionRating: '0' };
      const html = service.generateHtmlTemplate(dtoZeroRating);
      expect(html).toContain('<span class="stars">☆☆☆☆☆</span>');
    });
  });

  describe('generatePdf', () => {
    it('should generate PDF buffer successfully', async () => {
      const htmlSpy = jest.spyOn(service, 'generateHtmlTemplate');

      const result = await service.generatePdf(mockDto);

      // ✅ [FIX] .toEqual จะผ่าน เพราะ mockPage.pdf คืนค่า mockPdfBuffer
      expect(result).toEqual(mockPdfBuffer);

      expect(htmlSpy).toHaveBeenCalledWith(mockDto);

      // ✅ [FIX] ตรวจสอบที่ auto-mocked function
      expect(mockedPuppeteer.launch).toHaveBeenCalledWith(expect.any(Object));
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.setContent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ waitUntil: 'networkidle0' }),
      );
      expect(mockPage.pdf).toHaveBeenCalledWith(expect.any(Object));
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should throw HttpException if puppeteer fails', async () => {
      // ✅ [FIX] ควบคุม auto-mocked function โดยตรง
      mockedPuppeteer.launch.mockRejectedValue(new Error('Browser launch failed'));

      // ✅ [FIX] เทสนี้จะ Reject ตามที่เรา mock ไว้
      await expect(service.generatePdf(mockDto)).rejects.toThrow(HttpException);
      await expect(service.generatePdf(mockDto)).rejects.toThrow(
        'Error generating PDF: Browser launch failed',
      );

      expect(mockBrowser.close).not.toHaveBeenCalled();
    });

    it('should close browser even if page.pdf fails', async () => {
      // ✅ [FIX] ควบคุม mockPage.pdf โดยตรง
      // (launch จะทำงานปกติ เพราะเราตั้งไว้ใน beforeEach)
      mockPage.pdf.mockRejectedValue(new Error('PDF creation failed'));

      // ✅ [FIX] เทสนี้จะ Reject ตามที่เรา mock ไว้
      await expect(service.generatePdf(mockDto)).rejects.toThrow(HttpException);
      await expect(service.generatePdf(mockDto)).rejects.toThrow(
        'Error generating PDF: PDF creation failed',
      );

      // ตรวจสอบว่า browser ถูกปิด (ใน finally block) แม้ว่าจะเกิด error
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });
});