import { Test, TestingModule } from '@nestjs/testing';
import { ExportExcelService } from './export-excel.service';
import { PermissionService } from '../permission/permission.service';
import { Ticket } from '../ticket/entities/ticket.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';

// --- Mocks ---

// 1. Mock ExcelJS
// เราต้อง mock constructor ของ Workbook และ method ที่เราใช้
const mockAddRow = jest.fn();
const mockGetRow = jest.fn(() => ({
  eachCell: jest.fn((callback) =>
    callback({
      // Mock cell object เพื่อให้ .font, .fill, .alignment ไม่ error
      font: {},
      fill: {},
      alignment: {},
    }),
  ),
}));
const mockAddWorksheet = jest.fn(() => ({
  columns: [], // service มีการ set columns
  addRow: mockAddRow,
  getRow: mockGetRow,
}));
const mockWrite = jest.fn().mockResolvedValue(undefined); // .xlsx.write(res)

jest.mock('exceljs', () => ({
  Workbook: jest.fn(() => ({
    addWorksheet: mockAddWorksheet,
    xlsx: {
      write: mockWrite,
    },
  })),
}));

// 2. Mock PermissionService
const mockPermissionService = {
  getUserPermissionInfo: jest.fn(),
  canReadAllTickets: jest.fn(),
  canReadTicketDetial: jest.fn(),
};

// 3. Mock TypeORM QueryBuilder
//    เราสร้าง mock object ที่สามารถ chain method ต่อได้ (.mockReturnThis)
const mockQueryBuilder = {
  leftJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(), // สุดท้าย getRawMany จะ return ข้อมูล
};

// 4. Mock Repository<Ticket>
const mockTicketRepo = {
  // เมื่อ service เรียก .createQueryBuilder() ให้ return mockQueryBuilder ของเรา
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
};

// 5. Mock Express Response
const mockResponse = {
  setHeader: jest.fn(),
  end: jest.fn(),
} as any as Response; // ใช้ as any as Response เพื่อให้ type ตรง

// --- Test Data ---
const mockTicketData = [
  {
    ticket_no: 'T-001',
    project_name: 'Project A',
    category_name: 'Bug',
    status_name: 'Open',
    reporter: 'John Doe',
    supporter: 'Jane Smith',
    create_date: '2025-01-01',
    due_date: '2025-01-10',
    lead_time: 9,
    rating: 5,
  },
];
const mockUserInfo = {
  roles: [{ roleId: 1 }],
};

describe('ExportExcelService', () => {
  let service: ExportExcelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportExcelService,
        {
          provide: getRepositoryToken(Ticket), // ระบุ Token ของ Repo
          useValue: mockTicketRepo, // ใช้ mock repo ของเรา
        },
        {
          provide: PermissionService, // ระบุ PermissionService
          useValue: mockPermissionService, // ใช้ mock service ของเรา
        },
      ],
    }).compile();

    service = module.get<ExportExcelService>(ExportExcelService);

    // เคลียร์ mock ทุกครั้งก่อนเทส
    jest.clearAllMocks();

    // ตั้งค่า default mock resolved values
    mockQueryBuilder.getRawMany.mockResolvedValue(mockTicketData);
    mockPermissionService.getUserPermissionInfo.mockResolvedValue(mockUserInfo);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw ForbiddenException if user has no view permissions', async () => {
    // Arrange: User ไม่มีสิทธิ์
    mockPermissionService.canReadAllTickets.mockResolvedValue(false);
    mockPermissionService.canReadTicketDetial.mockResolvedValue(false);

    // Act & Assert: ตรวจสอบว่า service โยน ForbiddenException
    await expect(service.exportTickets(mockResponse, {}, 1)).rejects.toThrow(
      ForbiddenException,
    );

    // ตรวจสอบว่ามีการเช็คสิทธิ์ครบ
    expect(mockPermissionService.getUserPermissionInfo).toHaveBeenCalledWith(1);
    expect(mockPermissionService.canReadAllTickets).toHaveBeenCalledWith(1, [1]);
    expect(mockPermissionService.canReadTicketDetial).toHaveBeenCalledWith(1, [1]);
  });

  it('should export all tickets for user with "canViewAll" permission', async () => {
    // Arrange: User มีสิทธิ์ดูทั้งหมด
    mockPermissionService.canReadAllTickets.mockResolvedValue(true);
    mockPermissionService.canReadTicketDetial.mockResolvedValue(false); // (canViewOwn เป็น false ก็ได้)

    // Act
    await service.exportTickets(mockResponse, {}, 1);

    // Assert
    // 1. ตรวจสอบว่า QueryBuilder ถูกเรียก แต่ *ไม่มี* การ .where() หรือ .andWhere() (เพราะดูได้ทั้งหมด)
    expect(mockTicketRepo.createQueryBuilder).toHaveBeenCalledWith('t');
    expect(mockQueryBuilder.where).not.toHaveBeenCalled();
    expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();

    // 2. ตรวจสอบว่ามีการดึงข้อมูล
    expect(mockQueryBuilder.getRawMany).toHaveBeenCalled();

    // 3. ตรวจสอบว่ามีการสร้าง Excel และใส่ข้อมูล
    expect(ExcelJS.Workbook).toHaveBeenCalled();
    expect(mockAddWorksheet).toHaveBeenCalledWith('Helpdesk Tickets');
    expect(mockAddRow).toHaveBeenCalledWith(mockTicketData[0]); // ตรวจสอบว่าข้อมูลถูก add

    // 4. ตรวจสอบว่ามีการ set Header และส่ง Response
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="tickets.xlsx"',
    );
    expect(mockWrite).toHaveBeenCalledWith(mockResponse);
    expect(mockResponse.end).toHaveBeenCalled();
  });

  it('should export only user\'s tickets with "canViewOwn" permission', async () => {
    // Arrange: User มีสิทธิ์ดูเฉพาะของตัวเอง
    const userId = 1;
    mockPermissionService.canReadAllTickets.mockResolvedValue(false);
    mockPermissionService.canReadTicketDetial.mockResolvedValue(true);

    // Act
    await service.exportTickets(mockResponse, {}, userId);

    // Assert
    // 1. ตรวจสอบว่า QueryBuilder ถูกเรียก และมี .where() เพื่อกรอง user
    expect(mockTicketRepo.createQueryBuilder).toHaveBeenCalledWith('t');
    expect(mockQueryBuilder.where).toHaveBeenCalledWith(
      't.create_by = :userId',
      { userId },
    );
    // 2. ไม่มีการ filter อื่นๆ
    expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();

    // 3. ตรวจสอบการดึงข้อมูลและส่ง response
    expect(mockQueryBuilder.getRawMany).toHaveBeenCalled();
    expect(mockWrite).toHaveBeenCalledWith(mockResponse);
  });

  it('should apply filters correctly when user has "canViewOwn" permission', async () => {
    // Arrange: User มีสิทธิ์ดูของตัวเอง และส่ง filter มาด้วย
    const userId = 1;
    const filter = {
      projectId: 5,
      statusId: 2,
      categoryId: 3,
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      keyword: 'test',
    };
    mockPermissionService.canReadAllTickets.mockResolvedValue(false);
    mockPermissionService.canReadTicketDetial.mockResolvedValue(true);

    // Act
    await service.exportTickets(mockResponse, filter, userId);

    // Assert
    // 1. ตรวจสอบ .where() หลัก
    expect(mockQueryBuilder.where).toHaveBeenCalledWith(
      't.create_by = :userId',
      { userId },
    );

    // 2. ตรวจสอบ .andWhere() ทั้งหมดว่าถูกเรียกตาม filter
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      't.project_id = :projectId',
      { projectId: filter.projectId },
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      't.status_id = :statusId',
      { statusId: filter.statusId },
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      't.categories_id = :categoryId',
      { categoryId: filter.categoryId },
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      't.create_date BETWEEN :start AND :end',
      {
        start: filter.startDate,
        end: filter.endDate,
      },
    );
    expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
      '(t.ticket_no ILIKE :keyword OR t.issue_description ILIKE :keyword OR u.firstname ILIKE :keyword OR su.firstname ILIKE :keyword)',
      { keyword: `%${filter.keyword}%` },
    );
  });
});