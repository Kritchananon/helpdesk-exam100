import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatusController } from './ticket_status.controller';
import { TicketStatusService } from './ticket_status.service';
import { CreateTicketStatusDto } from './dto/create-ticket_status.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';

describe('TicketStatusController', () => {
  let controller: TicketStatusController;
  let service: TicketStatusService;

  const mockTicketStatusService = {
    getStatusDDL: jest.fn(),
    createStatus: jest.fn(),
    getTicketStatusHistory: jest.fn(),
    getTicketStatusWithName: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketStatusController],
      providers: [
        {
          provide: TicketStatusService,
          useValue: mockTicketStatusService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<TicketStatusController>(TicketStatusController);
    service = module.get<TicketStatusService>(TicketStatusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatusDDL', () => {
    it('should call service with language_id when provided', async () => {
      const body = { language_id: 'en' };
      const expectedResult = {
        code: 1,
        message: 'Success',
        data: [
          { id: 1, name: 'Open', language_id: 'en' },
          { id: 2, name: 'In Progress', language_id: 'en' },
        ],
      };

      mockTicketStatusService.getStatusDDL.mockResolvedValue(expectedResult);

      const result = await controller.getStatusDDL(body);

      expect(service.getStatusDDL).toHaveBeenCalledWith('en');
      expect(result).toEqual(expectedResult);
    });

    it('should call service with undefined when language_id is not provided', async () => {
      const body = {};
      const expectedResult = {
        code: 1,
        message: 'Success',
        data: [],
      };

      mockTicketStatusService.getStatusDDL.mockResolvedValue(expectedResult);

      const result = await controller.getStatusDDL(body);

      expect(service.getStatusDDL).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors', async () => {
      const body = { language_id: 'en' };
      const expectedResult = {
        code: 0,
        message: 'Failed to fetch statuses',
        error: 'Database connection error',
      };

      mockTicketStatusService.getStatusDDL.mockResolvedValue(expectedResult);

      const result = await controller.getStatusDDL(body);

      expect(service.getStatusDDL).toHaveBeenCalledWith('en');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getTicketStatus', () => {
    it('should return ticket status successfully', async () => {
      const ticketId = 1;
      const mockRequest = {
        headers: { 'x-language': 'th' },
      };

      const mockTicketStatus = {
        ticket_id: 1,
        status_id: 2,
        status_name: 'กำลังดำเนินการ',
        language_id: 'th',
      };

      mockTicketStatusService.getTicketStatusWithName.mockResolvedValue(mockTicketStatus);

      const result = await controller.getTicketStatus(ticketId, mockRequest);

      expect(service.getTicketStatusWithName).toHaveBeenCalledWith(1, 'th');
      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: {
          ...mockTicketStatus,
          detected_language: 'th',
        },
      });
    });

    it('should return error when ticket not found', async () => {
      const ticketId = 999;
      const mockRequest = {
        headers: { 'accept-language': 'en' },
      };

      mockTicketStatusService.getTicketStatusWithName.mockResolvedValue(null);

      const result = await controller.getTicketStatus(ticketId, mockRequest);

      expect(result).toEqual({
        code: 0,
        message: 'Ticket 999 not found',
        data: null,
      });
    });

    it('should use default language when no language detected', async () => {
      const ticketId = 1;
      const mockRequest = { headers: {} };

      const mockTicketStatus = {
        ticket_id: 1,
        status_id: 1,
        status_name: 'เปิด',
        language_id: 'th',
      };

      mockTicketStatusService.getTicketStatusWithName.mockResolvedValue(mockTicketStatus);

      const result = await controller.getTicketStatus(ticketId, mockRequest);

      expect(service.getTicketStatusWithName).toHaveBeenCalledWith(1, 'th');
      expect(result.data?.detected_language).toBe('th');
    });

    it('should handle service errors', async () => {
      const ticketId = 1;
      const mockRequest = { headers: {} };

      mockTicketStatusService.getTicketStatusWithName.mockRejectedValue(
        new Error('Database error')
      );

      const result = await controller.getTicketStatus(ticketId, mockRequest);

      expect(result).toEqual({
        code: 0,
        message: 'Failed to get ticket status',
        error: 'Database error',
      });
    });
  });

  describe('createStatus', () => {
    it('should create status successfully', async () => {
      const createStatusDto: any = {
        statusLang: [
          { language_id: 'en', name: 'New Status' },
          { language_id: 'th', name: 'สถานะใหม่' },
        ],
      };

      const req = {
        user: { id: 1 },
      };

      const expectedResult = {
        code: 1,
        message: 'Status created successfully',
        data: {
          id: 1,
          create_by: 1,
          create_date: new Date(),
          isenabled: true,
          languages: [
            { id: 1, language_id: 'en', name: 'New Status' },
            { id: 1, language_id: 'th', name: 'สถานะใหม่' },
          ],
        },
      };

      mockTicketStatusService.createStatus.mockResolvedValue(expectedResult);

      const result = await controller.createStatus(createStatusDto, req);

      expect(createStatusDto.create_by).toBe(1);
      expect(service.createStatus).toHaveBeenCalledWith(createStatusDto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle user ID from different properties', async () => {
      // Test with user.sub
      const createStatusDto1: any = {
        statusLang: [
          { language_id: 'en', name: 'New Status' },
        ],
      };

      const reqWithSub = {
        user: { sub: 2 },
      };

      await controller.createStatus(createStatusDto1, reqWithSub);
      expect(createStatusDto1.create_by).toBe(2);

      // Reset and test with user.userId
      const createStatusDto2: any = {
        statusLang: [
          { language_id: 'en', name: 'New Status' },
        ],
      };

      const reqWithUserId = {
        user: { userId: 3 },
      };

      await controller.createStatus(createStatusDto2, reqWithUserId);
      expect(createStatusDto2.create_by).toBe(3);
    });

    it('should return error when status name already exists', async () => {
      const createStatusDto = {
        statusLang: [
          { language_id: 'en', name: 'Existing Status' },
        ],
      };

      const req = {
        user: { id: 1 },
      };

      const expectedResult = {
        code: 0,
        message: 'Status name "Existing Status" already exists for language "en"',
        data: {
          existing_category: {
            id: 1,
            name: 'Existing Status',
            language_id: 'en',
          },
        },
      };

      mockTicketStatusService.createStatus.mockResolvedValue(expectedResult);

      const result = await controller.createStatus(createStatusDto, req);

      expect(service.createStatus).toHaveBeenCalledWith(createStatusDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getTicketHistory', () => {
    it('should return ticket history successfully', async () => {
      const ticketId = 1;
      const mockHistory = [
        {
          id: 1,
          ticket_id: 1,
          status_id: 1,
          status_name: 'Open',
          create_date: new Date(),
          created_by_name: 'John Doe',
        },
        {
          id: 2,
          ticket_id: 1,
          status_id: 2,
          status_name: 'In Progress',
          create_date: new Date(),
          created_by_name: 'Jane Smith',
        },
      ];

      mockTicketStatusService.getTicketStatusHistory.mockResolvedValue(mockHistory);

      const result = await controller.getTicketHistory(ticketId);

      expect(service.getTicketStatusHistory).toHaveBeenCalledWith(ticketId);
      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: mockHistory,
      });
    });

    it('should handle service errors', async () => {
      const ticketId = 1;
      const errorMessage = 'Database connection error';

      mockTicketStatusService.getTicketStatusHistory.mockRejectedValue(
        new Error(errorMessage)
      );

      const result = await controller.getTicketHistory(ticketId);

      expect(result).toEqual({
        code: 2,
        message: errorMessage,
        data: null,
      });
    });

    it('should handle service errors without message', async () => {
      const ticketId = 1;

      mockTicketStatusService.getTicketStatusHistory.mockRejectedValue(
        new Error()
      );

      const result = await controller.getTicketHistory(ticketId);

      expect(result).toEqual({
        code: 2,
        message: 'Failed to get ticket history',
        data: null,
      });
    });
  });

  describe('getLanguage', () => {
    it('should detect language from query parameter', async () => {
      const ticketId = 1;
      const mockRequest = {
        query: { lang: 'en' },
        headers: {},
      };

      const mockTicketStatus = {
        ticket_id: 1,
        status_id: 1,
        status_name: 'Open',
        language_id: 'en',
      };

      mockTicketStatusService.getTicketStatusWithName.mockResolvedValue(mockTicketStatus);

      const result = await controller.getTicketStatus(ticketId, mockRequest);

      expect(service.getTicketStatusWithName).toHaveBeenCalledWith(1, 'en');
      expect(result.data?.detected_language).toBe('en');
    });

    it('should detect language from custom header', async () => {
      const ticketId = 1;
      const mockRequest = {
        query: {},
        headers: { 'x-language': 'th' },
      };

      const mockTicketStatus = {
        ticket_id: 1,
        status_id: 1,
        status_name: 'เปิด',
        language_id: 'th',
      };

      mockTicketStatusService.getTicketStatusWithName.mockResolvedValue(mockTicketStatus);

      const result = await controller.getTicketStatus(ticketId, mockRequest);

      expect(service.getTicketStatusWithName).toHaveBeenCalledWith(1, 'th');
    });

    it('should detect language from accept-language header', async () => {
      const ticketId = 1;
      const mockRequest = {
        query: {},
        headers: { 'accept-language': 'en-US,en;q=0.9,th;q=0.8' },
      };

      const mockTicketStatus = {
        ticket_id: 1,
        status_id: 1,
        status_name: 'Open',
        language_id: 'en',
      };

      mockTicketStatusService.getTicketStatusWithName.mockResolvedValue(mockTicketStatus);

      const result = await controller.getTicketStatus(ticketId, mockRequest);

      expect(service.getTicketStatusWithName).toHaveBeenCalledWith(1, 'en');
    });
  });
});