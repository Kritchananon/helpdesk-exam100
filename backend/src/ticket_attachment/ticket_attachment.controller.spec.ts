import { Test, TestingModule } from '@nestjs/testing';
import {
  TicketAttachmentController,
  // getNextFilenameWithCounter, // เราจะ import แบบ dynamic ด้านล่าง
} from './ticket_attachment.controller';
import { AttachmentService } from './ticket_attachment.service';
import { TicketService } from '../ticket/ticket.service';
import { PermissionService } from '../permission/permission.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Mock Dependencies
const mockAttachmentService = {
  create: jest.fn(),
  findById: jest.fn(),
  deleteIssueAttachment: jest.fn(),
  deleteFixIssueAttachment: jest.fn(),
};

const mockTicketService = {};
const mockPermissionService = {};

// Mock fs and util
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  stat: jest.fn(),
  readFile: jest.fn(),
  promises: {
    ...jest.requireActual('fs').promises,
    readdir: jest.fn(),
    mkdir: jest.fn(),
  },
}));

// ✅ แก้ไข: Mock 'util' ให้ถูกต้อง
jest.mock('util', () => {
  const originalUtil = jest.requireActual('util');
  return {
    ...originalUtil,
    promisify: jest.fn((fn) => {
      // คืนค่าฟังก์ชันที่ถูก mock (เช่น fs.stat, fs.readFile) กลับไปเลย
      // เพราะใน beforeEach เรา mock ให้มันคืนค่า Promise อยู่แล้ว
      return fn;
    }),
  };
});

describe('TicketAttachmentController', () => {
  let controller: TicketAttachmentController;
  let service: typeof mockAttachmentService;
  let mockFsStat: jest.Mock;
  let mockFsReadFile: jest.Mock;

  const mockReporterAttachment = {
    id: 1,
    ticket_id: 1,
    type: 'reporter',
    extension: 'jpg',
    filename: 'test_1.jpg',
  };

  const mockSupporterAttachment = {
    id: 2,
    ticket_id: 1,
    type: 'supporter',
    extension: 'png',
    filename: 'fix_1.png',
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'files',
    originalname: 'test-image.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    filename: 'test_1.jpg',
    path: './uploads/issue_attachment/test_1.jpg',
  } as any;

  const mockRequest = (user: any = { id: 1, role_id: 1 }) => ({
    user: user,
  });

  const mockResponse = {
    set: jest.fn(() => mockResponse),
    send: jest.fn(() => mockResponse),
    status: jest.fn(() => mockResponse),
    json: jest.fn(() => mockResponse),
  } as unknown as Response;

  beforeEach(async () => {
    // Reset promisified mocks
    mockFsStat = fs.stat as unknown as jest.Mock;
    mockFsReadFile = fs.readFile as unknown as jest.Mock;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketAttachmentController],
      providers: [
        { provide: AttachmentService, useValue: mockAttachmentService },
        { provide: TicketService, useValue: mockTicketService },
        { provide: PermissionService, useValue: mockPermissionService },
      ],
    }).compile();

    controller = module.get<TicketAttachmentController>(
      TicketAttachmentController,
    );
    service = module.get(AttachmentService);

    jest.clearAllMocks();

    // Default mock implementations
    mockFsStat.mockResolvedValue({ size: 1024 });
    mockFsReadFile.mockResolvedValue(Buffer.from('test file content'));
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ... (โค้ดส่วน describe('getIssueAttachmentImage') ... ถึง ... describe('deleteFixIssueAttachment')) ...
  // (โค้ดส่วนนี้ผ่านหมดแล้ว ไม่ต้องแก้ไข)
  
  describe('getIssueAttachmentImage', () => {
    it('should serve file successfully for reporter type', async () => {
      service.findById.mockResolvedValue(mockReporterAttachment);

      await controller.getIssueAttachmentImage(1, mockResponse);

      expect(service.findById).toHaveBeenCalledWith(1);
      expect(mockFsStat).toHaveBeenCalledWith(
        path.join(process.cwd(), 'uploads', 'issue_attachment', 'test_1.jpg'),
      );
      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({ 'Content-Type': 'image/jpeg' }),
      );
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should throw BadRequestException if type is not reporter', async () => {
      service.findById.mockResolvedValue(mockSupporterAttachment); // Wrong type

      await expect(
        controller.getIssueAttachmentImage(2, mockResponse),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if file not found on disk', async () => {
      service.findById.mockResolvedValue(mockReporterAttachment);
      mockFsStat.mockRejectedValue(new Error('File not found')); // Mock file not found

      await expect(
        controller.getIssueAttachmentImage(1, mockResponse),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFixIssueAttachmentImage', () => {
    it('should serve file successfully for supporter type', async () => {
      service.findById.mockResolvedValue(mockSupporterAttachment);

      await controller.getFixIssueAttachmentImage(2, mockResponse);

      expect(service.findById).toHaveBeenCalledWith(2);
      expect(mockFsStat).toHaveBeenCalledWith(
        path.join(process.cwd(), 'uploads', 'fix_issue', 'fix_1.png'),
      );
      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({ 'Content-Type': 'image/png' }),
      );
      expect(mockResponse.send).toHaveBeenCalled();
    });

    it('should throw BadRequestException if type is not supporter', async () => {
      service.findById.mockResolvedValue(mockReporterAttachment); // Wrong type

      await expect(
        controller.getFixIssueAttachmentImage(1, mockResponse),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateAttachment (POST)', () => {
    it('should create reporter attachment successfully', async () => {
      service.create.mockResolvedValue(mockReporterAttachment);
      const req = mockRequest();

      const result = await controller.updateAttachment(
        [mockFile],
        '1',
        '1',
        '1',
        'desc',
        req,
      );

      expect(service.create).toHaveBeenCalledWith({
        ticket_id: 1,
        type: 'reporter', // Should be hardcoded to 'reporter'
        file: mockFile,
        create_by: req.user.id,
      });
      expect(result.success).toBe(true);
      expect(result.data.uploaded_files[0].id).toBe(1);
    });
  });

  describe('updateUserAttachment (PATCH)', () => {
    it('should create reporter attachment successfully', async () => {
      service.create.mockResolvedValue(mockReporterAttachment);
      const req = mockRequest();

      const result = await controller.updateUserAttachment(
        [mockFile],
        '1',
        req,
      );

      expect(service.create).toHaveBeenCalledWith({
        ticket_id: 1,
        type: 'reporter', // Should be hardcoded to 'reporter'
        file: mockFile,
        create_by: req.user.id,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('fix_issue_attachment (PATCH)', () => {
    it('should create supporter attachment successfully', async () => {
      service.create.mockResolvedValue(mockSupporterAttachment);
      const req = mockRequest({ id: 2, role_id: 2 }); // Mock supporter user

      const result = await controller.fix_issue_attachment(
        [mockFile],
        '1',
        req,
      );

      expect(service.create).toHaveBeenCalledWith({
        ticket_id: 1,
        type: 'supporter', // Should be hardcoded to 'supporter'
        file: mockFile,
        create_by: req.user.id,
      });
      expect(result.success).toBe(true);
      expect(result.data.uploaded_files[0].id).toBe(2);
    });
  });

  describe('deleteIssueAttachment', () => {
    it('should call service deleteIssueAttachment', async () => {
      const deleteResponse = { code: 0, message: 'Deleted' };
      service.deleteIssueAttachment.mockResolvedValue(deleteResponse);
      const req = mockRequest();

      const result = await controller.deleteIssueAttachment(1, req);

      expect(service.deleteIssueAttachment).toHaveBeenCalledWith(
        1,
        req.user.id,
      );
      expect(result).toEqual(deleteResponse);
    });
  });

  describe('deleteFixIssueAttachment', () => {
    it('should call service deleteFixIssueAttachment', async () => {
      const deleteResponse = { code: 0, message: 'Deleted' };
      service.deleteFixIssueAttachment.mockResolvedValue(deleteResponse);
      const req = mockRequest();

      const result = await controller.deleteFixIssueAttachment(1, req);

      expect(service.deleteFixIssueAttachment).toHaveBeenCalledWith(
        1,
        req.user.id,
      );
      expect(result).toEqual(deleteResponse);
    });
  });
});

// ✅✅✅
// บล็อกนี้คือส่วนที่แก้ไขปัญหา State Leaking ทั้งหมด
// ✅✅✅
describe('getNextFilenameWithCounter (Helper Function)', () => {
  let mockReaddir: jest.Mock;
  let mockMkdir: jest.Mock;
  let getNextFilenameWithCounter: (
    uploadPath: string,
    ticket_id: string,
    originalname: string,
  ) => Promise<string>;

  beforeEach(async () => {
    // 1. รีเซ็ต Module Cache เพื่อล้างค่า 'fileCounters' ที่ค้างอยู่
    jest.resetModules();

    // 2. Mock 'fs' อีกครั้ง เพราะการ resetModules() จะล้าง mock ทิ้งไปด้วย
    jest.mock('fs', () => ({
      ...jest.requireActual('fs'),
      stat: jest.fn(),
      readFile: jest.fn(),
      promises: {
        ...jest.requireActual('fs').promises,
        readdir: jest.fn(),
        mkdir: jest.fn(),
      },
    }));

    // 3. Import โมดูลและฟังก์ชันที่ต้องการทดสอบ *หลังจาก* reset แล้ว
    const fsPromises = require('fs').promises;
    const controllerModule = await import(
      './ticket_attachment.controller'
    );

    // 4. กำหนดค่า mock และฟังก์ชันให้ตัวแปรใน scope นี้
    getNextFilenameWithCounter = controllerModule.getNextFilenameWithCounter;
    mockReaddir = fsPromises.readdir as jest.Mock;
    mockMkdir = fsPromises.mkdir as jest.Mock;
  });

  it('should return _1 if no files exist', async () => {
    mockReaddir.mockResolvedValue([]);
    const filename = await getNextFilenameWithCounter(
      './uploads',
      '100',
      'image.jpg',
    );
    expect(filename).toBe('100_1.jpg');
  });

  it('should return next number if files exist', async () => {
    mockReaddir.mockResolvedValue(['100_1.jpg', '100_2.jpg', 'unrelated.txt']);
    const filename = await getNextFilenameWithCounter(
      './uploads',
      '100',
      'image.png',
    );
    expect(filename).toBe('100_3.png'); // <-- ควรจะผ่าน
  });

  it('should handle gaps in numbering and find max', async () => {
    mockReaddir.mockResolvedValue(['100_1.jpg', '100_5.jpg']);
    const filename = await getNextFilenameWithCounter(
      './uploads',
      '100',
      'image.gif',
    );
    expect(filename).toBe('100_6.gif'); // <-- ควรจะผ่าน
  });

  it('should use in-memory counter for subsequent calls', async () => {
    // 1. รันครั้งแรก (อ่านไฟล์): max คือ 5, counter ถูก set เป็น 5
    mockReaddir.mockResolvedValue(['100_1.jpg', '100_5.jpg']);
    const filename1 = await getNextFilenameWithCounter(
      './uploads',
      '100',
      'image.gif',
    );
    expect(filename1).toBe('100_6.gif'); // <-- ควรจะผ่าน (5 + 1 = 6)
    
    // เคลียร์ call log ของ mockReaddir
    mockReaddir.mockClear();

    // 2. รันครั้งที่สอง (ใช้ memory): counter (5) + 1 = 6
    // (*** แก้ไข: จริงๆ แล้ว counter ถูก set เป็น 6 ในการรันครั้งแรก)
    // counter ถูก set เป็น 6, รันครั้งที่สองจะได้ 7
    const filename2 = await getNextFilenameWithCounter(
      './uploads',
      '100',
      'image2.jpg',
    );
    
    // filename1 ได้ 6 (จาก max 5 + 1) -> counter ถูก set เป็น 6
    // filename2 ได้ 7 (จาก counter 6 + 1)
    expect(filename2).toBe('100_7.jpg'); 
    
    // readdir ไม่ควรถูกเรียกอีก
    expect(mockReaddir).not.toHaveBeenCalled();
  });
});