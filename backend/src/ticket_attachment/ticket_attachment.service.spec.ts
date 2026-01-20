import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentService } from './ticket_attachment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TicketAttachment } from './entities/ticket_attachment.entity';
import { Repository, LessThan, Not, IsNull, ObjectLiteral } from 'typeorm'; // ✅ แก้ไข: เพิ่ม ObjectLiteral
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// ✅ แก้ไข: Mock TypeORM Repository
type MockRepository<T extends ObjectLiteral = any> = {
  find: jest.Mock;
  findOne: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  remove: jest.Mock;
  createQueryBuilder: jest.Mock;
};

const createMockRepo = (): MockRepository<TicketAttachment> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(), // ไม่ต้อง return อะไรจากตรงนี้
});

// ✅ แก้ไข: Mock fs
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  unlinkSync: jest.fn(),
  promises: {
    ...jest.requireActual('fs').promises,
    unlink: jest.fn(),
  },
}));

// Mock path
jest.mock('path', () => ({
  ...jest.requireActual('path'), // import and retain default behavior
  join: jest.fn((...args) => args.join('/')), // Simple join mock
}));

describe('AttachmentService', () => {
  let service: AttachmentService;
  let repo: MockRepository<TicketAttachment>;
  let mockFs: jest.Mocked<typeof fs>;
  let mockPath: jest.Mocked<typeof path>;

  const mockAttachment: TicketAttachment = {
    id: 1,
    ticket_id: 1,
    type: 'reporter',
    extension: 'jpg',
    filename: 'testfile',
    create_by: 1,
    create_date: new Date(),
    isenabled: true,
    deleted_at: undefined,
  } as TicketAttachment;

  // Mock process.cwd()
  const mockCwd = jest.spyOn(process, 'cwd').mockReturnValue('/app');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentService,
        {
          provide: getRepositoryToken(TicketAttachment),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<AttachmentService>(AttachmentService);
    repo = module.get<MockRepository<TicketAttachment>>(
      getRepositoryToken(TicketAttachment),
    );
    mockFs = fs as jest.Mocked<typeof fs>;
    mockPath = path as jest.Mocked<typeof path>;

    // Reset mocks
    jest.clearAllMocks();
    mockCwd.mockClear();

    // Setup fake timers
    jest.useFakeTimers(); // ✅ เปิด Fake Timer
  });

  afterEach(() => {
    jest.useRealTimers(); // ✅ คืนค่า Timer
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save an attachment with sanitized extension and filename', async () => {
      const mockFile: Express.Multer.File = {
        originalname: 'verylongname.verylongextension',
        filename: 'anotherverylongfilename',
      } as any;

      const data = {
        ticket_id: 1,
        type: 'reporter',
        file: mockFile,
        create_by: 1,
      };

      const expectedAttachment = {
        ticket_id: 1,
        type: 'reporter',
        extension: 'verylongex', // truncated to 10
        filename: 'anotherver', // truncated to 10
        create_by: 1,
      };

      repo.save.mockResolvedValue(expectedAttachment as TicketAttachment);

      const result = await service.create(data);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining(expectedAttachment),
      );
      expect(result).toEqual(expectedAttachment);
    });
  });

  describe('findImageById', () => {
    // ✅ แก้ไข: วิธี Mock QueryBuilder
    it('should find an image attachment by ID using query builder', async () => {
      // 1. สร้าง mock query builder object
      const mockQb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockAttachment),
      };

      // 2. สั่งให้ repo.createQueryBuilder คืนค่า object นี้
      repo.createQueryBuilder.mockReturnValue(mockQb as any);

      const result = await service.findImageById(1);

      // 3. ตรวจสอบการเรียกใช้งาน
      expect(repo.createQueryBuilder).toHaveBeenCalledWith('a');
      expect(mockQb.select).toHaveBeenCalled();
      expect(mockQb.where).toHaveBeenCalledWith('a.id = :id', { id: 1 });
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'a.extension IN (:...extensions)',
        { extensions: expect.any(Array) },
      );
      expect(mockQb.getOne).toHaveBeenCalled();
      expect(result).toEqual(mockAttachment);
    });
  });

  describe('softDeleteAllByTicketId', () => {
    it('should soft delete all attachments for a ticket', async () => {
      const attachments = [
        { ...mockAttachment, id: 1 },
        { ...mockAttachment, id: 2 },
      ];
      repo.find.mockResolvedValue(attachments);

      await service.softDeleteAllByTicketId(1);

      expect(repo.find).toHaveBeenCalledWith({
        where: { ticket_id: 1, isenabled: true },
      });
      // Check that save is called with updated entities
      expect(repo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            isenabled: false,
            deleted_at: expect.any(Date),
          }),
          expect.objectContaining({
            id: 2,
            isenabled: false,
            deleted_at: expect.any(Date),
          }),
        ]),
      );
    });

    it('should do nothing if no active attachments found', async () => {
      repo.find.mockResolvedValue([]);
      await service.softDeleteAllByTicketId(1);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('restoreAllByTicketId', () => {
    const deletedAttachment = {
      ...mockAttachment,
      isenabled: false,
      deleted_at: new Date('2025-11-05T10:00:00Z'),
    };

    it('should restore attachments deleted within 7 days', async () => {
      // Set current time to be 3 days after deletion
      jest.setSystemTime(new Date('2025-11-08T10:00:00Z'));

      repo.find.mockResolvedValue([deletedAttachment]);

      await service.restoreAllByTicketId(1);

      expect(repo.find).toHaveBeenCalledWith({
        where: { ticket_id: 1, isenabled: false },
      });
      expect(repo.save).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 1,
          isenabled: true,
          deleted_at: undefined,
        }),
      ]);
    });

    it('should throw error if attachments are expired (over 7 days)', async () => {
      // Set current time to be 8 days after deletion
      jest.setSystemTime(new Date('2025-11-14T10:00:00Z'));

      repo.find.mockResolvedValue([deletedAttachment]);

      await expect(service.restoreAllByTicketId(1)).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('permanentDeleteAllByTicketId', () => {
    const deletedAttachment = {
      ...mockAttachment,
      id: 1,
      ticket_id: 1,
      extension: 'jpg',
      isenabled: false,
    };

    // Mock the private helper path
    const mockFilePath = '/app/uploads/attachments/1_1.jpg';
    jest
      .spyOn(AttachmentService.prototype as any, 'getAttachmentFilePath')
      .mockReturnValue(mockFilePath);

    it('should permanently delete attachments and files', async () => {
      repo.find.mockResolvedValue([deletedAttachment]);
      mockFs.existsSync.mockReturnValue(true);

      const result = await service.permanentDeleteAllByTicketId(1);

      expect(repo.find).toHaveBeenCalledWith({
        where: { ticket_id: 1, isenabled: false },
      });
      // Check file deletion
      expect(mockFs.existsSync).toHaveBeenCalledWith(mockFilePath);
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockFilePath);
      // Check db removal
      expect(repo.remove).toHaveBeenCalledWith([deletedAttachment]);
      expect(result.deletedCount).toBe(1);
      expect(result.deletedFiles).toContain(mockFilePath);
    });
  });

  describe('cleanupExpiredAttachments', () => {
    const sevenDaysAgo = new Date('2025-10-04T10:00:00Z');

    it('should find and delete expired attachments', async () => {
      // ✅ แก้ไข: ย้าย setSystemTime และ spyOn มาไว้ข้างใน it
      jest.setSystemTime(new Date('2025-10-11T10:00:00Z'));

      const expiredAttachment = {
        ...mockAttachment,
        id: 1,
        isenabled: false,
        deleted_at: new Date('2025-10-01T10:00:00Z'), // 10 days ago
      };
      
      const mockFilePath = '/app/uploads/attachments/1_1.jpg';
      jest
        .spyOn(AttachmentService.prototype as any, 'getAttachmentFilePath')
        .mockReturnValue(mockFilePath);
      
      repo.find.mockResolvedValue([expiredAttachment]);
      mockFs.existsSync.mockReturnValue(true);

      await service.cleanupExpiredAttachments();

      expect(repo.find).toHaveBeenCalledWith({
        where: {
          isenabled: false,
          deleted_at: LessThan(sevenDaysAgo),
        },
      });
      expect(mockFs.unlinkSync).toHaveBeenCalledWith(mockFilePath);
      expect(repo.remove).toHaveBeenCalledWith([expiredAttachment]);
    });
  });

  describe('getDeletedAttachmentsByTicketId', () => {
    const now = new Date('2025-11-10T10:00:00Z');

    const restorable = {
      ...mockAttachment,
      id: 1,
      isenabled: false,
      deleted_at: new Date('2025-11-08T10:00:00Z'), // 2 days ago
    };
    const expired = {
      ...mockAttachment,
      id: 2,
      isenabled: false,
      deleted_at: new Date('2025-11-01T10:00:00Z'), // 9 days ago
    };

    it('should return correct status for deleted attachments', async () => {
      // ✅ แก้ไข: ย้าย setSystemTime มาไว้ข้างใน it
      jest.setSystemTime(now);

      repo.find.mockResolvedValue([restorable, expired]);

      const result = await service.getDeletedAttachmentsByTicketId(1);

      expect(repo.find).toHaveBeenCalledWith({
        where: {
          ticket_id: 1,
          isenabled: false,
          deleted_at: Not(IsNull()),
        },
        order: { deleted_at: 'DESC' },
      });

      // Check summary
      expect(result.summary.total).toBe(2);
      expect(result.summary.canRestore).toBe(1);
      expect(result.summary.expired).toBe(1);

      // Check statuses
      expect(result.attachments[0].id).toBe(1);
      expect(result.attachments[0].status).toBe('Can Restore');
      expect(result.attachments[0].days_left_to_restore).toBe(5);

      expect(result.attachments[1].id).toBe(2);
      expect(result.attachments[1].status).toBe('Expired');
      expect(result.attachments[1].days_left_to_restore).toBe(0);
    });
  });

  describe('deleteIssueAttachment', () => {
    const issueAttachment = {
      ...mockAttachment,
      id: 1,
      type: 'reporter',
      filename: 'issue.jpg',
    };
    const wrongTypeAttachment = { ...mockAttachment, id: 2, type: 'supporter' };

    it('should delete an issue attachment successfully', async () => {
      repo.findOne.mockResolvedValue(issueAttachment);
      (mockFs.promises.unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deleteIssueAttachment(1, 1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['ticket'],
      });
      expect(mockPath.join).toHaveBeenCalledWith(
        expect.any(String),
        '..',
        '..',
        'public',
        'images',
        'issue_attachment',
        'issue.jpg',
      );
      expect(mockFs.promises.unlink).toHaveBeenCalled();
      expect(repo.remove).toHaveBeenCalledWith(issueAttachment);
      expect(result.code).toBe(0);
    });

    it('should throw NotFoundException if attachment not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.deleteIssueAttachment(99, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if attachment type is not reporter', async () => {
      repo.findOne.mockResolvedValue(wrongTypeAttachment);
      await expect(service.deleteIssueAttachment(2, 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteFixIssueAttachment', () => {
    const fixAttachment = {
      ...mockAttachment,
      id: 1,
      type: 'supporter',
      filename: 'fix.jpg',
    };

    it('should delete a fix issue attachment successfully', async () => {
      repo.findOne.mockResolvedValue(fixAttachment);
      (mockFs.promises.unlink as jest.Mock).mockResolvedValue(undefined);

      const result = await service.deleteFixIssueAttachment(1, 1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['ticket'],
      });
      expect(mockPath.join).toHaveBeenCalledWith(
        expect.any(String),
        '..',
        '..',
        'public',
        'images',
        'fix_issue',
        'fix.jpg',
      );
      expect(mockFs.promises.unlink).toHaveBeenCalled();
      expect(repo.remove).toHaveBeenCalledWith(fixAttachment);
      expect(result.code).toBe(0);
    });
  });
});