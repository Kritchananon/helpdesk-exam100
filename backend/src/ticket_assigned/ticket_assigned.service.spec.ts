import { Test, TestingModule } from '@nestjs/testing';
import { TicketAssignedService } from './ticket_assigned.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketAssigned } from './entities/ticket_assigned.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Users } from '../users/entities/user.entity';
import { PermissionService } from '../permission/permission.service';
import { NotificationService } from '../notification/notification.service';
import { UserAllowRoleService } from '../user_allow_role/user_allow_role.service';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

// --- Mocks ---
const mockTicketAssignedRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

const mockTicketRepository = {
  findOne: jest.fn(),
};

const mockUsersRepository = {
  findOne: jest.fn(),
  findOneBy: jest.fn(),
};

const mockPermissionService = {
  canAssignTicket: jest.fn(),
  getUserPermissionInfo: jest.fn(),
};

const mockNotificationService = {
  createAssignmentNotification: jest.fn(),
};

const mockUserAllowRoleService = {
  getUsersByRole: jest.fn(),
};

// --- Test Suite ---
describe('TicketAssignedService', () => {
  let service: TicketAssignedService;
  let ticketRepo: typeof mockTicketRepository;
  let assignRepo: typeof mockTicketAssignedRepository;
  let userRepo: typeof mockUsersRepository;
  let permissionService: typeof mockPermissionService;
  let notiService: typeof mockNotificationService;
  let allowRoleService: typeof mockUserAllowRoleService;

  beforeEach(async () => {
    jest.clearAllMocks(); // เคลียร์ mock ทุกครั้งก่อนรันเทสใหม่
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketAssignedService,
        {
          provide: getRepositoryToken(Ticket),
          useValue: mockTicketRepository,
        },
        {
          provide: getRepositoryToken(TicketAssigned),
          useValue: mockTicketAssignedRepository,
        },
        {
          provide: getRepositoryToken(Users),
          useValue: mockUsersRepository,
        },
        {
          provide: PermissionService,
          useValue: mockPermissionService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: UserAllowRoleService,
          useValue: mockUserAllowRoleService,
        },
      ],
    }).compile();

    service = module.get<TicketAssignedService>(TicketAssignedService);
    ticketRepo = module.get(getRepositoryToken(Ticket));
    assignRepo = module.get(getRepositoryToken(TicketAssigned));
    userRepo = module.get(getRepositoryToken(Users));
    permissionService = module.get(PermissionService);
    notiService = module.get(NotificationService);
    allowRoleService = module.get(UserAllowRoleService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('assignTicketByTicketNo', () => {
    // --- Mock Data ---
    const mockTicket = { id: 1, ticket_no: 'T-001' };
    const mockAssignee = { id: 2, firstname: 'Assigned', lastname: 'User' };
    const mockRole9Users = [{ id: 2, firstname: 'Assigned', lastname: 'User' }];
    const mockPermissionInfo = {
        permissions: [{ permissionId: 19 }]
    };

    // --- Original Tests (ยังคงอยู่) ---
    it('should throw ForbiddenException if user has no permission', async () => {
      mockPermissionService.getUserPermissionInfo.mockResolvedValue({ permissions: [] }); // ไม่มีสิทธิ์
      mockPermissionService.canAssignTicket.mockResolvedValue(false);
      
      await expect(service.assignTicketByTicketNo('T-001', 2, 1)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if ticket is not found', async () => {
      mockPermissionService.getUserPermissionInfo.mockResolvedValue(mockPermissionInfo);
      mockPermissionService.canAssignTicket.mockResolvedValue(true);
      mockTicketRepository.findOne.mockResolvedValue(null); // ไม่พบ Ticket

      await expect(service.assignTicketByTicketNo('T-001', 2, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if assignedTo user is not found', async () => {
      mockPermissionService.getUserPermissionInfo.mockResolvedValue(mockPermissionInfo);
      mockPermissionService.canAssignTicket.mockResolvedValue(true);
      mockTicketRepository.findOne.mockResolvedValue(mockTicket);
      mockUserAllowRoleService.getUsersByRole.mockResolvedValue(mockRole9Users);
      mockUsersRepository.findOne.mockResolvedValue(null); // ไม่พบ User ที่จะ assign

      await expect(service.assignTicketByTicketNo('T-001', 99, 1)).rejects.toThrow(NotFoundException);
    });
    
    it('should throw BadRequestException if assignedTo user is not in role 9', async () => {
      mockPermissionService.getUserPermissionInfo.mockResolvedValue(mockPermissionInfo);
      mockPermissionService.canAssignTicket.mockResolvedValue(true);
      mockTicketRepository.findOne.mockResolvedValue(mockTicket);
      mockUsersRepository.findOne.mockResolvedValue({ id: 99, firstname: 'Invalid', lastname: 'User' });
      mockUserAllowRoleService.getUsersByRole.mockResolvedValue(mockRole9Users); // User ID 99 ไม่อยู่ใน list นี้

      await expect(service.assignTicketByTicketNo('T-001', 99, 1)).rejects.toThrow(BadRequestException);
    });

    // --- ADDED TEST ---
    it('should throw BadRequestException if ticket is already assigned', async () => {
      mockPermissionService.getUserPermissionInfo.mockResolvedValue(mockPermissionInfo);
      mockPermissionService.canAssignTicket.mockResolvedValue(true);
      mockTicketRepository.findOne.mockResolvedValue(mockTicket);
      mockUsersRepository.findOne.mockResolvedValue(mockAssignee);
      mockUserAllowRoleService.getUsersByRole.mockResolvedValue(mockRole9Users);
      
      // --- Key Mock ---
      // พบว่ามีการ assign งานนี้ให้คนนี้แล้ว
      mockTicketAssignedRepository.findOne.mockResolvedValue({ id: 1, ticket_id: 1, user_id: 2 }); 

      await expect(service.assignTicketByTicketNo('T-001', 2, 1)).rejects.toThrow(BadRequestException);
      await expect(service.assignTicketByTicketNo('T-001', 2, 1)).rejects.toThrow('Ticket นี้ถูกมอบหมายให้ผู้ใช้นี้แล้ว');
    });
    // --- END ADDED TEST ---

    it('should assign ticket and return success message (Happy Path)', async () => {
      mockPermissionService.getUserPermissionInfo.mockResolvedValue(mockPermissionInfo);
      mockPermissionService.canAssignTicket.mockResolvedValue(true);
      mockTicketRepository.findOne.mockResolvedValue(mockTicket);
      mockUsersRepository.findOne.mockResolvedValue(mockAssignee);
      mockUserAllowRoleService.getUsersByRole.mockResolvedValue(mockRole9Users);
      mockTicketAssignedRepository.findOne.mockResolvedValue(null); // ยังไม่เคย assign
      mockTicketAssignedRepository.create.mockReturnValue({}); // จำลองการสร้าง object
      mockTicketAssignedRepository.save.mockResolvedValue({}); // จำลองการ save
      mockNotificationService.createAssignmentNotification.mockResolvedValue({}); // notification สำเร็จ

      const result = await service.assignTicketByTicketNo('T-001', 2, 1);

      expect(mockTicketAssignedRepository.save).toHaveBeenCalled();
      expect(mockNotificationService.createAssignmentNotification).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'มอบหมายงานสำเร็จ',
        ticket_no: 'T-001',
        assigned_to: 2,
        assignee_name: 'Assigned User',
        available_users: ['Assigned User'],
      });
    });

    // --- ADDED TEST ---
    it('should assign ticket successfully even if notification fails', async () => {
      // Setup console.error spy
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      mockPermissionService.getUserPermissionInfo.mockResolvedValue(mockPermissionInfo);
      mockPermissionService.canAssignTicket.mockResolvedValue(true);
      mockTicketRepository.findOne.mockResolvedValue(mockTicket);
      mockUsersRepository.findOne.mockResolvedValue(mockAssignee);
      mockUserAllowRoleService.getUsersByRole.mockResolvedValue(mockRole9Users);
      mockTicketAssignedRepository.findOne.mockResolvedValue(null);
      mockTicketAssignedRepository.create.mockReturnValue({});
      mockTicketAssignedRepository.save.mockResolvedValue({});
      
      // --- Key Mock ---
      // Notification ล้มเหลว
      const notificationError = new Error('SMTP Connection Error');
      mockNotificationService.createAssignmentNotification.mockRejectedValue(notificationError);

      const result = await service.assignTicketByTicketNo('T-001', 2, 1);

      // 1. การ assign หลัก (save) ต้องสำเร็จ
      expect(mockTicketAssignedRepository.save).toHaveBeenCalled();
      // 2. ต้อง return ค่าสำเร็จกลับไป
      expect(result.message).toEqual('มอบหมายงานสำเร็จ');
      // 3. ต้องมีการพยายามส่ง noti
      expect(mockNotificationService.createAssignmentNotification).toHaveBeenCalled();
      // 4. ต้องมีการ log error ของ noti ไว้
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '❌ Failed to send assignment notification:',
        notificationError
      );

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
    // --- END ADDED TEST ---
  });

  // --- ADDED TEST ---
  describe('getRole9Users', () => {
    it('should return formatted list of users with role 9', async () => {
      // 1. Setup Mock Data
      const mockUsersFromRoleService = [
        { id: 1, firstname: 'John', lastname: 'Doe', username: 'johndoe', email: 'j@d.com' },
        { id: 2, firstname: 'Jane', lastname: 'Smith', username: 'janesmith', email: 'j@s.com' },
        { id: 3, firstname: 'Admin', lastname: null, username: 'admin', email: 'a@d.com' } // Test case ที่นามสกุลเป็น null
      ];

      const expectedFormattedUsers = [
        { id: 1, name: 'John Doe', username: 'johndoe', email: 'j@d.com' },
        { id: 2, name: 'Jane Smith', username: 'janesmith', email: 'j@s.com' },
        { id: 3, name: 'Admin', username: 'admin', email: 'a@d.com' } // เช็คว่า trim() ทำงานถูกต้อง
      ];

      mockUserAllowRoleService.getUsersByRole.mockResolvedValue(mockUsersFromRoleService);

      // 2. Action
      const result = await service.getRole9Users();

      // 3. Assertions
      // เช็คว่า service ถูกเรียกด้วย role_id = 9
      expect(mockUserAllowRoleService.getUsersByRole).toHaveBeenCalledWith(9);
      // เช็คจำนวน
      expect(result.total).toBe(3);
      // เช็ค message
      expect(result.message).toEqual('รายชื่อผู้ใช้ที่สามารถรับมอบหมายได้ (role_id = 9)');
      // เช็คว่า format ข้อมูลถูกต้อง
      expect(result.users).toEqual(expectedFormattedUsers);
    });

    it('should return an empty list if no users have role 9', async () => {
      mockUserAllowRoleService.getUsersByRole.mockResolvedValue([]); // คืนค่า array ว่าง

      const result = await service.getRole9Users();

      expect(mockUserAllowRoleService.getUsersByRole).toHaveBeenCalledWith(9);
      expect(result.total).toBe(0);
      expect(result.users).toEqual([]);
    });
  });
  // --- END ADDED TEST ---
});