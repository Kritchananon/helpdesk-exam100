// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { Ticket } from './entities/ticket.entity';
import { TicketStatusHistory } from '../ticket_status_history/entities/ticket_status_history.entity';
import { TicketAttachment } from '../ticket_attachment/entities/ticket_attachment.entity';
import { TicketCategory } from '../ticket_categories/entities/ticket_category.entity';
import { TicketStatus } from '../ticket_status/entities/ticket_status.entity';
import { Satisfaction } from '../satisfaction/entities/satisfaction.entity';
import { Users } from '../users/entities/user.entity';
import { TicketAssigned } from '../ticket_assigned/entities/ticket_assigned.entity';
import { Project } from '../project/entities/project.entity';
import { AttachmentService } from '../ticket_attachment/ticket_attachment.service';
import { TicketStatusHistoryService } from '../ticket_status_history/ticket_status_history.service';
import { NotificationService } from '../notification/notification.service';
import { PermissionService } from '../permission/permission.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
// ⭐️ เพิ่ม TicketPriority
import { TicketPriority } from '../ticket_priority/entities/ticket_priority.entity';

// ⭐️ สร้าง Mock QueryBuilder ที่ยืดหยุ่นขึ้น
// ตัวนี้จะช่วยให้เรา mock การ chain method .leftJoin .where .andWhere .getRawOne() ฯลฯ ได้
const mockQueryBuilder = {
  leftJoin: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue(null),
  getRawMany: jest.fn().mockResolvedValue([]),
  getCount: jest.fn().mockResolvedValue(1),
  orderBy: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(null),
  getMany: jest.fn().mockResolvedValue([]),
  groupBy: jest.fn().mockReturnThis(),
  addGroupBy: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  setParameter: jest.fn().mockReturnThis(),
  // ⭐️ เพิ่ม clone() เพื่อรองรับ .clone() ใน service
  clone: jest.fn().mockReturnThis(), 
};

describe('TicketService', () => {
  let service: TicketService;
  let ticketRepo: jest.Mocked<Repository<Ticket>>;
  let historyRepo: jest.Mocked<Repository<TicketStatusHistory>>;
  let attachmentRepo: jest.Mocked<Repository<TicketAttachment>>;
  let categoryRepo: jest.Mocked<Repository<TicketCategory>>;
  let projectRepo: jest.Mocked<Repository<Project>>;
  let statusRepo: jest.Mocked<Repository<TicketStatus>>;
  let satisfactionRepo: jest.Mocked<Repository<Satisfaction>>;
  let userRepo: jest.Mocked<Repository<Users>>;
  let assignRepo: jest.Mocked<Repository<TicketAssigned>>;
  // ⭐️ เพิ่ม priorityRepo
  let priorityRepo: jest.Mocked<Repository<TicketPriority>>;
  let attachmentService: jest.Mocked<AttachmentService>;
  let historyService: jest.Mocked<TicketStatusHistoryService>;
  let notiService: jest.Mocked<NotificationService>;
  let permissionService: jest.Mocked<PermissionService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockUser = {
    id: 101,
    firstname: 'John',
    lastname: 'Doe',
    role: 1,
  };

  const mockTicket = {
    id: 1,
    ticket_no: 'T-250500001',
    project_id: 1,
    categories_id: 1,
    issue_description: 'Test Issue',
    status_id: 1,
    create_by: 101,
    update_by: 101,
    isenabled: true,
    create_date: new Date(),
    update_date: new Date(),
  };

  const mockTicketRaw = {
    ...mockTicket,
    categories_name: 'Test Category',
    project_name: 'Test Project',
    status_name: 'New',
    create_by: 'John Doe',
    update_by: 'John Doe',
  };

  const mockCreateTicketDto: CreateTicketDto = {
    project_id: 1,
    categories_id: 1,
    issue_description: 'Test Issue',
  };

  const mockUpdateTicketDto: UpdateTicketDto = {
    issue_description: 'Updated issue',
  };

  beforeEach(async () => {
    // ⭐️ รีเซ็ต mock function ทุกครั้งก่อนรัน test ใหม่
    // เพื่อป้องกันการนับจำนวน call ข้าม test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketService,
        {
          provide: getRepositoryToken(Ticket),
          useValue: {
            create: jest.fn().mockReturnValue(mockTicket),
            save: jest.fn().mockResolvedValue(mockTicket),
            findOne: jest.fn().mockResolvedValue(mockTicket),
            find: jest.fn().mockResolvedValue([mockTicket]),
            findAndCount: jest.fn().mockResolvedValue([[mockTicket], 1]),
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            // ⭐️ ใช้ mockQueryBuilder ที่เราสร้างไว้
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(TicketStatusHistory),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn().mockResolvedValue(null),
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(TicketAttachment),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(TicketCategory),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(Project),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(TicketStatus),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        { provide: getRepositoryToken(Satisfaction), useValue: {} },
        {
          provide: getRepositoryToken(Users),
          useValue: {
            findByIds: jest.fn().mockResolvedValue([{ id: 102 }]),
            // ⭐️ เพิ่ม find เพื่อรองรับ getAllTicket
            find: jest.fn().mockResolvedValue([{ id: 101, role: 1 }]), 
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(TicketAssigned),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        // ⭐️ เพิ่ม Provider สำหรับ TicketPriority
        {
          provide: getRepositoryToken(TicketPriority),
          useValue: {
            createQueryBuilder: jest.fn(() => mockQueryBuilder),
          },
        },
        {
          provide: AttachmentService,
          useValue: {
            softDeleteAllByTicketId: jest.fn(),
            restoreAllByTicketId: jest.fn(),
          },
        },
        {
          provide: TicketStatusHistoryService,
          useValue: {
            createHistory: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            createNewTicketNotification: jest.fn(),
          },
        },
        {
          provide: PermissionService,
          useValue: {
            checkUserPermissions: jest.fn().mockResolvedValue([1, 13]),
            // ⭐️ เพิ่ม mock canReadAllProject
            canReadAllProject: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn().mockResolvedValue([{ id: 1, create_by: 101 }]),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              from: jest.fn().mockReturnThis(),
              leftJoin: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              setParameter: jest.fn().mockReturnThis(),
              getRawOne: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TicketService>(TicketService);
    ticketRepo = module.get(getRepositoryToken(Ticket));
    historyRepo = module.get(getRepositoryToken(TicketStatusHistory));
    attachmentRepo = module.get(getRepositoryToken(TicketAttachment));
    userRepo = module.get(getRepositoryToken(Users));
    // ⭐️ Inject priorityRepo
    priorityRepo = module.get(getRepositoryToken(TicketPriority));
    notiService = module.get(NotificationService);
    permissionService = module.get(PermissionService);
    dataSource = module.get(DataSource);

    // ⭐️ เพิ่มบรรทัดนี้เข้าไปครับ
    attachmentService = module.get(AttachmentService);
    
    // ⭐️ Spy on checkUserPermissions ของ service (ที่เราจะ test)
    // เราจะ mock ค่าที่มัน return เสมอ
    jest.spyOn(service, 'checkUserPermissions').mockResolvedValue([1]); 
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- Core Methods ---
  describe('saveTicket', () => {
    it('should create a new ticket successfully', async () => {
      jest.spyOn(service, 'generateTicketNumber').mockResolvedValue('T250500002');
      jest.spyOn(ticketRepo, 'save').mockResolvedValue({
        id: 2,
        ...mockTicket,
        ticket_no: 'T250500002',
      });
      const result = await service.saveTicket(mockCreateTicketDto, 101);
      expect(result.ticket_no).toBe('T250500002');
      expect(ticketRepo.create).toHaveBeenCalled();
      expect(ticketRepo.save).toHaveBeenCalled();
      expect(historyRepo.create).toHaveBeenCalled(); // ⭐️ เปลี่ยนเป็น create
      expect(historyRepo.save).toHaveBeenCalled(); // ⭐️ เปลี่ยนเป็น save
    });

    it('should update an existing ticket successfully', async () => {
      const existingTicket = { ...mockTicket, status_id: 2 };
      jest.spyOn(ticketRepo, 'findOne').mockResolvedValue(existingTicket);
      const updateDto = { ...mockCreateTicketDto, ticket_id: 1, status_id: 3 };
      
      // ⭐️ Mock findOne ของ historyRepo ให้ return null (ไม่พบ history)
      jest.spyOn(historyRepo, 'findOne').mockResolvedValue(null);

      const result = await service.saveTicket(updateDto, 101);
      expect(ticketRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(ticketRepo.save).toHaveBeenCalled();
      expect(historyRepo.save).toHaveBeenCalled(); // ⭐️ ควรถูกเรียกเพราะ status_id เปลี่ยน
    });

    it('should throw BadRequestException if ticket_id for update is not found', async () => {
      jest.spyOn(ticketRepo, 'findOne').mockResolvedValue(null);
      await expect(
        service.saveTicket({ ticket_id: 999 }, 101),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTicketData', () => {
    it('should return ticket data with attachments and history', async () => {
      const mockAttachments = [
        { attachment_id: 1, extension: 'png', filename: 'test.png' },
      ];
      const mockHistory = [{ status_id: 1, status_name: 'New' }];
      
      // ⭐️ Mock getRawOne ให้คืนค่า ticket
      jest.spyOn(mockQueryBuilder, 'getRawOne').mockResolvedValue(mockTicketRaw);
      // ⭐️ Mock getRawMany 3 ครั้ง (issueAttachment, fixAttachment, statusHistory, assign)
      jest.spyOn(mockQueryBuilder, 'getRawMany')
        .mockResolvedValueOnce(mockAttachments) // issueAttachment
        .mockResolvedValueOnce([]) // fixAttachment
        .mockResolvedValueOnce(mockHistory) // statusHistory
        .mockResolvedValueOnce([]); // assign

      const result = await service.getTicketData('T-250500001', 'http://localhost');
      expect(result.ticket.ticket_no).toBe('T-250500001');
      expect(result.issue_attachment.length).toBe(1);
      expect(result.status_history.length).toBe(1);
    });

    it('should throw NotFoundException if ticket not found', async () => {
      jest.spyOn(mockQueryBuilder, 'getRawOne').mockResolvedValue(null);
      await expect(
        service.getTicketData('T-999999999', 'http://localhost'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAllTicket', () => {
    // ⭐️ Test case เดิม (แต่ใช้ mock ที่ซับซ้อนขึ้น)
    it('should return all tickets for a user with VIEW_ALL_TICKETS permission', async () => {
      // ⭐️ Mock permission (Role 13)
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValueOnce([13]);
      // ⭐️ Mock count query
      jest.spyOn(mockQueryBuilder, 'getRawOne').mockResolvedValueOnce({ count: '1' });
      // ⭐️ Mock data query
      jest.spyOn(mockQueryBuilder, 'getRawMany').mockResolvedValueOnce([mockTicketRaw]);

      const result = await service.getAllTicket(101, 1, 10);
      expect(result.data.length).toBe(1);
      expect(result.pagination.totalRows).toBe(1);
      // ⭐️ ตรวจสอบว่า *ไม่ได้* join หรือ where กับ userId
      expect(mockQueryBuilder.innerJoin).not.toHaveBeenCalledWith(
        'ticket_assigned', 'ta', expect.any(String), expect.any(Object)
      );
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        't.create_by = :userId', { userId: 101 }
      );
    });

    // ⭐️ Test case เดิม (แต่ใช้ mock ที่ซับซ้อนขึ้น)
    it('should return only user-owned tickets without VIEW_ALL_TICKETS permission', async () => {
      // ⭐️ Mock permission (Role 1)
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValueOnce([1]);
      jest.spyOn(mockQueryBuilder, 'getRawOne').mockResolvedValueOnce({ count: '1' });
      jest.spyOn(mockQueryBuilder, 'getRawMany').mockResolvedValueOnce([mockTicketRaw]);

      const result = await service.getAllTicket(101, 1, 10);
      expect(result.data.length).toBe(1);
      // ⭐️ ตรวจสอบว่า *มีการ* where ด้วย create_by
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.create_by = :userId', { userId: 101 }
      );
    });

    // ⭐️ Test case ใหม่: ทดสอบ Supporter (Role 8)
    it('should return only assigned tickets for a Supporter (Role 8)', async () => {
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValueOnce([8]);
      jest.spyOn(mockQueryBuilder, 'getRawOne').mockResolvedValueOnce({ count: '1' });
      jest.spyOn(mockQueryBuilder, 'getRawMany').mockResolvedValueOnce([mockTicketRaw]);

      const result = await service.getAllTicket(101, 1, 10);
      expect(result.data.length).toBe(1);
      // ⭐️ ตรวจสอบว่า *มีการ* innerJoin กับ ticket_assigned
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'ticket_assigned', 'ta', 'ta.ticket_id = t.id AND ta.user_id = :userId', { userId: 101 }
      );
    });

    // ⭐️ Test case ใหม่: ทดสอบ Filter
    it('should apply keyword filter correctly (using ILIKE)', async () => {
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValueOnce([13]); // Admin
      jest.spyOn(mockQueryBuilder, 'getRawOne').mockResolvedValueOnce({ count: '0' });
      jest.spyOn(mockQueryBuilder, 'getRawMany').mockResolvedValueOnce([]);

      const filters = { keyword: 'Error 404' };
      await service.getAllTicket(101, 1, 10, filters);

      // ⭐️ ตรวจสอบว่า *มีการ* andWhere ด้วย ILIKE
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE :kw'), 
        { kw: `%${filters.keyword}%` }
      );
    });

    // ⭐️ Test case ใหม่: ทดสอบ Pagination
    it('should calculate pagination correctly', async () => {
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValueOnce([13]); // Admin
      // ⭐️ Mock 100 รายการ / หน้าละ 25
      jest.spyOn(mockQueryBuilder, 'getRawOne').mockResolvedValueOnce({ count: '100' });
      jest.spyOn(mockQueryBuilder, 'getRawMany').mockResolvedValueOnce([]); // ข้อมูลไม่สำคัญ

      const result = await service.getAllTicket(101, 2, 25); // ขอหน้า 2

      expect(result.pagination.totalRows).toBe(100);
      expect(result.pagination.totalPages).toBe(4);
      expect(result.pagination.currentPage).toBe(2);
      expect(result.pagination.perPage).toBe(25);
      // ⭐️ หน้า 2 ต้อง offset (2-1) * 25 = 25
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(25);
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(25);
    });
  });


  describe('softDeleteTicket', () => {
    it('should soft delete a ticket successfully', async () => {
      jest.spyOn(ticketRepo, 'findOne').mockResolvedValue(mockTicket);
      await service.softDeleteTicket('T-250500001', 101);
      expect(ticketRepo.findOne).toHaveBeenCalled();
      expect(ticketRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isenabled: false,
          update_by: 101,
        }),
      );
      // ⭐️ ตรวจสอบว่าเรียก softDeleteAllByTicketId ด้วย
      expect(attachmentService.softDeleteAllByTicketId).toHaveBeenCalledWith(mockTicket.id);
    });

    it('should throw ForbiddenException if user is not the owner', async () => {
      jest.spyOn(ticketRepo, 'findOne').mockResolvedValue({
        ...mockTicket,
        create_by: 999,
      });
      await expect(
        service.softDeleteTicket('T-250500001', 101),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('restoreTicketByNo', () => {
    const deletedTicket = { 
      ...mockTicket, 
      isenabled: false, 
      update_date: new Date() // ⭐️ ถูกลบวันนี้
    };

    it('should restore a soft-deleted ticket successfully (within 7 days)', async () => {
      jest.spyOn(ticketRepo, 'findOne').mockResolvedValue(deletedTicket);
      await service.restoreTicketByNo('T-250500001', 101);
      
      expect(ticketRepo.findOne).toHaveBeenCalledWith({
        where: { ticket_no: 'T-250500001', isenabled: false }
      });
      expect(ticketRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isenabled: true,
          update_by: 101,
        }),
      );
      // ⭐️ ตรวจสอบว่าเรียก restoreAllByTicketId ด้วย
      expect(attachmentService.restoreAllByTicketId).toHaveBeenCalledWith(mockTicket.id);
    });

    // ⭐️ Test case ใหม่: กู้คืนไม่ได้เพราะเกิน 7 วัน
    it('should throw BadRequestException if restore period is over 7 days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8); // 8 วันที่แล้ว
      
      const oldDeletedTicket = { ...deletedTicket, update_date: oldDate };

      jest.spyOn(ticketRepo, 'findOne').mockResolvedValue(oldDeletedTicket);
      
      await expect(
        service.restoreTicketByNo('T-250500001', 101),
      ).rejects.toThrow(BadRequestException);
    });

    // ⭐️ Test case ใหม่: กู้คืนไม่ได้เพราะไม่ใช่เจ้าของ
    it('should throw ForbiddenException if user is not owner', async () => {
      const otherOwnerTicket = { ...deletedTicket, create_by: 999 };
      jest.spyOn(ticketRepo, 'findOne').mockResolvedValue(otherOwnerTicket);

      await expect(
        service.restoreTicketByNo('T-250500001', 101),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if deleted ticket not found', async () => {
      jest.spyOn(ticketRepo, 'findOne').mockResolvedValue(null);
      await expect(
        service.restoreTicketByNo('T-999999999', 101),
      ).rejects.toThrow(NotFoundException);
    });
  });


  describe('getDeletedTickets', () => {
    it('should return a list of deleted tickets with can_restore = true', async () => {
      const deletedTicket = {
        ...mockTicket,
        isenabled: false,
        update_date: new Date(), // ⭐️ ลบวันนี้
      };
      jest.spyOn(ticketRepo, 'find').mockResolvedValue([deletedTicket]);
      const result = await service.getDeletedTickets();
      expect(result.length).toBe(1);
      expect(result[0].can_restore).toBe(true);
    });

    // ⭐️ Test case ใหม่: ทดสอบ can_restore = false
    it('should return a list of deleted tickets with can_restore = false', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 วันที่แล้ว

      const oldDeletedTicket = {
        ...mockTicket,
        isenabled: false,
        update_date: oldDate,
      };
      jest.spyOn(ticketRepo, 'find').mockResolvedValue([oldDeletedTicket]);
      const result = await service.getDeletedTickets();
      expect(result.length).toBe(1);
      expect(result[0].can_restore).toBe(false);
    });
  });


  describe('generateTicketNumber', () => {
    // ⭐️ Test case ใหม่: ทดสอบการสร้าง ticket แรกของเดือน
    it('should generate first ticket number of the month (00001)', async () => {
      // ⭐️ Mock getOne (หา ticket ล่าสุด) ให้ return null
      jest.spyOn(mockQueryBuilder, 'getOne').mockResolvedValue(null);
      // ⭐️ Mock findOne (เช็คซ้ำ) ให้ return null
      jest.spyOn(ticketRepo, 'findOne').mockResolvedValue(null);

      const ticketNo = await service.generateTicketNumber();
      
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const prefix = `T${year}${month}`;

      expect(ticketNo).toBe(`${prefix}00001`);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        't.ticket_no LIKE :prefix', { prefix: `${prefix}%` }
      );
    });

    // ⭐️ Test case ใหม่: ทดสอบการรัน ticket ต่อจากเดิม
    it('should generate next ticket number correctly (00042)', async () => {
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const prefix = `T${year}${month}`;
      
      const latestTicket = { ticket_no: `${prefix}00041` };

      // ⭐️ Mock getOne (หา ticket ล่าสุด)
      jest.spyOn(mockQueryBuilder, 'getOne').mockResolvedValue(latestTicket);
      // ⭐️ Mock findOne (เช็คซ้ำ) ให้ return null
      jest.spyOn(ticketRepo, 'findOne').mockResolvedValue(null);

      const ticketNo = await service.generateTicketNumber();
      expect(ticketNo).toBe(`${prefix}00042`);
    });
  });

  // --- Helper & Utility Methods ---
  describe('checkTicketOwnership', () => {
    it('should return true if user is the ticket owner', async () => {
      jest
        .spyOn(dataSource, 'query')
        .mockResolvedValueOnce([{ id: 1, create_by: 101 }]);
      const result = await service.checkTicketOwnership(101, 1, []);
      expect(result).toBe(true);
    });

    // ⭐️ Test case ใหม่: ทดสอบ role
    it('should return true if user has a valid allowRoles (e.g., 13)', async () => {
      // ⭐️ ไม่ต้อง mock dataSource.query เพราะ logic ควรจะ return true ก่อน
      const result = await service.checkTicketOwnership(999, 1, [13]); // user 999, permission 13
      expect(result).toBe(true);
      expect(dataSource.query).not.toHaveBeenCalled(); // ⭐️ ต้องไม่ถูกเรียก
    });

    it('should return false if user has no permission and is not the owner', async () => {
      jest.spyOn(dataSource, 'query').mockResolvedValueOnce([]);
      const result = await service.checkTicketOwnership(999, 1, []);
      expect(result).toBe(false);
    });
  });

  // ⭐️⭐️⭐️ เพิ่ม test block ใหม่สำหรับ getDashboardStatsByUserId ⭐️⭐️⭐️
  describe('getDashboardStatsByUserId', () => {
    beforeEach(() => {
      // ⭐️ Mock query builder ที่ถูก clone
      // เราจะ mock .getMany() ที่ถูกเรียก 4 ครั้ง (total, new, inProgress, complete)
      jest.spyOn(ticketRepo, 'createQueryBuilder').mockImplementation(() => ({
        ...mockQueryBuilder,
        getMany: jest.fn()
          .mockResolvedValueOnce([{}, {}, {}]) // 1. Total = 3
          .mockResolvedValueOnce([{}])         // 2. New (status 1) = 1
          .mockResolvedValueOnce([{}])         // 3. InProgress (status 3) = 1
          .mockResolvedValueOnce([{}]),        // 4. Complete (status 5) = 1
      }));
    });

    it('should return stats for Reporter (Role 1 - Own tickets)', async () => {
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValue([1]);

      const result = await service.getDashboardStatsByUserId(101);

      expect(service.checkUserPermissions).toHaveBeenCalledWith(101);
      // ⭐️ ต้อง .where (สำหรับ 't.create_by = :userId')
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('t.create_by = :userId', { userId: 101 });
      // ⭐️ ไม่ควร .innerJoin (สำหรับ supporter)
      expect(mockQueryBuilder.innerJoin).not.toHaveBeenCalled();
      
      expect(result.total).toBe(3);
      expect(result.new.count).toBe(1);
      expect(result.inProgress.count).toBe(1);
      expect(result.complete.count).toBe(1);
    });

    it('should return stats for Supporter (Role 8 - Assigned tickets)', async () => {
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValue([8]);

      const result = await service.getDashboardStatsByUserId(101);

      expect(service.checkUserPermissions).toHaveBeenCalledWith(101);
      // ⭐️ ต้อง .innerJoin
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'ticket_assigned', 'ta', 'ta.ticket_id = t.id'
      );
      // ⭐️ ต้อง .andWhere (สำหรับ 'ta.user_id = :userId')
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ta.user_id = :userId', { userId: 101 });
      
      expect(result.total).toBe(3);
      expect(result.new.count).toBe(1);
    });
    
    it('should return stats for Admin (Role 19 - All tickets)', async () => {
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValue([19]);

      const result = await service.getDashboardStatsByUserId(101);

      expect(service.checkUserPermissions).toHaveBeenCalledWith(101);
      // ⭐️ ต้อง *ไม่* .where หรือ .innerJoin หรือ .andWhere (ที่เกี่ยวกับ userId)
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
      expect(mockQueryBuilder.innerJoin).not.toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        expect.any(String), { userId: 101 }
      );
      
      expect(result.total).toBe(3);
      expect(result.new.count).toBe(1);
    });

    it('should return empty dashboard if no permission roles found', async () => {
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValue([]); // ไม่มี Role

      const result = await service.getDashboardStatsByUserId(101);
      
      expect(result.total).toBe(0);
      expect(result.new.count).toBe(0);
      expect(result.note).toBe('No permission roles found');
    });
  });

  // ⭐️⭐️⭐️ เพิ่ม test block ใหม่สำหรับ getCategoryBreakdown ⭐️⭐️⭐️
  describe('getCategoryBreakdown', () => {
    const mockRawData = [
      { categoryId: 1, categoryName: 'Bug', month: 1, count: '5' },
      { categoryId: 1, categoryName: 'Bug', month: 2, count: '3' },
      { categoryId: 2, categoryName: 'Feature', month: 1, count: '10' },
    ];

    beforeEach(() => {
      // ⭐️ Mock getRawMany ให้คืนค่าข้อมูลดิบ
      jest.spyOn(mockQueryBuilder, 'getRawMany').mockResolvedValue(mockRawData);
    });

    it('should return breakdown for Admin (Role 19 - All tickets)', async () => {
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValue([19]);
      
      const result = await service.getCategoryBreakdown(2025, 101);

      // ⭐️ Admin ต้องไม่ filter
      expect(mockQueryBuilder.innerJoin).not.toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith(
        't.create_by = :userId', { userId: 101 }
      );
      
      // ⭐️ ตรวจสอบการคำนวณ
      expect(result.length).toBe(2); // 2 categories (Bug, Feature)
      expect(result[0].category).toBe('Bug');
      expect(result[0].count).toBe(8); // 5 + 3
      expect(result[0].monthlyCounts[0]).toBe(5); // month 1
      expect(result[0].monthlyCounts[1]).toBe(3); // month 2
      expect(result[1].category).toBe('Feature');
      expect(result[1].count).toBe(10);
      expect(result[1].monthlyCounts[0]).toBe(10); // month 1
      
      const total = 8 + 10;
      expect(result[0].percentage).toBe(Math.round((8 / total) * 100)); // 44%
      expect(result[1].percentage).toBe(Math.round((10 / total) * 100)); // 56%
    });
    
    it('should return breakdown for Supporter (Role 8 - Assigned tickets)', async () => {
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValue([8]);

      await service.getCategoryBreakdown(2025, 101);

      // ⭐️ Supporter ต้อง innerJoin
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'ticket_assigned', 'ta', 'ta.ticket_id = t.id AND ta.user_id = :userId', { userId: 101 }
      );
    });

    it('should return breakdown for Reporter (Role 1 - Own tickets)', async () => {
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValue([1]);

      await service.getCategoryBreakdown(2025, 101);

      // ⭐️ Reporter ต้อง andWhere
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        't.create_by = :userId', { userId: 101 }
      );
    });
    
    it('should return empty array if no permissions', async () => {
      jest.spyOn(service, 'checkUserPermissions').mockResolvedValue([]); // ไม่มีสิทธิ์

      const result = await service.getCategoryBreakdown(2025, 101);

      expect(result).toEqual([]);
      expect(mockQueryBuilder.getRawMany).not.toHaveBeenCalled(); // ⭐️ ต้องไม่ query
    });
  });
});