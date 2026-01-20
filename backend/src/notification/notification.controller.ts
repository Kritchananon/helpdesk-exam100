import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  ForbiddenException,
  HttpStatus,
  HttpException,
  ParseIntPipe,

} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Notification, NotificationType } from './entities/notification.entity';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { TicketService } from '../ticket/ticket.service';

@Controller('api')
export class NotificationController {
  constructor(
    private readonly notiService: NotificationService,
    private readonly ticketService: TicketService
  ) { }

  private extractUserId(req: any): number | null {
    console.log('🔍 Request user object:', req.user);
    console.log('🔍 === extractUserId Debug ===');
    console.log('Full req.user object:', JSON.stringify(req.user, null, 2));

    // ลองหาจากทุก property ที่เป็นไปได้
    const possibleUserIds = [
      req.user?.id,
      req.user?.userId,
      req.user?.user_id,
      req.user?.sub,
      req.user?.ID,
      req.user?.Id,
      req.user?.USER_ID
    ];

    console.log('Possible userIds:', possibleUserIds);

    // หาค่าแรกที่ไม่ใช่ undefined/null
    const userId = possibleUserIds.find(id => id !== undefined && id !== null);

    console.log('Selected userId:', userId, 'Type:', typeof userId);

    // แปลงเป็น number
    const numericUserId = userId ? parseInt(userId.toString()) : null;

    console.log('Final numeric userId:', numericUserId);
    console.log('=== End extractUserId Debug ===');

    return numericUserId;
  }

  private async canAccessTicketByNo(userId: number, ticketNo: string, userPermissions: number[]): Promise<boolean> {
    try {
      if (!userId || !ticketNo) return false;
      // ✅ ตรวจสอบแบบ some: ถ้ามีอย่างน้อย 1 permission ใน [2,12,13] → ผ่าน
      const allowedRoles = [2, 12, 13];
      const hasPermission = allowedRoles.some(role => userPermissions.includes(role));
      if (hasPermission) return true;

      // ✅ ตรวจสอบเจ้าของตั๋ว
      const owner = await this.isTicketOwnerByNo(userId, ticketNo, userPermissions);
      return owner;
    } catch (error) {
      console.error('Error', error);
      throw error;
    }
  }

  private async isTicketOwnerByNo(userId: number, ticketNo: string, userPermissions: number[]): Promise<boolean> {
    if (!userId || !ticketNo) return false;
    try {
      const isOwner = await this.ticketService.checkTicketOwnershipByNo(userId, ticketNo, userPermissions);
      if (!isOwner) {
        throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงตั๋วนี้');
      }
      console.log(`👤 isTicketOwnerByNo: userId=${userId}, ticketNo=${ticketNo}, owner=${isOwner}`);
      return isOwner;
    } catch (error) {
      console.error('💥 isTicketOwnerByNo error:', error);
      return false;
    }
  }

  // Endpoint นี้ถูกเรียกเมื่อมี ticket ใหม่หรือมีการอัพเดต/move
  // ส่งการแจ้งเตือนสำหรับ ticket changes
  @Post('notify-changes')
  async notifyTicketChanges(@Body() payload: {
    ticket_no: string;
    statusId?: number;
    assignedUserId?: number;
    isNewTicket?: boolean;
  }) {
    try {
      const { ticket_no, statusId, assignedUserId, isNewTicket } = payload;

      if (!ticket_no) {
        throw new HttpException(
          { success: false, message: 'ticketNo is required' },
          HttpStatus.BAD_REQUEST
        );
      }

      // ใช้ notifyAllTicketChanges ที่มีการเช็คแล้ว (ในเวอร์ชันสะอาด)
      const notifications = await this.notiService.notifyAllTicketChanges(ticket_no, {
        statusId,
        assignedUserId,
        isNewTicket
      });

      return {
        success: true,
        message: 'Notifications created and emails sent successfully',
        data: notifications,
        summary: {
          total_notifications: notifications.length,
          new_ticket: isNewTicket ? notifications.filter(n => n.notification_type === NotificationType.NEW_TICKET).length : 0,
          status_change: statusId ? notifications.filter(n => n.notification_type === NotificationType.STATUS_CHANGE).length : 0,
          assignment: assignedUserId ? notifications.filter(n => n.notification_type === NotificationType.ASSIGNMENT).length : 0
        }
      };

    } catch (error) {
      console.error('Error in notifyTicketChanges:', error);
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการส่งการแจ้งเตือน',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ✅ Fixed: Get user notifications with proper error handling
  @UseGuards(JwtAuthGuard)
  @Get('getUserNotification')
  async getUserNotification(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('type') type?: NotificationType
  ) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      // ✅ Proper parameter validation
      const pageNumber = Math.max(1, parseInt(page) || 1);
      const limitNumber = Math.min(100, Math.max(1, parseInt(limit) || 20));

      let result;
      if (type && Object.values(NotificationType).includes(type)) {
        result = await this.notiService.getNotificationsByType(
          userId,
          type,
          pageNumber,
          limitNumber
        );
      } else {
        result = await this.notiService.getUserNotifications(
          userId,
          pageNumber,
          limitNumber
        );
      }

      return {
        success: true,
        data: result,
        message: 'ดึงข้อมูลการแจ้งเตือนสำเร็จ',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ✅ Get unread count
  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      const count = await this.notiService.getUnreadCount(userId);

      return {
        success: true,
        data: {
          unread_count: count,
          user_id: userId,
        },
        message: 'ดึงจำนวนการแจ้งเตือนสำเร็จ',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงจำนวนการแจ้งเตือน',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ✅ Get all notification types
  @UseGuards(JwtAuthGuard)
  @Get('getAllType')
  async getNotificationType() {
    try {
      const types = Object.values(NotificationType).map((type) => ({
        value: type,
        label: this.getTypeLabel(type), // ✅ Fixed typo: 'lable' -> 'label'
      }));

      return {
        success: true,
        data: types,
        message: 'ดึงประเภทการแจ้งเตือนสำเร็จ',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'เกิดข้อผิดพลาดในการดึงประเภทการแจ้งเตือน',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // ✅ Get notification by ID with proper authorization
  @UseGuards(JwtAuthGuard)
  @Get('getNotification/:id')
  async getNotificationById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any
  ) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบบัญชีผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      const notification = await this.notiService.findNotificationById(id);

      if (!notification) {
        throw new HttpException(
          {
            success: false,
            message: 'ไม่พบการแจ้งเตือนที่ต้องการ',
          },
          HttpStatus.NOT_FOUND
        );
      }

      // ✅ Check permission to access
      if (notification.user_id !== userId) {
        const isSupporter = await this.notiService.isUserSupporter(userId);
        if (!isSupporter) {
          throw new ForbiddenException('ไม่มีสิทธิ์ในการเข้าถึงการแจ้งเตือนนี้');
        }
      }

      return {
        success: true,
        data: notification,
        message: 'ดึงข้อมูลการแจ้งเตือนสำเร็จ',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลการแจ้งเตือน',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get('notification/:ticket_no')
  @UseGuards(JwtAuthGuard)
  async getTicketNotifications(
    @Param('ticket_no') ticketNo: string,
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'
  ) {
    const userId = this.extractUserId(req);
    if (!userId) throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');

    const userPermissions: number[] = await this.ticketService.checkUserPermissions(userId);
    console.log('User permission:', userPermissions)

    const canAccess = await this.canAccessTicketByNo(userId, ticketNo, userPermissions);
    if (!canAccess) throw new ForbiddenException('ไม่มีสิทธิ์ในการดูการแจ้งเตือนของตั๋วนี้');

    const pageNumber = Math.max(1, parseInt(page) || 1);
    const limitNumber = Math.min(100, Math.max(1, parseInt(limit) || 20));

    const result = await this.notiService.getTicketNotifications(ticketNo, pageNumber, limitNumber);

    return {
      success: true,
      data: result,
      message: 'ดึงข้อมูลการแจ้งเตือนของ ticket สำเร็จ',
    };
  }

  // ✅ Fixed: Mark single notification as read (was calling markAllAsRead)
  @UseGuards(JwtAuthGuard)
  @Patch('markAsRead/:id')
  async markAsRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      // ✅ Fixed: Call markAsRead instead of markAllAsRead
      const result = await this.notiService.markAsRead(id, userId);

      return {
        success: true,
        data: result,
        message: 'ทำเครื่องหมายอ่านแล้วสำเร็จ',
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการทำเครื่องหมายว่าอ่านแล้ว',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ✅ Mark all notifications as read
  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  async markAllRead(@Req() req: any) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      const result = await this.notiService.markAllAsRead(userId);

      return {
        success: true,
        data: {
          update_count: result.updated,
          user_id: userId,
        },
        message: `ทำเครื่องหมายว่าอ่านแล้ว ${result.updated} รายการ`,
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการทำเครื่องหมายอ่านแล้ว',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private getTypeLabel(type: NotificationType): string {
    const labels: Record<NotificationType, string> = {
      [NotificationType.NEW_TICKET]: 'ตั๋วใหม่',
      [NotificationType.STATUS_CHANGE]: 'การเปลี่ยนสถานะ',
      [NotificationType.ASSIGNMENT]: 'การมอบหมาย',
    };

    return labels[type] || 'ไม่ทราบประเภท';
  }

  /**
 * ✅ ดึงรายการ notification ของ user ทั้งหมด (ไม่มี pagination)
 * GET /api/notifications/list
 */
  @UseGuards(JwtAuthGuard)
  @Get('notifications/list')
  async getNotificationList(@Req() req: any) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }

      const result = await this.notiService.getListNoti(userId);
      return result;

    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: error.message || 'เกิดข้อผิดพลาดในการดึงรายการแจ้งเตือน',
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}