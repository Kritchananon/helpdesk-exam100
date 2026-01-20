import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateTicketAssignedDto } from './dto/create-ticket_assigned.dto';
import { UpdateTicketAssignedDto } from './dto/update-ticket_assigned.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Repository } from 'typeorm';
import { TicketAssigned } from './entities/ticket_assigned.entity';
import { Users } from '../users/entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import { PermissionService } from '../permission/permission.service';
import { UserAllowRoleService } from '../user_allow_role/user_allow_role.service';

@Injectable()
export class TicketAssignedService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,

    @InjectRepository(TicketAssigned)
    private readonly assignRepo: Repository<TicketAssigned>,

    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,

    private readonly notiService: NotificationService,
    private readonly permissionService: PermissionService,
    private readonly allowRoleService: UserAllowRoleService,
  ){}

  // Service Method - ปรับปรุงให้ดึง role_id = 9 ก่อน assign
  async assignTicketByTicketNo(
    ticketNo: string,
    assignedTo: number,
    assignedBy: number
  ) {
    // 1. ดึง permissions ของผู้มอบหมายจาก DB
    const userInfo = await this.permissionService.getUserPermissionInfo(assignedBy);
    const userPermissions: number[] = userInfo?.permissions.map(p => p.permissionId) ?? [];

    // 2. ตรวจสอบว่า user มี role_id = 19 (สิทธิ์ assign_ticket)
    const hasAssignRole = await this.permissionService.canAssignTicket(assignedBy, userPermissions);
    if (!hasAssignRole) {
      throw new ForbiddenException('ไม่มีสิทธิ์ในการมอบหมายงาน');
    }

    // 3. ตรวจสอบ ticket
    const ticket = await this.ticketRepo.findOne({ where: { ticket_no: ticketNo } });
    if (!ticket) {
      throw new NotFoundException(`ไม่พบ Ticket หมายเลข ${ticketNo}`);
    }

    // 4. ดึงรายชื่อผู้ที่มี role_id = 9
    const role9Users = await this.allowRoleService.getUsersByRole(9);
    const role9UserNames = role9Users.map(u => `${u.firstname || ''} ${u.lastname || ''}`.trim());

    // 5. ตรวจสอบผู้รับมอบหมาย
    const assignee = await this.userRepo.findOne({ where: { id: assignedTo } });
    if (!assignee) throw new NotFoundException('ไม่พบผู้รับมอบหมาย');

    const isValidAssignee = role9Users.some(user => user.id === assignedTo);
    if (!isValidAssignee) throw new BadRequestException('ผู้รับมอบหมายต้องมี role_id = 9 เท่านั้น');

    // 6. ตรวจสอบว่ามอบหมายแล้วหรือยัง
    const alreadyAssigned = await this.assignRepo.findOne({
      where: { ticket_id: ticket.id, user_id: assignedTo },
    });
    if (alreadyAssigned) throw new BadRequestException('Ticket นี้ถูกมอบหมายให้ผู้ใช้นี้แล้ว');

    // 7. ทำการมอบหมาย
    const assigned = this.assignRepo.create({
      ticket_id: ticket.id,
      user_id: assignedTo,
      create_date: new Date(),
      create_by: assignedBy,
    });
    await this.assignRepo.save(assigned);

    // 8. ส่ง Notification (ไม่ให้ error กระทบ main operation)
    try {
      await this.notiService.createAssignmentNotification(ticket.ticket_no.toString(), assignedTo);
    } catch (notificationError) {
      console.error('❌ Failed to send assignment notification:', notificationError);
      console.log('SMTP User:', process.env.SMTP_USER);
      console.log('SMTP Pass:', process.env.SMTP_PASS ? '***' : 'Missing');
    }

    // 9. ส่งข้อมูลกลับ
    return {
      message: 'มอบหมายงานสำเร็จ',
      ticket_no: ticketNo,
      assigned_to: assignedTo,
      assignee_name: `${assignee.firstname || ''} ${assignee.lastname || ''}`.trim(),
      available_users: role9UserNames,
    };
  }

  // Method ใหม่สำหรับดึงเฉพาะ users ที่มี role_id = 9
  async getRole9Users() {
    const role9Users = await this.allowRoleService.getUsersByRole(9);
    
    return {
      message: 'รายชื่อผู้ใช้ที่สามารถรับมอบหมายได้ (role_id = 9)',
      users: role9Users.map(user => ({
        id: user.id,
        name: `${user.firstname || ''} ${user.lastname || ''}`.trim(),
        username: user.username,
        email: user.email,
      })),
      total: role9Users.length
    };
  }
}