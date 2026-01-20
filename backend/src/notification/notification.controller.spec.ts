import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { TicketService } from '../ticket/ticket.service'; // ⭐️ เพิ่ม
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { NotificationType } from './entities/notification.entity';

// Mock NotificationService
const mockNotificationService = {
  notifyAllTicketChanges: jest.fn(),
  getUserNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  getNotificationsByType: jest.fn(),
  findNotificationById: jest.fn(),
  isUserSupporter: jest.fn(),
  getTicketNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  getListNoti: jest.fn(),
};

// ⭐️ Mock TicketService (จำเป็นสำหรับ Controller)
const mockTicketService = {
  checkUserPermissions: jest.fn(),
  checkTicketOwnershipByNo: jest.fn(),
};

// Mock JwtAuthGuard
const mockJwtAuthGuard = {
  canActivate: jest.fn(() => true), // อนุญาตให้ผ่าน Guard ทั้งหมด
};

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: NotificationService;

  const mockRequest = (userPayload: any) => ({
    user: userPayload,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: TicketService,
          useValue: mockTicketService,
        },
      ],
    })
    .overrideGuard(JwtAuthGuard) // ⭐️ Override Guard
    .useValue(mockJwtAuthGuard)
    .compile();

    controller = module.get<NotificationController>(NotificationController);
    service = module.get<NotificationService>(NotificationService);
    
    // รีเซ็ต Mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('extractUserId (private method test)', () => {
    // ทดสอบ private method ผ่าน public method ที่เรียกใช้
    it('should extract userId from req.user.id', async () => {
      const req = mockRequest({ id: 123 });
      mockNotificationService.getUnreadCount.mockResolvedValue(5);
      
      await controller.getUnreadCount(req);
      
      // ตรวจสอบว่า getUnreadCount ถูกเรียกด้วย userId ที่ถูกต้อง
      expect(service.getUnreadCount).toHaveBeenCalledWith(123);
    });

    it('should extract userId from req.user.userId', async () => {
      const req = mockRequest({ userId: 456 });
      mockNotificationService.getUnreadCount.mockResolvedValue(5);
      
      await controller.getUnreadCount(req);
      
      expect(service.getUnreadCount).toHaveBeenCalledWith(456);
    });

    it('should extract userId from req.user.sub', async () => {
      const req = mockRequest({ sub: 789 });
      mockNotificationService.getUnreadCount.mockResolvedValue(5);
      
      await controller.getUnreadCount(req);
      
      expect(service.getUnreadCount).toHaveBeenCalledWith(789);
    });

    it('should return ForbiddenException if no userId found', async () => {
      const req = mockRequest({}); // ไม่มี user id
      await expect(controller.getUnreadCount(req)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUserNotification', () => {
    it('should get user notifications successfully', async () => {
      const req = mockRequest({ id: 1 });
      const result = { notifications: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      mockNotificationService.getUserNotifications.mockResolvedValue(result);

      const response = await controller.getUserNotification(req, '1', '20', undefined);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(result);
      expect(service.getUserNotifications).toHaveBeenCalledWith(1, 1, 20);
    });

    it('should get user notifications by type if type is provided', async () => {
      const req = mockRequest({ id: 1 });
      const result = { notifications: [], total: 0 };
      mockNotificationService.getNotificationsByType.mockResolvedValue(result);

      await controller.getUserNotification(req, '1', '20', NotificationType.NEW_TICKET);

      expect(service.getNotificationsByType).toHaveBeenCalledWith(1, NotificationType.NEW_TICKET, 1, 20);
      expect(service.getUserNotifications).not.toHaveBeenCalled();
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count successfully', async () => {
      const req = mockRequest({ id: 1 });
      mockNotificationService.getUnreadCount.mockResolvedValue(5);

      const response = await controller.getUnreadCount(req);

      expect(response.success).toBe(true);
      expect(response.data.unread_count).toBe(5);
      expect(response.data.user_id).toBe(1);
      expect(service.getUnreadCount).toHaveBeenCalledWith(1);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const req = mockRequest({ id: 1 });
      const notificationId = 10;
      const readNotification = { id: notificationId, is_read: true };
      mockNotificationService.markAsRead.mockResolvedValue(readNotification);

      const response = await controller.markAsRead(notificationId, req);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(readNotification);
      expect(service.markAsRead).toHaveBeenCalledWith(notificationId, 1);
    });
  });

  describe('markAllRead', () => {
    it('should mark all notifications as read', async () => {
      const req = mockRequest({ id: 1 });
      const updateResult = { updated: 3 };
      mockNotificationService.markAllAsRead.mockResolvedValue(updateResult);

      const response = await controller.markAllRead(req);

      expect(response.success).toBe(true);
      expect(response.data.update_count).toBe(3);
      expect(response.data.user_id).toBe(1);
      expect(service.markAllAsRead).toHaveBeenCalledWith(1);
    });
  });

  describe('notifyTicketChanges', () => {
    it('should call notifyAllTicketChanges service', async () => {
      const payload = { ticket_no: 'T123', isNewTicket: true };
      const notifications = [{ id: 1, ticket_no: 'T123' }];
      mockNotificationService.notifyAllTicketChanges.mockResolvedValue(notifications);

      const response = await controller.notifyTicketChanges(payload);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(notifications);
      expect(service.notifyAllTicketChanges).toHaveBeenCalledWith('T123', {
        statusId: undefined,
        assignedUserId: undefined,
        isNewTicket: true
      });
    });

    it('should throw HttpException if ticket_no is missing', async () => {
      const payload = { isNewTicket: true }; // ไม่มี ticket_no
      
      await expect(controller.notifyTicketChanges(payload as any)).rejects.toThrow(HttpException);
    });
  });
});