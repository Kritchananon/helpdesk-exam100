import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TicketStatusHistoryService } from './ticket_status_history.service';
import { TicketStatusHistory } from './entities/ticket_status_history.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Users } from '../users/entities/user.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('TicketStatusHistoryService', () => {
  let service: TicketStatusHistoryService;
  let historyRepo: Repository<TicketStatusHistory>;
  let ticketRepo: Repository<Ticket>;
  let userRepo: Repository<Users>;
  let dataSource: DataSource;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(), // <--- ✅ เพิ่มบรรทัดนี้
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
  };

  const mockHistoryRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockTicketRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockUserRepo = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockDataSource = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketStatusHistoryService,
        {
          provide: getRepositoryToken(TicketStatusHistory),
          useValue: mockHistoryRepo,
        },
        {
          provide: getRepositoryToken(Ticket),
          useValue: mockTicketRepo,
        },
        {
          provide: getRepositoryToken(Users),
          useValue: mockUserRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TicketStatusHistoryService>(TicketStatusHistoryService);
    historyRepo = module.get<Repository<TicketStatusHistory>>(getRepositoryToken(TicketStatusHistory));
    ticketRepo = module.get<Repository<Ticket>>(getRepositoryToken(Ticket));
    userRepo = module.get<Repository<Users>>(getRepositoryToken(Users));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createHistory', () => {
    it('should create history successfully', async () => {
      const createData = {
        ticket_id: 1,
        status_id: 2,
        create_by: 1,
      };

      const mockTicket = {
        id: 1,
        isenabled: true,
      };

      const mockHistory = {
        id: 1,
        ticket_id: 1,
        status_id: 2,
        create_by: 1,
        create_date: new Date(),
      };

      mockTicketRepo.findOne.mockResolvedValue(mockTicket);
      mockHistoryRepo.create.mockReturnValue(mockHistory);
      mockHistoryRepo.save.mockResolvedValue(mockHistory);

      const result = await service.createHistory(createData);

      expect(mockTicketRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1, isenabled: true },
      });
      expect(mockHistoryRepo.create).toHaveBeenCalledWith({
        ticket_id: 1,
        status_id: 2,
        create_by: 1,
      });
      expect(mockHistoryRepo.save).toHaveBeenCalledWith(mockHistory);
      expect(result).toEqual(mockHistory);
    });

    it('should throw BadRequestException for missing required fields', async () => {
      const invalidData = {
        ticket_id: 1,
        // missing status_id and create_by
      } as any;

      await expect(service.createHistory(invalidData)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when ticket not found', async () => {
      const createData = {
        ticket_id: 999,
        status_id: 2,
        create_by: 1,
      };

      mockTicketRepo.findOne.mockResolvedValue(null);

      await expect(service.createHistory(createData)).rejects.toThrow(NotFoundException);
    });

    it('should handle database errors', async () => {
      const createData = {
        ticket_id: 1,
        status_id: 2,
        create_by: 1,
      };

      const mockTicket = { id: 1, isenabled: true };
      const errorMessage = 'Database error';

      mockTicketRepo.findOne.mockResolvedValue(mockTicket);
      mockHistoryRepo.create.mockReturnValue({});
      mockHistoryRepo.save.mockRejectedValue(new Error(errorMessage));

      await expect(service.createHistory(createData)).rejects.toThrow(errorMessage);
    });
  });

  describe('getTicketHistory', () => {
    it('should return ticket history successfully', async () => {
      const ticketId = 1;
      const mockTicket = {
        id: 1,
        ticket_no: 'T-001',
        isenabled: true,
      };

      const mockHistory = [
        {
          id: 1,
          ticket_id: 1,
          status_id: 2,
          create_by: 1,
          create_date: new Date(),
          status_name: 'In Progress',
          created_by_name: 'John Doe',
        },
      ];

      mockTicketRepo.findOne.mockResolvedValue(mockTicket);
      mockQueryBuilder.getRawMany.mockResolvedValue(mockHistory);

      const result = await service.getTicketHistory(ticketId);

      expect(mockTicketRepo.findOne).toHaveBeenCalledWith({
        where: { id: ticketId, isenabled: true },
      });
      expect(mockHistoryRepo.createQueryBuilder).toHaveBeenCalledWith('tsh');
      expect(result).toEqual(mockHistory);
    });

    it('should throw NotFoundException when ticket not found', async () => {
      const ticketId = 999;

      mockTicketRepo.findOne.mockResolvedValue(null);

      await expect(service.getTicketHistory(ticketId)).rejects.toThrow(NotFoundException);
    });

    it('should handle database errors', async () => {
      const ticketId = 1;
      const errorMessage = 'Database error';

      mockTicketRepo.findOne.mockRejectedValue(new Error(errorMessage));

      await expect(service.getTicketHistory(ticketId)).rejects.toThrow(errorMessage);
    });
  });

  describe('getCurrentTicketStatus', () => {
    it('should return current ticket status', async () => {
      const ticketId = 1;
      const mockResult = [
        {
          id: 1,
          ticket_id: 1,
          status_id: 2,
          status_name: 'In Progress',
          create_date: new Date(),
          created_by_name: 'John Doe',
        },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockResult);

      const result = await service.getCurrentTicketStatus(ticketId);

      expect(mockHistoryRepo.createQueryBuilder).toHaveBeenCalledWith('tsh');
      expect(result).toEqual(mockResult[0]);
    });

    it('should return null when no history found', async () => {
      const ticketId = 999;

      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      const result = await service.getCurrentTicketStatus(ticketId);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const ticketId = 1;

      mockQueryBuilder.getRawMany.mockRejectedValue(new Error('Database error'));

      const result = await service.getCurrentTicketStatus(ticketId);

      expect(result).toBeNull();
    });
  });

  describe('debugStatusChange', () => {
    it('should return debug information', async () => {
      const ticketId = 1;
      const mockCurrentStatus = {
        current_status_id: 2,
        current_status_name: 'In Progress',
      };
      const mockRecentHistory = [
        { id: 1, status_id: 2, status_name: 'In Progress' },
      ];

      jest.spyOn(service, 'getCurrentTicketStatus').mockResolvedValue(mockCurrentStatus as any);
      mockQueryBuilder.getRawMany.mockResolvedValue(mockRecentHistory);

      const result = await service.debugStatusChange(ticketId);

      expect(result).toEqual({
        current_ticket_status: mockCurrentStatus,
        recent_history: mockRecentHistory,
        status_mismatch: false,
      });
    });

    it('should detect status mismatch', async () => {
      const ticketId = 1;
      const mockCurrentStatus = {
        current_status_id: 1,
        current_status_name: 'Open',
      };
      const mockRecentHistory = [
        { id: 1, status_id: 2, status_name: 'In Progress' },
      ];

      jest.spyOn(service, 'getCurrentTicketStatus').mockResolvedValue(mockCurrentStatus as any);
      mockQueryBuilder.getRawMany.mockResolvedValue(mockRecentHistory);

      const result = await service.debugStatusChange(ticketId);

      expect(result.status_mismatch).toBe(true);
    });
  });

  describe('syncTicketStatus', () => {
    it('should sync ticket status successfully', async () => {
      const ticketId = 1;
      const mockLatestHistory = [{ status_id: 2, create_date: new Date() }];
      const mockCurrentTicket = { id: 1, status_id: 1 };

      mockDataSource.query.mockResolvedValue(mockLatestHistory);
      mockTicketRepo.findOne.mockResolvedValue(mockCurrentTicket);
      mockTicketRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.syncTicketStatus(ticketId);

      expect(mockTicketRepo.update).toHaveBeenCalledWith(ticketId, {
        status_id: 2,
        update_date: expect.any(Date),
      });
      expect(result).toEqual({
        success: true,
        message: 'Status synced successfully',
        old_status: 1,
        new_status: 2,
      });
    });

    it('should return message when status already in sync', async () => {
      const ticketId = 1;
      const mockLatestHistory = [{ status_id: 2, create_date: new Date() }];
      const mockCurrentTicket = { id: 1, status_id: 2 };

      mockDataSource.query.mockResolvedValue(mockLatestHistory);
      mockTicketRepo.findOne.mockResolvedValue(mockCurrentTicket);

      const result = await service.syncTicketStatus(ticketId);

      expect(mockTicketRepo.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Status already in sync',
        old_status: 2,
        new_status: 2,
      });
    });

    it('should handle no history found', async () => {
      const ticketId = 1;

      mockDataSource.query.mockResolvedValue([]);

      const result = await service.syncTicketStatus(ticketId);

      expect(result).toEqual({
        success: false,
        message: 'No history found for this ticket',
        old_status: 0,
        new_status: 0,
      });
    });

    it('should handle ticket not found', async () => {
      const ticketId = 999;
      const mockLatestHistory = [{ status_id: 2, create_date: new Date() }];

      mockDataSource.query.mockResolvedValue(mockLatestHistory);
      mockTicketRepo.findOne.mockResolvedValue(null);

      const result = await service.syncTicketStatus(ticketId);

      expect(result).toEqual({
        success: false,
        message: 'Ticket not found',
        old_status: 0,
        new_status: 0,
      });
    });
  });

  describe('getStatusName', () => {
    it('should return status name', async () => {
      const statusId = 1;
      const mockResult = [{ name: 'Open' }];

      mockQueryBuilder.getRawOne.mockResolvedValue(mockResult);

      const result = await service.getStatusName(statusId);

      expect(result).toBe('Open');
    });

    it('should return default name when status not found', async () => {
      const statusId = 999;

      mockQueryBuilder.getRawOne.mockResolvedValue([]);

      const result = await service.getStatusName(statusId);

      expect(result).toBe('Status 999');
    });

    it('should handle database errors', async () => {
      const statusId = 1;

      mockQueryBuilder.getRawOne.mockRejectedValue(new Error('Database error'));

      const result = await service.getStatusName(statusId);

      expect(result).toBe('Status 1');
    });
  });

  describe('getUserName', () => {
    it('should return user name', async () => {
      const userId = 1;
      const mockResult = [{ name: 'John Doe' }];

      mockQueryBuilder.getRawOne.mockResolvedValue(mockResult);

      const result = await service.getUserName(userId);

      expect(result).toBe('John Doe');
    });

    it('should return default name when user not found', async () => {
      const userId = 999;

      mockQueryBuilder.getRawOne.mockResolvedValue([]);

      const result = await service.getUserName(userId);

      expect(result).toBe('User 999');
    });
  });

  describe('validateStatus', () => {
    it('should return true for valid status', async () => {
      const statusId = 1;
      const statusName = 'Open';

      jest.spyOn(service, 'getStatusName').mockResolvedValue('Open');

      const result = await service.validateStatus(statusId, statusName);

      expect(result).toBe(true);
    });

    it('should return false for invalid status', async () => {
      const statusId = 1;
      const statusName = 'Invalid';

      jest.spyOn(service, 'getStatusName').mockResolvedValue('Open');

      const result = await service.validateStatus(statusId, statusName);

      expect(result).toBe(false);
    });

    it('should handle errors', async () => {
      const statusId = 1;
      const statusName = 'Open';

      jest.spyOn(service, 'getStatusName').mockRejectedValue(new Error('Database error'));

      const result = await service.validateStatus(statusId, statusName);

      expect(result).toBe(false);
    });
  });
});