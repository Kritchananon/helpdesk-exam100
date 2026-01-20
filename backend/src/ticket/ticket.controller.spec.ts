// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { TicketStatusService } from '../ticket_status/ticket_status.service';
import {
  NotFoundException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from '../permission/permission.guard';

// ⭐️ สร้าง Mock Request (สำคัญมาก)
// เราจำลอง req object ที่ผ่าน JwtAuthGuard มาแล้ว
const mockRequest = (user: any | null = {
  id: 101,
  sub: 101,
  userId: 101,
  user_id: 101,
  permissions: [1, 2, 8, 13, 19], // ใส่ permission พื้นฐาน
}) => ({
  user: user,
  query: {},
  headers: {
    'accept-language': 'th,en;q=0.9',
  },
  protocol: 'http',
  get: jest.fn().mockReturnValue('localhost:3000'),
});

// ⭐️ Mock Service
const mockTicketService = {
  getDashboardStatsByUserId: jest.fn(),
  getCategoryBreakdown: jest.fn(),
  saveTicket: jest.fn(),
  getTicketData: jest.fn(),
  getAllTicket: jest.fn(),
  getPriorityDdl: jest.fn(),
  saveSupporter: jest.fn(),
  getAllMasterFilter: jest.fn(),
  updateTicket: jest.fn(),
  softDeleteTicket: jest.fn(),
  restoreTicketByNo: jest.fn(),
  getDeletedTickets: jest.fn(),
  saveSatisfaction: jest.fn(),
  checkTicketOwnership: jest.fn(),
  getRelatedTickets: jest.fn(),
};

const mockTicketStatusService = {
  updateTicketStatusAndHistory: jest.fn(),
  getTicketStatusWithName: jest.fn(),
};

describe('TicketController', () => {
  let controller: TicketController;
  let ticketService: jest.Mocked<TicketService>;
  let ticketStatusService: jest.Mocked<TicketStatusService>;

  beforeEach(async () => {
    // ⭐️ รีเซ็ต mock functions
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketController],
      providers: [
        {
          provide: TicketService,
          useValue: mockTicketService,
        },
        {
          provide: TicketStatusService,
          useValue: mockTicketStatusService,
        },
      ],
    })
      // ⭐️ เราข้ามการทดสอบ Guard จริง
      // ใน Unit Test เราสนใจแค่ว่า Controller ทำงานไหม
      // Guard ควรไปทดสอบใน E2E Test
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TicketController>(TicketController);
    ticketService = module.get(TicketService);
    ticketStatusService = module.get(TicketStatusService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // --- 1. Dashboard Endpoints ---

  describe('getDashboardStats', () => {
    it('should return dashboard stats successfully', async () => {
      const mockStats = { total: 10, new: { count: 5 } };
      ticketService.getDashboardStatsByUserId.mockResolvedValue(mockStats);
      const req = mockRequest();

      const result = await controller.getDashboardStats(null, req);

      expect(ticketService.getDashboardStatsByUserId).toHaveBeenCalledWith(101); // ⭐️ ดึง userId จาก token
      expect(result.code).toBe('1');
      expect(result.data).toEqual(mockStats);
    });

    it('should handle errors gracefully', async () => {
      ticketService.getDashboardStatsByUserId.mockRejectedValue(new Error('DB Error'));
      const req = mockRequest();

      await expect(controller.getDashboardStats(null, req)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should call service with userId from query if provided', async () => {
      const mockResult = [{ category: 'Test', count: 10 }];
      ticketService.getCategoryBreakdown.mockResolvedValue(mockResult);
      const req = mockRequest();

      const result = await controller.getCategoryBreakdown(req, '2025', '50'); // ⭐️ ส่ง userId = 50 มา

      expect(ticketService.getCategoryBreakdown).toHaveBeenCalledWith(2025, 50); // ⭐️ ต้องใช้ 50
      expect(result).toEqual(mockResult);
    });

    it('should call service with userId from token if not provided in query', async () => {
      ticketService.getCategoryBreakdown.mockResolvedValue([]);
      const req = mockRequest();

      await controller.getCategoryBreakdown(req, '2025', undefined); // ⭐️ ไม่ได้ส่ง userId มา

      expect(ticketService.getCategoryBreakdown).toHaveBeenCalledWith(2025, 101); // ⭐️ ต้องใช้ 101 (จาก token)
    });
  });

  // --- 2. Core Ticket Endpoints ---

  describe('saveTicket', () => {
    it('should save a new ticket successfully', async () => {
      const dto = { project_id: '1', categories_id: '1' };
      const mockResult = { ticket_id: 1, ticket_no: 'T-250500001' };
      ticketService.saveTicket.mockResolvedValue(mockResult);
      const req = mockRequest();

      const result = await controller.saveTicket(dto, req);

      expect(ticketService.saveTicket).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: 1 }), // ⭐️ ตรวจสอบว่า DTO ถูกแปลง
        101, // ⭐️ userId จาก token
      );
      expect(result.code).toBe(1);
      expect(result.ticket_no).toBe(mockResult.ticket_no);
    });

    it('should return error if user is not authenticated', async () => {
      const req = mockRequest(null); // ⭐️ user = null
      const result = await controller.saveTicket({}, req);
      expect(result.code).toBe(2);
      expect(result.message).toBe('User not authenticated properly');
    });
  });

  describe('getTicketData (POST /getTicketData)', () => {
    it('should get ticket data successfully', async () => {
      const mockData = { ticket: { ticket_no: 'T-123' } };
      ticketService.getTicketData.mockResolvedValue(mockData);
      const req = mockRequest();

      const result = await controller.getTicketData({ ticket_no: 'T-123' }, req);

      expect(ticketService.getTicketData).toHaveBeenCalledWith(
        'T-123',
        'http://localhost:3000', // ⭐️ baseUrl
      );
      expect(result.code).toBe(1);
      expect(result.data).toEqual(mockData);
    });

    it('should return error if ticket_no is missing', async () => {
      const req = mockRequest();
      const result = await controller.getTicketData({ ticket_no: ' ' }, req); // ⭐️ ส่งค่าว่าง
      expect(result.code).toBe(2);
      expect(result.message).toBe('กรุณาส่ง ticket_no');
    });
  });

  describe('getAllTicket (GET /getAllTicket)', () => {
    it('should get all tickets for user with filters', async () => {
      const mockResponse = { success: true, data: [], pagination: {} };
      ticketService.getAllTicket.mockResolvedValue(mockResponse);
      const req = mockRequest();

      const result = await controller.getAllTicket(
        req,
        '2', // page
        '50', // perPage
        '3', // status_id
        '4', // project_id
        '5', // categories_id
        '1', // priority
        'search keyword', // keyword
      );

      const expectedFilters = {
        status_id: 3,
        project_id: 4,
        categories_id: 5,
        priority: 1,
        keyword: 'search keyword',
      };

      expect(ticketService.getAllTicket).toHaveBeenCalledWith(
        101, // userId
        2, // page
        50, // perPage
        expectedFilters, // filters
      );
      expect(result.success).toBe(true);
    });
  });

  describe('saveSupporter (POST /saveSupporter/:ticket_no)', () => {
    it('should save supporter data successfully', async () => {
      ticketService.saveSupporter.mockResolvedValue({ success: true });
      const req = mockRequest();
      const mockFiles = [{} as Express.Multer.File];
      const body = { status_id: '3', user_id: '102', priority: '1' };

      const result = await controller.saveSupporter(
        'T-123',
        body,
        mockFiles,
        req,
      );

      expect(ticketService.saveSupporter).toHaveBeenCalledWith(
        'T-123',
        body,
        mockFiles,
        101, // ⭐️ currentUserId
        3, // status_id
        102, // assignTo
      );
      expect(result.success).toBe(true);
    });

    it('should throw HttpException if priority is invalid', async () => {
      const req = mockRequest();
      const body = { status_id: '3', priority: '99' }; // ⭐️ priority ไม่ถูกต้อง

      await expect(
        controller.saveSupporter('T-123', body, [], req),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getAllMasterFilter (POST /getAllMasterFilter)', () => {
    it('should return master filter data', async () => {
      const mockData = { categories: [], projects: [], status: [] };
      ticketService.getAllMasterFilter.mockResolvedValue(mockData);
      const req = mockRequest();

      const result = await controller.getAllMasterFilter(req);

      expect(ticketService.getAllMasterFilter).toHaveBeenCalledWith(101);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
    });
  });

  // --- 3. RESTful-like Endpoints (/tickets/...) ---

  describe('getTicketByNo (GET /tickets/:ticket_no)', () => {
    it('should get ticket by ticket number', async () => {
      const mockData = { ticket: { ticket_no: 'T-123' } };
      ticketService.getTicketData.mockResolvedValue(mockData);
      const req = mockRequest();

      const result = await controller.getTicketByNo('T-123', req);

      expect(ticketService.getTicketData).toHaveBeenCalledWith(
        'T-123',
        'http://localhost:3000',
      );
      expect(result.code).toBe(1);
    });
  });

  describe('updateTicketByNo (PATCH /tickets/:ticket_no)', () => {
    it('should update ticket successfully', async () => {
      const updateDto = { issue_description: 'Updated' };
      const mockTicket = { id: 1, ticket_no: 'T-123', ...updateDto };
      ticketService.updateTicket.mockResolvedValue(mockTicket);
      const req = mockRequest();

      const result = await controller.updateTicketByNo('T-123', updateDto, req);

      expect(ticketService.updateTicket).toHaveBeenCalledWith(
        'T-123',
        updateDto,
        101,
      );
      expect(result.code).toBe(1);
      expect(result.data.issue_description).toBe('Updated');
    });
  });

  describe('deleteTicketByNo (DELETE /tickets/:ticket_no)', () => {
    it('should soft delete a ticket', async () => {
      ticketService.softDeleteTicket.mockResolvedValue(undefined);
      const req = mockRequest();

      const result = await controller.deleteTicketByNo('T-123', req);

      expect(ticketService.softDeleteTicket).toHaveBeenCalledWith('T-123', 101);
      expect(result.code).toBe(1);
      expect(result.message).toBe('ลบตั๋วสำเร็จ');
    });
  });

  describe('restoreTicketByNo (POST /tickets/restore/:ticker_no)', () => {
    it('should restore a ticket', async () => {
      ticketService.restoreTicketByNo.mockResolvedValue(undefined);
      const req = mockRequest();

      const result = await controller.restoreTicketByNo('T-123', req);

      expect(ticketService.restoreTicketByNo).toHaveBeenCalledWith('T-123', 101);
      expect(result.code).toBe(1);
      expect(result.message).toBe('กู้คืนตั๋วสำเร็จ');
    });
  });

  describe('getDeletedTickets (GET /tickets/deleted)', () => {
    // ⭐️ ชื่อ method ใน controller คือ softDeleteTicket
    it('should return a list of deleted tickets', async () => {
      const mockDeletedTickets = [{ ticket_no: 'T-999' }];
      ticketService.getDeletedTickets.mockResolvedValue(mockDeletedTickets);
      const req = mockRequest();

      const result = await controller.softDeleteTicket(req);

      expect(ticketService.getDeletedTickets).toHaveBeenCalled();
      expect(result.code).toBe(1);
      expect(result.data).toEqual(mockDeletedTickets);
    });
  });

  // --- 4. Other Endpoints ---

  describe('updateTicketStatus (PATCH /updateTicketStatus/:id)', () => {
    it('should update ticket status', async () => {
      const body = { status_id: 3, fix_issue_description: 'Fixed' };
      ticketStatusService.updateTicketStatusAndHistory.mockResolvedValue({
        success: true,
      });
      const req = mockRequest();

      const result = await controller.updateTicketStatus(1, body, req);

      expect(
        ticketStatusService.updateTicketStatusAndHistory,
      ).toHaveBeenCalledWith(1, 3, 101, 'Fixed');
      expect(result.code).toBe(1);
    });
  });

  describe('saveSatisfaction (POST /satisfaction/:ticket_no)', () => {
    it('should save satisfaction rating successfully', async () => {
      const createDto = { rating: 5, comment: 'Great!' };
      const mockResult = { id: 1, ...createDto };
      ticketService.saveSatisfaction.mockResolvedValue(mockResult);
      const req = mockRequest();

      const result = await controller.saveSatisfaction(
        'T-123',
        createDto,
        req,
      );

      expect(ticketService.saveSatisfaction).toHaveBeenCalledWith(
        'T-123',
        createDto,
        101,
      );
      expect(result.success).toBe(true);
    });
  });

  describe('getTicketStatus (GET /:id/status)', () => {
    it('should return ticket status successfully', async () => {
      const mockStatus = { status_name: 'Open', language_id: 'th' };
      // ⭐️ Mock private method `canAccessTicket`
      // @ts-ignore
      jest.spyOn(controller, 'canAccessTicket').mockResolvedValue(true);
      ticketStatusService.getTicketStatusWithName.mockResolvedValue(mockStatus);
      const req = mockRequest();

      const result = await controller.getTicketStatus(1, req);

      expect(controller['canAccessTicket']).toHaveBeenCalledWith(101, 1, [
        1, 2, 8, 13, 19,
      ]);
      expect(ticketStatusService.getTicketStatusWithName).toHaveBeenCalledWith(
        1,
        'th', // ⭐️ ตรวจสอบว่า `getLanguage` ทำงาน
      );
      expect(result.code).toBe(1);
      expect(result.data.status_name).toBe('Open');
    });

    it('should throw ForbiddenException if user has no access', async () => {
      // ⭐️ Mock private method `canAccessTicket` ให้ return false
      // @ts-ignore
      jest.spyOn(controller, 'canAccessTicket').mockResolvedValue(false);
      const req = mockRequest();

      await expect(controller.getTicketStatus(1, req)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if ticket status not found', async () => {
      // @ts-ignore
      jest.spyOn(controller, 'canAccessTicket').mockResolvedValue(true);
      // ⭐️ Mock service ให้ return null
      ticketStatusService.getTicketStatusWithName.mockResolvedValue(null);
      const req = mockRequest();

      await expect(controller.getTicketStatus(1, req)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRelatedTickets (GET /getTicketRelate)', () => {
    it('should return related tickets', async () => {
      const mockTickets = [{ ticket_no: 'T-001' }];
      ticketService.getRelatedTickets.mockResolvedValue(mockTickets);
      
      const result = await controller.getRelatedTickets(1, 2);

      expect(ticketService.getRelatedTickets).toHaveBeenCalledWith(1, 2);
      expect(result).toEqual(mockTickets);
    });
  });
});