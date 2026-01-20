import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { Repository, In } from 'typeorm';
import { Users } from '../users/entities/user.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketStatus } from '../ticket_status/entities/ticket_status.entity';
import { TicketAssigned } from '../ticket_assigned/entities/ticket_assigned.entity';
import { MailerService } from '@nestjs-modules/mailer';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { TicketCategory } from '../ticket_categories/entities/ticket_category.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notiRepo: Repository<Notification>,
    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketStatus)
    private readonly statusRepo: Repository<TicketStatus>,
    @InjectRepository(TicketAssigned)
    private readonly ticketAssignedRepo: Repository<TicketAssigned>,
    @InjectRepository(UserAllowRole)
    private readonly userAllowRoleRepo: Repository<UserAllowRole>,
    @InjectRepository(TicketCategory)
    private readonly categoryRepo: Repository<TicketCategory>,

    private readonly mailerService: MailerService,
  ) { }

  /**
   * ตรวจสอบ ticket แล้วสร้าง Notification + ส่ง Email
   * ครอบคลุม 3 กรณี:
   * 1️⃣ New Ticket
   * 2️⃣ Status Change
   * 3️⃣ Assignment
   */
  /**
   * ตรวจสอบ ticket แล้วสร้าง Notification + ส่ง Email
   * ครอบคลุม 3 กรณี:
   * 1️⃣ New Ticket
   * 2️⃣ Status Change
   * 3️⃣ Assignment
   */
  async notifyAllTicketChanges(
    ticketNo: string,
    options: { statusId?: number; assignedUserId?: number; isNewTicket?: boolean }
  ): Promise<Notification[]> {
    const { statusId, assignedUserId, isNewTicket } = options;
    const notifications: Notification[] = [];

    try {
      console.log(`🔔 Starting notification process for ticket: ${ticketNo}`, options);

      // 1️⃣ Ticket ใหม่
      if (isNewTicket === true) {
        console.log('📨 Processing new ticket notification...');
        const newTicketNotis = await this.createNewTicketNotification(ticketNo);
        notifications.push(...newTicketNotis);
      }

      // 2️⃣ เปลี่ยนสถานะ (เฉพาะไม่ใช่ ticket ใหม่)
      if (
        isNewTicket !== true &&
        statusId !== undefined &&
        statusId !== null
      ) {
        console.log(`🔄 Processing status change notification for status: ${statusId}`);
        const statusChangeNoti =
          await this.createStatusChangeNotification(ticketNo, statusId);

        if (statusChangeNoti) {
          notifications.push(statusChangeNoti);
        }
      }

      // 3️⃣ มอบหมายงาน
      if (assignedUserId !== undefined && assignedUserId !== null) {
        console.log(`👤 Processing assignment notification for user: ${assignedUserId}`);
        const assignmentNoti =
          await this.createAssignmentNotification(ticketNo, assignedUserId);

        if (assignmentNoti) {
          notifications.push(assignmentNoti);
        }
      }

      console.log(`✅ Completed notification process. Created ${notifications.length} notifications`);
      return notifications;

    } catch (error) {
      console.error('❌ Error in notifyAllTicketChanges:', error);
      throw error;
    }
  }

  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notiRepo.create({
      ...dto,
      is_read: dto.is_read ?? false,
      email_sent: dto.email_sent ?? false,
      create_date: new Date()
    });
    const savedNotification = await this.notiRepo.save(notification);

    return savedNotification;
  }

  async createNotificationsBulk(payload: {
    ticket_no: string;
    targetUserIds: number[];
    notification_type: NotificationType;
    title: string;
    message?: string;
    create_by: number
  }): Promise<Notification[]> {
    const createdNotifications = await Promise.all(
      payload.targetUserIds.map(uid =>
        this.createNotification({
          ticket_no: payload.ticket_no,
          user_id: uid,
          notification_type: payload.notification_type,
          title: payload.title,
          message: payload.message,
        }),
      ),
    );
    return createdNotifications;
  }

  // ✅ สร้างการแจ้งเตือนสำหรับการเปลี่ยนแปลงสถานะ (สำหรับผู้แจ้ง)
  async createStatusChangeNotification(ticketNo: string, statusId: number): Promise<Notification | null> {
    try {
      console.log(`🔄 Creating status change notification for ticket: ${ticketNo}, status: ${statusId}`);

      // ดึงข้อมูล ticket
      const ticket = await this.ticketRepo.findOne({
        where: { ticket_no: ticketNo },
        relations: ['user']
      });

      if (!ticket) {
        console.error(`❌ Ticket not found: ${ticketNo}`);
        throw new NotFoundException(`Ticket with number ${ticketNo} not found`);
      }

      // ดึงข้อมูล status
      const status = await this.statusRepo.findOne({
        where: { id: statusId }
      });

      if (!status) {
        console.error(`❌ Status not found: ${statusId}`);
        throw new NotFoundException(`Status with ID ${statusId} not found`);
      }

      // ดึงข้อมูลผู้แจ้ง
      const reporter = await this.userRepo.findOne({
        where: { id: ticket.create_by }
      });

      if (!reporter) {
        console.error(`❌ Reporter not found for ticket: ${ticketNo}`);
        return null;
      }

      // ✅ ดึง status name พร้อม language support
      const languageId = 'th';
      const statusNameResult = await this.statusRepo
        .createQueryBuilder('ts')
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id AND tsl.language_id = :lang', { lang: languageId })
        .select('COALESCE(tsl.name)', 'name')
        .where('ts.id = :statusId', { statusId })
        .getRawOne();

      const statusName = statusNameResult?.name || 'ไม่ระบุ';

      // ✅ สร้าง notification
      const notification = this.notiRepo.create({
        ticket_no: ticketNo,
        user_id: ticket.create_by,
        status_id: statusId,
        notification_type: NotificationType.STATUS_CHANGE,
        title: `อัพเดทสถานะ: #${ticket.id}`,
        message: `เรื่องของคุณได้รับการอัพเดทสถานะเป็น: ${statusName}`,
        is_read: false,
        email_sent: false,
        create_date: new Date()
      });

      const savedNotification = await this.notiRepo.save(notification);
      console.log(`✅ Status change notification created with ID: ${savedNotification.id}`);

      // ส่ง email แบบ async (don't wait)
      this.sendEmailNotification(savedNotification).catch(error => {
        console.error('❌ Failed to send status change email:', error);
      });

      return savedNotification;

    } catch (error) {
      console.error('❌ Error creating status change notification:', error);
      throw error;
    }
  }

  // ✅ สร้างการแจ้งเตือนเรื่องใหม่ (สำหรับ supporter/admin)
  async createNewTicketNotification(ticketNo: string): Promise<Notification[]> {
    try {
      console.log(`📨 Creating new ticket notification for: ${ticketNo}`);

      // ดึงข้อมูล ticket
      const ticket = await this.ticketRepo.findOne({
        where: { ticket_no: ticketNo }
      });

      if (!ticket) {
        console.error(`❌ Ticket not found: ${ticketNo}`);
        throw new NotFoundException(`Ticket with number ${ticketNo} not found`);
      }

      // หาแอดมินที่มี role_id = 19 เท่านั้น
      const adminUsers = await this.userRepo
        .createQueryBuilder('user')
        .distinct(true)
        .select(['user.id', 'user.email', 'user.firstname', 'user.lastname'])
        .innerJoin('users_allow_role', 'uar', 'uar.user_id = user.id')
        .where('uar.role_id = :roleId', { roleId: 19 })
        .andWhere('user.email IS NOT NULL')
        .andWhere('user.email != :empty', { empty: '' })
        .getMany();

      if (adminUsers.length === 0) {
        console.warn('⚠️ No admins with role_id 19 found for new ticket notification');
        return [];
      }

      console.log('EMAIL_USER:', process.env.EMAIL_USER);
      console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Loaded' : '❌ Missing');
      console.log(`👥 Found ${adminUsers.length} admins (role_id: 19) to notify`);

      // ดึงชื่อ category ล่วงหน้า
      let categoryName = 'ไม่มีหัวข้อ';
      if (ticket.categories_id) {
        try {
          const categoryLangResult = await this.categoryRepo.query(`
          SELECT tcl.name
          FROM ticket_categories_language tcl
          WHERE tcl.category_id = $1 AND tcl.language_id = $2
        `, [ticket.categories_id, 'th']);

          if (categoryLangResult && categoryLangResult.length > 0) {
            categoryName = categoryLangResult[0].name;
          }
          console.log('🔍 Category for new ticket:', categoryName);
        } catch (error) {
          console.error('❌ Error querying category for new ticket:', error);
        }
      }

      const notifications: Notification[] = [];

      for (const admin of adminUsers) {
        try {
          const notification = this.notiRepo.create({
            ticket_no: ticketNo,
            user_id: admin.id,
            notification_type: NotificationType.NEW_TICKET,
            title: `เรื่องใหม่: #${ticketNo}`,
            message: `มีเรื่องใหม่ที่ต้องการการดำเนินการ - ${categoryName}`,
            is_read: false,
            email_sent: false,
            create_date: new Date()
          });

          const savedNotification = await this.notiRepo.save(notification);
          notifications.push(savedNotification);

          // ส่ง email แบบ async
          this.sendEmailNotification(savedNotification).catch(error => {
            console.error(`❌ Failed to send new ticket email to admin ${admin.id}:`, error);
          });

        } catch (error) {
          console.error(`❌ Error creating notification for admin ${admin.id}:`, error);
        }
      }

      console.log(`✅ Created ${notifications.length} new ticket notifications for admins`);
      return notifications;

    } catch (error) {
      console.error('❌ Error creating new ticket notifications:', error);
      throw error;
    }
  }

  // ✅ สร้างการแจ้งเตือนการมอบหมายงาน (สำหรับ assignee) - แก้ไขให้แสดงชื่อหัวข้อถูกต้อง
  async createAssignmentNotification(ticketNo: string, assignedUserId: number): Promise<Notification | null> {
    try {
      console.log(`👤 Creating assignment notification for ticket: ${ticketNo}, user: ${assignedUserId}`);

      // ดึงข้อมูล ticket
      const ticket = await this.ticketRepo.findOne({
        where: { ticket_no: ticketNo }
      });

      if (!ticket) {
        console.error(`❌ Ticket not found: ${ticketNo}`);
        throw new NotFoundException(`Ticket with number ${ticketNo} not found`);
      }

      // ดึงข้อมูลผู้ได้รับมอบหมาย
      const assignedUser = await this.userRepo.findOne({
        where: { id: assignedUserId }
      });

      if (!assignedUser) {
        console.error(`❌ Assigned user not found: ${assignedUserId}`);
        throw new NotFoundException(`User with ID ${assignedUserId} not found`);
      }

      if (!assignedUser.email) {
        console.warn(`⚠️ Assigned user ${assignedUserId} has no email address`);
        return null;
      }

      // ดึงชื่อ category ที่ถูกต้อง
      let categoryName = 'ไม่มีหัวข้อ';
      if (ticket.categories_id) {
        try {
          const categoryLangResult = await this.categoryRepo.query(`
          SELECT tcl.name
          FROM ticket_categories_language tcl
          WHERE tcl.category_id = $1 AND tcl.language_id = $2
        `, [ticket.categories_id, 'th']);

          if (categoryLangResult && categoryLangResult.length > 0) {
            categoryName = categoryLangResult[0].name;
          }
          console.log('🔍 Category for assignment:', categoryName);
        } catch (error) {
          console.error('❌ Error querying category for assignment:', error);
        }
      }

      const notification = this.notiRepo.create({
        ticket_no: ticketNo,
        user_id: assignedUserId,
        notification_type: NotificationType.ASSIGNMENT,
        title: `มอบหมายงาน: #${ticketNo}`,
        message: `คุณได้รับมอบหมายงานใหม่: ${categoryName}`,
        is_read: false,
        email_sent: false,
        create_date: new Date()
      });

      const savedNotification = await this.notiRepo.save(notification);
      console.log(`✅ Assignment notification created with ID: ${savedNotification.id}`);

      // ส่ง email แบบ async
      this.sendEmailNotification(savedNotification).catch(error => {
        console.error('❌ Failed to send assignment email:', error);
      });

      return savedNotification;

    } catch (error) {
      console.error('❌ Error creating assignment notification:', error);
      throw error;
    }
  }

  // ✅ ส่ง email notification
  private async sendEmailNotification(notification: Notification): Promise<void> {
    try {
      console.log(`📧 Sending email notification for ID: ${notification.id}, Type: ${notification.notification_type}`);

      let emailSent = false;

      switch (notification.notification_type) {
        case NotificationType.STATUS_CHANGE:
          emailSent = await this.sendStatusChangeEmail(notification);
          break;
        case NotificationType.NEW_TICKET:
          emailSent = await this.sendNewTicketEmail(notification);
          break;
        case NotificationType.ASSIGNMENT:
          emailSent = await this.sendAssignmentEmail(notification);
          break;
        default:
          console.warn(`⚠️ Unknown notification type: ${notification.notification_type}`);
          return;
      }

      if (emailSent) {
        // อัพเดทสถานะการส่ง email
        await this.notiRepo.update(notification.id, {
          email_sent: true,
          email_sent_at: new Date()
        });
        console.log(`✅ Email sent successfully for notification ID: ${notification.id}`);
      } else {
        console.warn(`⚠️ Email not sent for notification ID: ${notification.id}`);
      }

    } catch (error) {
      console.error(`❌ Failed to send email notification for ID ${notification.id}:`, error);
    }
  }

  // ✅ ส่งอีเมลการเปลี่ยนแปลงสถานะ (สำหรับผู้แจ้ง) - แก้ไขแล้ว
  private async sendStatusChangeEmail(notification: Notification): Promise<boolean> {
    try {
      // Load related entities if not already loaded
      const ticket = notification.ticket || await this.ticketRepo.findOne({
        where: { ticket_no: notification.ticket_no }
      });

      const user = notification.user || await this.userRepo.findOne({
        where: { id: notification.user_id }
      });

      const status = notification.status || (notification.status_id ? await this.statusRepo.findOne({
        where: { id: notification.status_id }
      }) : null);

      if (!user?.email || !ticket) {
        console.warn('⚠️ User email or ticket not found for notification:', notification.id);
        return false;
      }

      // ตรวจสอบ email format
      if (!this.isValidEmail(user.email)) {
        console.warn(`⚠️ Invalid email format: ${user.email}`);
        return false;
      }

      // ดึง status name จาก ticket_status_language - แก้ไข
      let statusName = 'ไม่ระบุสถานะ'; // ค่า default
      if (notification.status_id) {
        const statusLangResult = await this.statusRepo.query(`
        SELECT ts.id, tsl.name
        FROM ticket_status ts
        LEFT JOIN ticket_status_language tsl
          ON tsl.status_id = ts.id
          AND tsl.language_id = 'th'
        WHERE ts.id = $1 AND tsl.name IS NOT NULL
      `, [notification.status_id]);

        if (statusLangResult && statusLangResult.length > 0) {
          statusName = statusLangResult[0].name;
        }

        console.log('🔍 Status query result:', statusLangResult);
      }

      // ดึงชื่อ category จาก ticket_categories_language - แก้ไข
      let categoryName = 'ไม่มีหัวข้อ'; // ค่า default
      if (ticket.categories_id) {
        const categoryLangResult = await this.categoryRepo.query(`
        SELECT tc.id, tcl.name
        FROM ticket_categories tc
        LEFT JOIN ticket_categories_language tcl
          ON tcl.category_id = tc.id
          AND tcl.language_id = 'th'
        WHERE tc.id = $1 AND tcl.name IS NOT NULL
      `, [ticket.categories_id]);

        if (categoryLangResult && categoryLangResult.length > 0) {
          categoryName = categoryLangResult[0].name;
        }

        console.log('🔍 Category query result:', categoryLangResult);
      }

      const userName = user.firstname && user.lastname
        ? `${user.firstname} ${user.lastname}`
        : user.firstname || user.lastname || user.email.split('@')[0];

      // แก้ไข subject ให้ใช้ categoryName แทน ticket.categories_id
      const subject = `[Ticket #${ticket.ticket_no}] อัพเดทสถานะ: ${categoryName}`;

      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Ticket Status Update</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">🎫 อัพเดทสถานะ Ticket</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Support Ticket Management System</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #28a745;">
              <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>เรียน:</strong> คุณ${userName}</p>
              <p style="margin: 0; color: #666;">เรื่องของคุณได้รับการอัพเดทสถานะแล้ว</p>
            </div>

            <div style="background-color: #fff; border: 2px solid #e9ecef; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
              <h3 style="margin: 0 0 20px 0; color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">รายละเอียด Ticket</h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; width: 150px; color: #495057;">หมายเลขเรื่อง:</td>
                  <td style="padding: 12px 0; color: #007bff; font-weight: 600;">#${ticket.ticket_no}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">หัวข้อ:</td>
                  <td style="padding: 12px 0;">${categoryName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">สถานะใหม่:</td>
                  <td style="padding: 12px 0;">
                    <span style="color: #28a745; font-weight: 600; background-color: #d4edda; padding: 8px 12px; border-radius: 20px; display: inline-block;">
                      ✅ ${statusName}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">วันที่อัพเดท:</td>
                  <td style="padding: 12px 0;">${new Date().toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</td>
                </tr>
              </table>
            </div>

            <!-- Action Button -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}" 
                 style="display: inline-block; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; box-shadow: 0 4px 15px rgba(0,123,255,0.3); transition: all 0.3s ease;">
                🔍 ดูรายละเอียด Ticket
              </a>
            </div>

            <!-- Additional Info -->
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
              <p style="margin: 0; font-size: 14px; color: #1565c0;">
                💡 <strong>เคล็ดลับ:</strong> คุณสามารถติดตามสถานะเรื่องของคุณได้ตลอดเวลาผ่านระบบ
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 25px 20px; border-top: 1px solid #e9ecef;">
            <div style="text-align: center; color: #6c757d;">
              <p style="margin: 0 0 10px 0; font-weight: 600;">ขอบคุณที่ใช้บริการ</p>
              <p style="margin: 0 0 15px 0;">ทีมสนับสนุน - Support Team</p>
              
              <div style="font-size: 12px; color: #868e96; margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                <p style="margin: 0;">📧 อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
                <p style="margin: 5px 0 0 0;">หากมีคำถาม กรุณาติดต่อผ่านระบบ Support Ticket</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

      return await this.sendEmailWithHtml(user.email, subject, htmlContent);

    } catch (error) {
      console.error('❌ Error sending status change email:', error);
      return false;
    }
  }

  // ✅ ส่งอีเมลเรื่องใหม่ (สำหรับ admin) - แก้ไขให้แสดงชื่อหัวข้อถูกต้อง
  private async sendNewTicketEmail(notification: Notification): Promise<boolean> {
    try {
      const ticket = notification.ticket || await this.ticketRepo.findOne({
        where: { ticket_no: notification.ticket_no }
      });

      const user = notification.user || await this.userRepo.findOne({
        where: { id: notification.user_id }
      });

      if (!user?.email || !ticket) {
        console.warn('⚠️ User email or ticket not found for notification:', notification.id);
        return false;
      }

      if (!this.isValidEmail(user.email)) {
        console.warn(`⚠️ Invalid email format: ${user.email}`);
        return false;
      }

      // ดึงข้อมูลผู้แจ้งเรื่อง
      const reporter = await this.userRepo.findOne({
        where: { id: ticket.create_by }
      });

      const reporterName = reporter
        ? (reporter.firstname && reporter.lastname
          ? `${reporter.firstname} ${reporter.lastname}`
          : reporter.firstname || reporter.lastname || `User ID: ${reporter.id}`)
        : `User ID: ${ticket.create_by}`;

      const userName = user.firstname && user.lastname
        ? `${user.firstname} ${user.lastname}`
        : user.firstname || user.lastname || user.email.split('@')[0];

      // ดึงชื่อ category ที่ถูกต้อง
      let categoryName = 'ไม่มีหัวข้อ';
      if (ticket.categories_id) {
        try {
          const categoryLangResult = await this.categoryRepo.query(`
          SELECT tcl.name
          FROM ticket_categories_language tcl
          WHERE tcl.category_id = $1 AND tcl.language_id = $2
        `, [ticket.categories_id, 'th']);

          if (categoryLangResult && categoryLangResult.length > 0) {
            categoryName = categoryLangResult[0].name;
          }

          console.log('🔍 Category for email:', categoryName);
          console.log('🔍 Category ID:', ticket.categories_id);
        } catch (error) {
          console.error('❌ Error querying category for email:', error);
        }
      }

      const subject = `[New Ticket #${ticket.ticket_no}] เรื่องใหม่ต้องการการดำเนินการ: ${categoryName}`;

      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>New Ticket Assignment</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">🆕 Ticket ใหม่ต้องการการดำเนินการ</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Support Ticket Management System</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px 20px;">
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #ffc107;">
              <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>เรียน:</strong> คุณ${userName}</p>
              <p style="margin: 0; color: #856404;">มี ticket ใหม่ที่ต้องการการดำเนินการ กรุณาตรวจสอบ</p>
            </div>

            <div style="background-color: #fff; border: 2px solid #e9ecef; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
              <h3 style="margin: 0 0 20px 0; color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">รายละเอียด Ticket</h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; width: 150px; color: #495057;">หมายเลขเรื่อง:</td>
                  <td style="padding: 12px 0; color: #dc3545; font-weight: 600;">#${ticket.ticket_no}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">หัวข้อ:</td>
                  <td style="padding: 12px 0; font-weight: 600; color: #007bff;">${categoryName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">รายละเอียด:</td>
                  <td style="padding: 12px 0;">${ticket.issue_description || 'ไม่มีรายละเอียด'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">ผู้แจ้ง:</td>
                  <td style="padding: 12px 0;">${reporterName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">วันที่แจ้ง:</td>
                  <td style="padding: 12px 0;">${ticket.create_date?.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) || new Date().toLocaleDateString('th-TH')}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">ความเร่งด่วน:</td>
                  <td style="padding: 12px 0;">
                    <span style="color: #dc3545; font-weight: 600; background-color: #f8d7da; padding: 6px 12px; border-radius: 15px; display: inline-block;">
                      🔥 ต้องการการดำเนินการ
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Action Buttons -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}/assign" 
                 style="display: inline-block; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 25px; font-weight: 600; margin: 0 10px 10px 0; box-shadow: 0 4px 15px rgba(40,167,69,0.3);">
                🎯 มอบหมาย
              </a>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}" 
                 style="display: inline-block; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 25px; font-weight: 600; margin: 0 10px 10px 0; box-shadow: 0 4px 15px rgba(0,123,255,0.3);">
                👀 ดูรายละเอียด
              </a>
            </div>

            <!-- Priority Notice -->
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                ⚡ <strong>หมายเหตุ:</strong> กรุณาดำเนินการภายใน 24 ชั่วโมง เพื่อให้บริการที่ดีที่สุดแก่ลูกค้า
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 25px 20px; border-top: 1px solid #e9ecef;">
            <div style="text-align: center; color: #6c757d;">
              <p style="margin: 0 0 10px 0; font-weight: 600;">ทีมสนับสนุน - Support Team</p>
              
              <div style="font-size: 12px; color: #868e96; margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                <p style="margin: 0;">📧 อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
                <p style="margin: 5px 0 0 0;">กรุณาดำเนินการและอัพเดทสถานะผ่านระบบเท่านั้น</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

      return await this.sendEmailWithHtml(user.email, subject, htmlContent);

    } catch (error) {
      console.error('❌ Error sending new ticket email:', error);
      return false;
    }
  }

  // ✅ ส่งอีเมลการมอบหมายงาน - แก้ไขให้แสดงชื่อหัวข้อถูกต้อง
  private async sendAssignmentEmail(notification: Notification): Promise<boolean> {
    try {
      const ticket = notification.ticket || await this.ticketRepo.findOne({
        where: { ticket_no: notification.ticket_no }
      });

      const user = notification.user || await this.userRepo.findOne({
        where: { id: notification.user_id }
      });

      if (!user?.email || !ticket) {
        console.warn('⚠️ User email or ticket not found for notification:', notification.id);
        return false;
      }

      if (!this.isValidEmail(user.email)) {
        console.warn(`⚠️ Invalid email format: ${user.email}`);
        return false;
      }

      // ดึงข้อมูลผู้แจ้งเรื่อง
      const reporter = await this.userRepo.findOne({
        where: { id: ticket.create_by }
      });

      const reporterName = reporter
        ? (reporter.firstname && reporter.lastname
          ? `${reporter.firstname} ${reporter.lastname}`
          : reporter.firstname || reporter.lastname || `User ID: ${reporter.id}`)
        : `User ID: ${ticket.create_by}`;

      const userName = user.firstname && user.lastname
        ? `${user.firstname} ${user.lastname}`
        : user.firstname || user.lastname || user.email.split('@')[0];

      // ดึงชื่อ category ที่ถูกต้อง
      let categoryName = 'ไม่มีหัวข้อ';
      if (ticket.categories_id) {
        try {
          const categoryLangResult = await this.categoryRepo.query(`
          SELECT tcl.name
          FROM ticket_categories_language tcl
          WHERE tcl.category_id = $1 AND tcl.language_id = $2
        `, [ticket.categories_id, 'th']);

          if (categoryLangResult && categoryLangResult.length > 0) {
            categoryName = categoryLangResult[0].name;
          }

          console.log('🔍 Category for assignment email:', categoryName);
          console.log('🔍 Category ID:', ticket.categories_id);
        } catch (error) {
          console.error('❌ Error querying category for assignment email:', error);
        }
      }

      const subject = `[Assignment #${ticket.ticket_no}] คุณได้รับมอบหมายงานใหม่: ${categoryName}`;

      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Ticket Assignment</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #6f42c1 0%, #563d7c 100%); color: white; padding: 30px 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 600;">👤 คุณได้รับมอบหมายงานใหม่</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Support Ticket Management System</p>
          </div>

          <!-- Content -->
          <div style="padding: 30px 20px;">
            <div style="background-color: #e7e3ff; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #6f42c1;">
              <p style="margin: 0 0 10px 0; font-size: 16px;"><strong>เรียน:</strong> คุณ${userName}</p>
              <p style="margin: 0; color: #5a4fcf;">คุณได้รับมอบหมายให้ดูแลเรื่องนี้ กรุณาดำเนินการ</p>
            </div>

            <div style="background-color: #fff; border: 2px solid #e9ecef; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
              <h3 style="margin: 0 0 20px 0; color: #495057; border-bottom: 2px solid #e9ecef; padding-bottom: 10px;">รายละเอียดงานที่ได้รับมอบหมาย</h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; width: 150px; color: #495057;">หมายเลขเรื่อง:</td>
                  <td style="padding: 12px 0; color: #6f42c1; font-weight: 600;">#${ticket.ticket_no}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">หัวข้อ:</td>
                  <td style="padding: 12px 0; font-weight: 600; color: #007bff;">${categoryName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">รายละเอียด:</td>
                  <td style="padding: 12px 0;">${ticket.issue_description || 'ไม่มีรายละเอียด'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">ผู้แจ้ง:</td>
                  <td style="padding: 12px 0;">${reporterName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">วันที่มอบหมาย:</td>
                  <td style="padding: 12px 0;">${new Date().toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; font-weight: 600; color: #495057;">สถานะปัจจุบัน:</td>
                  <td style="padding: 12px 0;">
                    <span style="color: #6f42c1; font-weight: 600; background-color: #e7e3ff; padding: 8px 12px; border-radius: 20px; display: inline-block;">
                      📋 มอบหมายแล้ว
                    </span>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Action Buttons -->
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}/work" 
                 style="display: inline-block; background: linear-gradient(135deg, #6f42c1 0%, #563d7c 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 25px; font-weight: 600; margin: 0 10px 10px 0; box-shadow: 0 4px 15px rgba(111,66,193,0.3);">
                🚀 เริ่มทำงาน
              </a>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/tickets/${ticket.id}" 
                 style="display: inline-block; background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 15px 25px; text-decoration: none; border-radius: 25px; font-weight: 600; margin: 0 10px 10px 0; box-shadow: 0 4px 15px rgba(0,123,255,0.3);">
                📋 ดูรายละเอียด
              </a>
            </div>

            <!-- Work Guidelines -->
            <div style="background-color: #e3f2fd; padding: 20px; border-radius: 8px; border-left: 4px solid #2196f3; margin-bottom: 20px;">
              <h4 style="margin: 0 0 10px 0; color: #1565c0;">📝 แนวทางการดำเนินงาน</h4>
              <ul style="margin: 0; padding-left: 20px; color: #1565c0;">
                <li>ตรวจสอบรายละเอียดเรื่องอย่างละเอียด</li>
                <li>อัพเดทสถานะเป็น "กำลังดำเนินการ" เมื่อเริ่มทำงาน</li>
                <li>แจ้งความคืบหน้าให้ลูกค้าทราบเป็นระยะ</li>
                <li>ดำเนินการให้เสร็จภายในเวลาที่กำหนด</li>
              </ul>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f8f9fa; padding: 25px 20px; border-top: 1px solid #e9ecef;">
            <div style="text-align: center; color: #6c757d;">
              <p style="margin: 0 0 10px 0; font-weight: 600;">ทีมสนับสนุน - Support Team</p>
              
              <div style="font-size: 12px; color: #868e96; margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6;">
                <p style="margin: 0;">📧 อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ</p>
                <p style="margin: 5px 0 0 0;">กรุณาดำเนินการและอัพเดทสถานะผ่านระบบเท่านั้น</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

      return await this.sendEmailWithHtml(user.email, subject, htmlContent);

    } catch (error) {
      console.error('❌ Error sending assignment email:', error);
      return false;
    }
  }

  // ✅ Helper method สำหรับส่ง HTML email
  private async sendEmailWithHtml(to: string, subject: string, htmlContent: string): Promise<boolean> {
    try {
      console.log(`📧 Sending email to: ${to}, Subject: ${subject}`);

      // ตรวจสอบ email format
      if (!this.isValidEmail(to)) {
        console.warn(`⚠️ Invalid email format: ${to}`);
        return false;
      }

      // ส่งอีเมลด้วย MailerService
      await this.mailerService.sendMail({
        to: to,
        subject: subject,
        html: htmlContent,
        // เพิ่ม options สำหรับการส่งอีเมล
        from: process.env.MAIL_FROM || 'noreply@support.com',
      });

      console.log(`✅ HTML Email sent successfully to: ${to}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to send HTML email to ${to}:`, error);

      // Log รายละเอียด error
      if (error.response) {
        console.error('Email service response:', error.response);
      }
      if (error.code) {
        console.error('Email service error code:', error.code);
      }

      return false;
    }
  }

  // ✅ Helper method สำหรับตรวจสอบ email format
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private async getUserEmailsByRoles(roleIds: number[]): Promise<string[]> {
    const userAllowRoles = await this.userAllowRoleRepo.find({
      where: { role_id: In(roleIds) },
      relations: ['user'],
    });

    return userAllowRoles
      .map(uar => uar.user?.email)
      .filter((email): email is string => !!email && this.isValidEmail(email));
  }

  // ================================
  // เมธอดเพิ่มเติมสำหรับการจัดการ notification
  // ================================

  // ✅ ดึงการแจ้งเตือนของผู้ใช้
  async getUserNotifications(userId: number, page: number = 1, limit: number = 20) {
    try {
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const [notifications, total] = await this.notiRepo.findAndCount({
        where: { user_id: userId },
        relations: ['user', 'ticket', 'status'],
        order: { create_date: 'DESC' },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('❌ Error getting user notifications:', error);
      throw error;
    }
  }

  // แก้ไข markAsRead ให้อัพเดท WebSocket
  async markAsRead(notificationId: number, userId: number) {
    try {
      // ✅ 1. ดึง notification จาก id
      const notification = await this.notiRepo.findOne({
        where: { id: notificationId },
      });

      // ✅ 2. ตรวจสอบว่ามีอยู่จริงไหม
      if (!notification) {
        throw new NotFoundException('ไม่พบการแจ้งเตือนที่ระบุ');
      }

      // ✅ 3. ตรวจสอบว่าเป็นของ user คนนี้หรือไม่
      if (notification.user_id !== userId) {
        throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงการแจ้งเตือนนี้');
      }

      // ✅ 4. ถ้ายังไม่ได้อ่าน → อัปเดตสถานะเป็นอ่านแล้ว
      if (!notification.is_read) {
        await this.notiRepo.update(notificationId, {
          is_read: true,
          read_at: new Date(),
        });
      }

      // ✅ 6. คืนข้อมูลฉบับเต็มหลังอัปเดต
      return await this.notiRepo.findOne({
        where: { id: notificationId },
        relations: ['user', 'ticket', 'status'],
      });

    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  // ✅ ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว
  async markAllAsRead(userId: number) {
    try {
      const result = await this.notiRepo.update(
        { user_id: userId, is_read: false },
        { is_read: true, read_at: new Date() }
      );

      return { updated: result.affected || 0 };
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      throw error;
    }
  }

  // ✅ นับจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
  async getUnreadCount(user_id: number): Promise<number> {
    try {
      const items = await this.notiRepo.find({
        where: {
          user_id: user_id,
          is_read: false
        }
      });

      console.log('🔍 Notifications in DB:', items);
      return items.filter(n => n.user?.id === user_id).length;
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      return 0;
    }
  }



  // ✅ ดึงการแจ้งเตือนตามประเภท
  async getNotificationsByType(userId: number, type: NotificationType, page: number = 1, limit: number = 20) {
    try {
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const [notifications, total] = await this.notiRepo.findAndCount({
        where: { user_id: userId, notification_type: type },
        relations: ['user', 'ticket', 'status'],
        order: { create_date: 'DESC' },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('❌ Error getting notifications by type:', error);
      throw error;
    }
  }

  // ✅ หาการแจ้งเตือนจาก ID
  async findNotificationById(id: number) {
    return await this.notiRepo.findOne({
      where: { id },
      relations: ['user', 'ticket', 'status']
    });
  }

  // ✅ ตรวจสอบว่าผู้ใช้เป็น supporter หรือไม่
  async isUserSupporter(userId: number): Promise<boolean> {
    try {
      const supporterRoleIds = [2, 5, 6, 7, 8, 9, 10, 12, 13];

      const userRole = await this.userRepo
        .createQueryBuilder('user')
        .innerJoin('user_allow_role', 'uar', 'uar.user_id = user.id')
        .innerJoin('master_role', 'mr', 'mr.id = uar.role_id')
        .where('user.id = :userId', { userId })
        .andWhere('mr.id IN (:...supporterRoleIds)', { supporterRoleIds })
        .getOne();

      return !!userRole;
    } catch (error) {
      console.error('❌ Error checking if user is supporter:', error);
      return false;
    }
  }

  // ✅ ดึงการแจ้งเตือนของ ticket
  async getTicketNotifications(ticketNo: string, page: number = 1, limit: number = 20) {
    try {
      if (page < 1) page = 1;
      if (limit < 1 || limit > 100) limit = 20;

      const [notifications, total] = await this.notiRepo.findAndCount({
        where: { ticket_no: ticketNo },
        relations: ['user', 'ticket', 'status'],
        order: { create_date: 'DESC' },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('❌ Error getting ticket notifications:', error);
      throw error;
    }
  }

  /**
 * ดึงรายการ notification ของ user แบบง่ายๆ ไม่มี pagination
 * @param user_id - ID ของ user
 */
  async getListNoti(user_id: number) {
    try {
      const notifications = await this.notiRepo
        .createQueryBuilder('n')
        .leftJoinAndSelect('n.ticket', 't')
        .leftJoinAndSelect('n.status', 's')
        // ✅ Join กับ TicketStatusLanguage เพื่อดึง name
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = s.id AND tsl.language_id = :lang', { lang: 'th' })
        .addSelect('tsl.name', 'status_name')
        .where('n.user_id = :user_id', { user_id })
        .orderBy('n.create_date', 'DESC')
        .getRawAndEntities();

      // ใช้ getRawAndEntities() เพื่อให้ได้ทั้ง entities และ raw data
      const { entities, raw } = notifications;

      // Format data ให้เหมาะกับการแสดงผล
      const formattedNotifications = entities.map((notification, index) => ({
        id: notification.id,
        title: notification.title, // ✅ title อยู่ใน notification
        message: notification.message,
        ticket_no: notification.ticket_no,
        notification_type: notification.notification_type,
        is_read: notification.is_read,
        create_date: notification.create_date,
        read_at: notification.read_at,

        // เพิ่มข้อมูลสำหรับแสดง badge และสี
        type_label: this.getTypeLabel(notification.notification_type),
        type_color: this.getTypeColor(notification.notification_type),
        type_icon: this.getTypeIcon(notification.notification_type),

        // Format วันที่เป็น relative time
        time_ago: this.formatTimeAgo(notification.create_date),

        // ข้อมูล ticket (ถ้ามี)
        ticket: notification.ticket ? {
          id: notification.ticket.id,
          ticket_no: notification.ticket.ticket_no,
          // title: notification.title, // ถ้าต้องการใช้ title จาก notification
          status_id: notification.ticket.status_id,
        } : null,

        // ✅ ข้อมูล status (ใช้ name จาก raw data)
        status: notification.status ? {
          id: notification.status.id,
          name: raw[index]?.status_name || 'ไม่ระบุ', // ✅ ดึง name จาก join
        } : null,
      }));

      // นับจำนวน unread
      const unread_count = await this.notiRepo.count({
        where: {
          user_id: user_id,
          is_read: false,
        },
      });

      return {
        success: true,
        data: {
          notifications: formattedNotifications,
          summary: {
            total: formattedNotifications.length,
            unread_count,
          },
        },
      };

    } catch (error) {
      console.error('❌ Error getting notification list:', error);
      throw error;
    }
  }

  /**
   * Helper: แปลง notification_type เป็น label ภาษาไทย
   */
  private getTypeLabel(type: NotificationType): string {
    const labels = {
      [NotificationType.NEW_TICKET]: 'Ticket ใหม่',
      [NotificationType.STATUS_CHANGE]: 'อัพเดทสถานะ',
      [NotificationType.ASSIGNMENT]: 'มอบหมายงาน',
    };
    return labels[type] || 'แจ้งเตือน';
  }

  /**
   * Helper: กำหนดสีสำหรับแต่ละประเภท notification
   */
  private getTypeColor(type: NotificationType): string {
    const colors = {
      [NotificationType.NEW_TICKET]: '#FF9500', // สีส้ม
      [NotificationType.STATUS_CHANGE]: '#007AFF', // สีน้ำเงิน
      [NotificationType.ASSIGNMENT]: '#34C759', // สีเขียว
    };
    return colors[type] || '#8E8E93'; // สีเทา default
  }

  /**
   * Helper: กำหนด icon สำหรับแต่ละประเภท notification
   */
  private getTypeIcon(type: NotificationType): string {
    const icons = {
      [NotificationType.NEW_TICKET]: '📋',
      [NotificationType.STATUS_CHANGE]: '🔄',
      [NotificationType.ASSIGNMENT]: '👤',
    };
    return icons[type] || '🔔';
  }

  /**
   * Helper: แปลง date เป็น relative time
   */
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

    if (diffInSeconds < 60) {
      return 'เมื่อสักครู่';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} นาทีที่แล้ว`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} ชั่วโมงที่แล้ว`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays} วันที่แล้ว`;
    }

    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks} สัปดาห์ที่แล้ว`;
    }

    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) {
      return `${diffInMonths} เดือนที่แล้ว`;
    }

    const diffInYears = Math.floor(diffInDays / 365);
    return `${diffInYears} ปีที่แล้ว`;
  }

  /**
   * ดึง notification แบบแยกตามประเภท (สำหรับ tabs)
   */
  async getListNotiByTabs(user_id: number) {
    try {
      // ดึงทั้งหมด
      const allNotifications = await this.getListNoti(user_id);

      // แยกตามประเภท
      const newTickets = allNotifications.data.notifications.filter(
        n => n.notification_type === NotificationType.NEW_TICKET
      );

      const statusChanges = allNotifications.data.notifications.filter(
        n => n.notification_type === NotificationType.STATUS_CHANGE
      );

      const assignments = allNotifications.data.notifications.filter(
        n => n.notification_type === NotificationType.ASSIGNMENT
      );

      return {
        success: true,
        data: {
          tabs: {
            all: {
              label: 'ทั้งหมด',
              count: allNotifications.data.notifications.length,
              notifications: allNotifications.data.notifications,
            },
            new_tickets: {
              label: 'Ticket ใหม่',
              count: newTickets.length,
              notifications: newTickets,
            },
            status_change: {
              label: 'อัพเดทสถานะ',
              count: statusChanges.length,
              notifications: statusChanges,
            },
            assignments: {
              label: 'มอบหมายงาน',
              count: assignments.length,
              notifications: assignments,
            },
          },
          unread_count: allNotifications.data.summary.unread_count,
          total: allNotifications.data.summary.total,
        },
      };

    } catch (error) {
      console.error('❌ Error getting notification tabs:', error);
      throw error;
    }
  }
}