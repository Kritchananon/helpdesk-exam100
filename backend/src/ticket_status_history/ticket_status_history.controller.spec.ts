import { Test, TestingModule } from '@nestjs/testing';
import { TicketStatusHistoryController } from './ticket_status_history.controller';
import { TicketStatusHistoryService } from './ticket_status_history.service';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { NotFoundException, BadRequestException , InternalServerErrorException } from '@nestjs/common';

describe('TicketStatusHistoryController', () => {
  let controller: TicketStatusHistoryController;
  let service: TicketStatusHistoryService;

  const mockTicketStatusHistoryService = {
    getCurrentTicketStatus: jest.fn(),
    createHistory: jest.fn(),
    getStatusName: jest.fn(),
    validateStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketStatusHistoryController],
      providers: [
        {
          provide: TicketStatusHistoryService,
          useValue: mockTicketStatusHistoryService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<TicketStatusHistoryController>(TicketStatusHistoryController);
    service = module.get<TicketStatusHistoryService>(TicketStatusHistoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCurrentStatus', () => {
    it('should return current status successfully', async () => {
      const ticketId = 1;
      const mockCurrentStatus = {
        ticket_id: 1,
        current_status_id: 2,
        current_status_name: 'In Progress',
        last_updated: new Date(),
      };

      const req = { user: { id: 1 } };

      mockTicketStatusHistoryService.getCurrentTicketStatus.mockResolvedValue(mockCurrentStatus);

      const result = await controller.getCurrentStatus(ticketId, req);

      expect(service.getCurrentTicketStatus).toHaveBeenCalledWith(ticketId);
      expect(result).toEqual({
        success: true,
        message: 'Current status retrieved',
        data: mockCurrentStatus,
      });
    });

    it('should throw NotFoundException when ticket not found', async () => {
      const ticketId = 1;
      const req = { user: { id: 1 } };

      mockTicketStatusHistoryService.getCurrentTicketStatus.mockResolvedValue(null);

      await expect(controller.getCurrentStatus(ticketId, req)).rejects.toThrow(NotFoundException);
      expect(service.getCurrentTicketStatus).toHaveBeenCalledWith(ticketId);
    });

    it('should handle service errors', async () => {
      const ticketId = 1;
      const req = { user: { id: 1 } };
      const errorMessage = 'Database error';

      mockTicketStatusHistoryService.getCurrentTicketStatus.mockRejectedValue(new Error(errorMessage));

      await expect(controller.getCurrentStatus(ticketId, req))
        .rejects
        .toThrow(InternalServerErrorException);

      expect(service.getCurrentTicketStatus).toHaveBeenCalledWith(ticketId);
    });
  });

  describe('createHistory', () => {
    it('should create history successfully', async () => {
      const ticketId = 1;
      const createDto = { status_id: 2 };
      const req = { user: { id: 1, username: 'testuser' } };

      const mockHistory = {
        id: 1,
        ticket_id: 1,
        status_id: 2,
        create_by: 1,
        create_date: new Date(),
      };

      const mockStatusName = 'In Progress';

      mockTicketStatusHistoryService.createHistory.mockResolvedValue(mockHistory);
      mockTicketStatusHistoryService.getStatusName.mockResolvedValue(mockStatusName);

      const result = await controller.createHistory(ticketId, createDto, req);

      expect(service.createHistory).toHaveBeenCalledWith({
        ticket_id: ticketId,
        status_id: createDto.status_id,
        create_by: req.user.id,
      });
      expect(service.getStatusName).toHaveBeenCalledWith(createDto.status_id);
      expect(result).toEqual({
        success: true,
        message: 'History entry created successfully',
        data: {
          id: mockHistory.id,
          ticket_id: mockHistory.ticket_id,
          status_id: mockHistory.status_id,
          status_name: mockStatusName,
          create_by: mockHistory.create_by,
          create_date: mockHistory.create_date,
          created_by_user: req.user.username,
        },
      });
    });

    it('should handle user email when username not available', async () => {
      const ticketId = 1;
      const createDto = { status_id: 2 };
      const req = { user: { id: 1, email: 'test@example.com' } };

      const mockHistory = {
        id: 1,
        ticket_id: 1,
        status_id: 2,
        create_by: 1,
        create_date: new Date(),
      };

      mockTicketStatusHistoryService.createHistory.mockResolvedValue(mockHistory);
      mockTicketStatusHistoryService.getStatusName.mockResolvedValue('In Progress');

      const result = await controller.createHistory(ticketId, createDto, req);

      expect(result.data.created_by_user).toBe(req.user.email);
    });

    it('should handle service errors', async () => {
      const ticketId = 1;
      const createDto = { status_id: 2 };
      const req = { user: { id: 1 } };
      const errorMessage = 'Database error';

      mockTicketStatusHistoryService.createHistory.mockRejectedValue(new Error(errorMessage));

      await expect(controller.createHistory(ticketId, createDto, req)).rejects.toThrow(errorMessage);
    });
  });

  describe('logStatusChange', () => {
    it('should log status change successfully', async () => {
      const ticketId = 1;
      const body = { status_id: 2, status_name: 'In Progress' };
      const req = { user: { id: 1, username: 'testuser' } };

      const mockHistory = {
        id: 1,
        ticket_id: 1,
        status_id: 2,
        create_by: 1,
        create_date: new Date(),
      };

      const mockStatusName = 'In Progress';

      mockTicketStatusHistoryService.validateStatus.mockResolvedValue(true);
      mockTicketStatusHistoryService.createHistory.mockResolvedValue(mockHistory);
      mockTicketStatusHistoryService.getStatusName.mockResolvedValue(mockStatusName);

      const result = await controller.logStatusChange(ticketId, body, req);

      expect(service.validateStatus).toHaveBeenCalledWith(body.status_id, body.status_name);
      expect(service.createHistory).toHaveBeenCalledWith({
        ticket_id: ticketId,
        status_id: body.status_id,
        create_by: req.user.id,
      });
      expect(result).toEqual({
        success: true,
        message: 'Status change logged successfully',
        data: {
          id: mockHistory.id,
          ticket_id: ticketId,
          status_id: body.status_id,
          status_name: mockStatusName,
          create_date: mockHistory.create_date,
          changed_by: req.user.username,
        },
      });
    });

    it('should work without status_name validation', async () => {
      const ticketId = 1;
      const body = { status_id: 2 };
      const req = { user: { id: 1, email: 'test@example.com' } };

      const mockHistory = {
        id: 1,
        ticket_id: 1,
        status_id: 2,
        create_by: 1,
        create_date: new Date(),
      };

      mockTicketStatusHistoryService.createHistory.mockResolvedValue(mockHistory);
      mockTicketStatusHistoryService.getStatusName.mockResolvedValue('In Progress');

      const result = await controller.logStatusChange(ticketId, body, req);

      expect(service.validateStatus).not.toHaveBeenCalled();
      expect(service.createHistory).toHaveBeenCalledWith({
        ticket_id: ticketId,
        status_id: body.status_id,
        create_by: req.user.id,
      });
      expect(result.data.changed_by).toBe(req.user.email);
    });

    it('should throw BadRequestException for invalid status', async () => {
      const ticketId = 1;
      const body = { status_id: 2, status_name: 'tracking status' };
      const req = { user: { id: 1 } };

      mockTicketStatusHistoryService.validateStatus.mockResolvedValue(false);

      await expect(controller.logStatusChange(ticketId, body, req)).rejects.toThrow(BadRequestException);
      expect(service.validateStatus).toHaveBeenCalledWith(body.status_id, body.status_name);
    });

    it('should handle service errors', async () => {
      const ticketId = 1;
      const body = { status_id: 2 };
      const req = { user: { id: 1 } };
      const errorMessage = 'Database error';

      mockTicketStatusHistoryService.createHistory.mockRejectedValue(new Error(errorMessage));

      await expect(controller.logStatusChange(ticketId, body, req)).rejects.toThrow(errorMessage);
    });
  });
});