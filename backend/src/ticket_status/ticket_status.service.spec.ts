import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TicketStatusService } from './ticket_status.service';
import { TicketStatus } from './entities/ticket_status.entity';
import { TicketStatusLanguage } from '../ticket_status_language/entities/ticket_status_language.entity';
import { TicketStatusHistoryService } from '../ticket_status_history/ticket_status_history.service';
import { NotificationService } from '../notification/notification.service';
import { CreateTicketStatusDto } from './dto/create-ticket_status.dto';
import { PermissionService } from '../permission/permission.service';

describe('TicketStatusService', () => {
  let service: TicketStatusService;
  let statusRepo: Repository<TicketStatus>;
  let statusLangRepo: Repository<TicketStatusLanguage>;
  let historyService: TicketStatusHistoryService;
  let notificationService: NotificationService;
  let dataSource: DataSource;

  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
    getOne: jest.fn(),
  };

  const mockStatusRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockStatusLangRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockHistoryService = {
    getTicketHistory: jest.fn(),
  };

  const mockNotificationService = {
    createStatusChangeNotification: jest.fn(),
  };

  // ✅ เพิ่ม mock นี้เข้าไป
  const mockPermissionService = {
    // หาก service นี้มี method ที่ถูกเรียกใช้ ให้ mock ที่นี่
    // แต่ตอนนี้ยังไม่มีการเรียกใช้ ใช้วัตถุว่างๆ ก็ได้
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        insert: jest.fn().mockReturnThis(),
        into: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        execute: jest.fn(),
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
      })),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    query: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketStatusService,
        {
          provide: getRepositoryToken(TicketStatus),
          useValue: mockStatusRepo,
        },
        {
          provide: getRepositoryToken(TicketStatusLanguage),
          useValue: mockStatusLangRepo,
        },
        {
          provide: TicketStatusHistoryService,
          useValue: mockHistoryService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        // ✅ เพิ่มบรรทัดเหล่านี้
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TicketStatusService>(TicketStatusService);
    statusRepo = module.get<Repository<TicketStatus>>(getRepositoryToken(TicketStatus));
    statusLangRepo = module.get<Repository<TicketStatusLanguage>>(getRepositoryToken(TicketStatusLanguage));
    historyService = module.get<TicketStatusHistoryService>(TicketStatusHistoryService);
    notificationService = module.get<NotificationService>(NotificationService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getStatusDDL', () => {
    it('should return statuses with specific language filter', async () => {
      const mockResults = [
        { ts_id: 1, tsl_name: 'Open', tsl_language_id: 'en' },
        { ts_id: 2, tsl_name: 'In Progress', tsl_language_id: 'en' },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockResults);

      const result = await service.getStatusDDL('en');

      expect(mockStatusLangRepo.createQueryBuilder).toHaveBeenCalledWith('tsl');
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith('ticket_status', 'ts', 'ts.id = tsl.status_id');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('tsl.language_id = :languageId', { languageId: 'en' });
      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: [
          { id: 1, name: 'Open', language_id: 'en' },
          { id: 2, name: 'In Progress', language_id: 'en' },
        ],
      });
    });

    it('should return all statuses when no language filter provided', async () => {
      const mockResults = [
        { ts_id: 1, tsl_name: 'Open', tsl_language_id: 'en' },
        { ts_id: 2, tsl_name: 'เปิด', tsl_language_id: 'th' },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockResults);

      const result = await service.getStatusDDL();

      expect(mockStatusLangRepo.createQueryBuilder).toHaveBeenCalledWith('tsl');
      expect(mockQueryBuilder.where).not.toHaveBeenCalled();
      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: [
          { id: 1, name: 'Open', language_id: 'en' },
          { id: 2, name: 'เปิด', language_id: 'th' },
        ],
      });
    });

    it('should handle database errors', async () => {
      const errorMessage = 'Database connection error';
      mockQueryBuilder.getRawMany.mockRejectedValue(new Error(errorMessage));

      const result = await service.getStatusDDL('en');

      expect(result).toEqual({
        code: 0,
        message: 'Failed to fetch statuses',
        error: errorMessage,
      });
    });
  });

  describe('createStatus', () => {
    const createStatusDto: CreateTicketStatusDto = {
      create_by: 1,
      statusLang: [
        { language_id: 'en', name: 'New Status' },
        { language_id: 'th', name: 'สถานะใหม่' },
      ],
    };

    it('should create status successfully', async () => {
      const mockStatus = {
        id: 1,
        create_by: 1,
        create_date: new Date(),
        isenabled: true,
      };

      const mockLanguages = [
        { status_id: 1, language_id: 'en', name: 'New Status' },
        { status_id: 1, language_id: 'th', name: 'สถานะใหม่' },
      ];

      // Mock no existing statuses
      mockQueryBuilder.getOne.mockResolvedValue(null);
      
      // Mock status creation
      mockStatusRepo.create.mockReturnValue(mockStatus);
      mockStatusRepo.save.mockResolvedValue(mockStatus);
      
      // Mock language creation
      mockStatusLangRepo.create.mockReturnValueOnce(mockLanguages[0]).mockReturnValueOnce(mockLanguages[1]);
      mockStatusLangRepo.save.mockResolvedValueOnce(mockLanguages[0]).mockResolvedValueOnce(mockLanguages[1]);

      const result = await service.createStatus(createStatusDto);

      expect(mockStatusRepo.create).toHaveBeenCalledWith({
        create_by: 1,
        create_date: expect.any(Date),
        isenabled: true,
      });
      expect(mockStatusRepo.save).toHaveBeenCalledWith(mockStatus);
      expect(mockStatusLangRepo.create).toHaveBeenCalledTimes(2);
      expect(mockStatusLangRepo.save).toHaveBeenCalledTimes(2);
      expect(result.code).toBe(1);
      expect(result.message).toBe('Status created successfully');
    });

    it('should return error when status name already exists', async () => {
      const existingStatus = {
        status_id: 1,
        name: 'New Status',
        language_id: 'en',
      };

      mockQueryBuilder.getOne.mockResolvedValueOnce(existingStatus);

      const result = await service.createStatus(createStatusDto);

      expect(result).toEqual({
        code: 0,
        message: 'Status name "New Status" already exists for language "en"',
        data: {
          existing_category: {
            id: 1,
            name: 'New Status',
            language_id: 'en',
          },
        },
      });
    });

    it('should return error when duplicate language_id in request', async () => {
      const duplicateLanguageDto: CreateTicketStatusDto = {
        create_by: 1,
        statusLang: [
          { language_id: 'en', name: 'Status 1' },
          { language_id: 'en', name: 'Status 2' },
        ],
      };

      mockQueryBuilder.getOne.mockResolvedValue(null);

      const result = await service.createStatus(duplicateLanguageDto);

      expect(result).toEqual({
        code: 0,
        message: 'Duplicate language_id found in the request',
      });
    });

    it('should handle database errors during creation', async () => {
      const errorMessage = 'Database error';
      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockStatusRepo.create.mockReturnValue({});
      mockStatusRepo.save.mockRejectedValue(new Error(errorMessage));

      const result = await service.createStatus(createStatusDto);

      expect(result).toEqual({
        code: 0,
        message: 'Failed to create category',
        error: errorMessage,
      });
    });
  });

  describe('findAll', () => {
    it('should return all enabled statuses with languages', async () => {
      const mockStatuses = [
        {
          id: 1,
          create_by: 1,
          create_date: new Date(),
          isenabled: true,
          languages: [
            { status_id: 1, language_id: 'en', name: 'Open' },
          ],
        },
      ];

      mockStatusRepo.find.mockResolvedValue(mockStatuses);

      const result = await service.findAll();

      expect(mockStatusRepo.find).toHaveBeenCalledWith({
        relations: ['languages'],
        where: { isenabled: true },
      });
      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: mockStatuses,
      });
    });
  });

  describe('getTicketStatusWithName', () => {
    it('should return ticket status with name', async () => {
      const mockResult = {
        ticket_id: 1,
        status_id: 2,
        status_name: 'In Progress',
        language_id: 'en',
      };

      // Create a complete mock QueryBuilder with all required methods
      const mockDataSourceQueryBuilder = {
        ...mockQueryBuilder, // inherit all methods from the main mock
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(mockResult),
      };

      mockDataSource.createQueryBuilder.mockReturnValue(mockDataSourceQueryBuilder);

      const result = await service.getTicketStatusWithName(1, 'en');

      expect(mockDataSource.createQueryBuilder).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });

    it('should return null when ticket not found', async () => {
      const mockDataSourceQueryBuilder = {
        ...mockQueryBuilder,
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };

      mockDataSource.createQueryBuilder.mockReturnValue(mockDataSourceQueryBuilder);

      const result = await service.getTicketStatusWithName(999, 'en');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockDataSourceQueryBuilder = {
        ...mockQueryBuilder,
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockRejectedValue(new Error('Database error')),
      };

      mockDataSource.createQueryBuilder.mockReturnValue(mockDataSourceQueryBuilder);

      const result = await service.getTicketStatusWithName(1, 'en');

      expect(result).toBeNull();
    });
  });

  describe('validateStatusExists', () => {
    it('should return true when status exists', async () => {
      const mockStatus = {
        id: 1,
        isenabled: true,
      };

      mockStatusRepo.findOne.mockResolvedValue(mockStatus);

      const result = await service.validateStatusExists(1);

      expect(mockStatusRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1, isenabled: true },
      });
      expect(result).toBe(true);
    });

    it('should return false when status does not exist', async () => {
      mockStatusRepo.findOne.mockResolvedValue(null);

      const result = await service.validateStatusExists(999);

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      mockStatusRepo.findOne.mockRejectedValue(new Error('Database error'));

      const result = await service.validateStatusExists(1);

      expect(result).toBe(false);
    });
  });

  describe('getStatusWithName', () => {
    it('should return status with name', async () => {
      const mockResult = {
        id: 1,
        name: 'Open',
      };

      mockQueryBuilder.getRawOne.mockResolvedValue(mockResult);

      const result = await service.getStatusWithName(1, 'en');

      expect(mockStatusRepo.createQueryBuilder).toHaveBeenCalledWith('ts');
      expect(result).toEqual(mockResult);
    });

    it('should return null when status not found', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue(null);

      const result = await service.getStatusWithName(999, 'en');

      expect(result).toBeNull();
    });
  });

  describe('getAllActiveStatuses', () => {
    it('should return all active statuses', async () => {
      const mockResults = [
        { id: 1, name: 'Open' },
        { id: 2, name: 'In Progress' },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockResults);

      const result = await service.getAllActiveStatuses('en');

      expect(mockStatusRepo.createQueryBuilder).toHaveBeenCalledWith('ts');
      expect(result).toEqual(mockResults);
    });

    it('should handle database errors', async () => {
      mockQueryBuilder.getRawMany.mockRejectedValue(new Error('Database error'));

      const result = await service.getAllActiveStatuses('en');

      expect(result).toEqual([]);
    });
  });

  describe('getTicketStatusHistory', () => {
    it('should return ticket history from history service', async () => {
      const mockHistory = [
        {
          id: 1,
          ticket_id: 1,
          status_id: 1,
          status_name: 'Open',
          create_date: new Date(),
        },
      ];

      mockHistoryService.getTicketHistory.mockResolvedValue(mockHistory);

      const result = await service.getTicketStatusHistory(1);

      expect(historyService.getTicketHistory).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockHistory);
    });

    it('should handle history service errors', async () => {
      const errorMessage = 'History service error';
      mockHistoryService.getTicketHistory.mockRejectedValue(new Error(errorMessage));

      await expect(service.getTicketStatusHistory(1)).rejects.toThrow(errorMessage);
    });
  });

  describe('debugStatusData', () => {
    it('should return debug data successfully', async () => {
      const mockStatuses = [{ id: 1, name: 'Open' }];
      const mockLanguages = [{ status_id: 1, language_id: 'en', name: 'Open' }];

      mockStatusRepo.find.mockResolvedValue(mockStatuses);
      mockStatusLangRepo.find.mockResolvedValue(mockLanguages);

      const result = await service.debugStatusData();

      expect(result).toEqual({
        code: 1,
        message: 'Debug data retrieved',
        data: {
          status: mockStatuses,
          statusLanguages: mockLanguages,
          statussCount: 1,
          languagesCount: 1,
        },
      });
    });

    it('should handle errors in debug data retrieval', async () => {
      const errorMessage = 'Database error';
      mockStatusRepo.find.mockRejectedValue(new Error(errorMessage));

      const result = await service.debugStatusData();

      expect(result).toEqual({
        code: 0,
        message: 'Failed to retrieve debug data',
        error: errorMessage,
      });
    });
  });

  describe('validateCategoryData', () => {
    it('should return no errors for valid data', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const languages = [
        { language_id: 'en', name: 'Status 1' },
        { language_id: 'th', name: 'สถานะ 1' },
      ];

      const errors = await service.validateCategoryData(languages);

      expect(errors).toEqual([]);
    });

    it('should return error for duplicate language_id in request', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const languages = [
        { language_id: 'en', name: 'Status 1' },
        { language_id: 'en', name: 'Status 2' },
      ];

      const errors = await service.validateCategoryData(languages);

      expect(errors).toContain('Duplicate language_id found in the request');
    });
  });
});