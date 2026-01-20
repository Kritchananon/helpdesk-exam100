import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { Ticket } from '../ticket/entities/ticket.entity';
import { PermissionService } from '../permission/permission.service';

@Injectable()
export class ExportExcelService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    private readonly permissionService: PermissionService,
  ) {}

  async exportTickets(res: Response, filter: any, userId: number) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Helpdesk Tickets');

    worksheet.columns = [
      { header: 'Ticket No', key: 'ticket_no', width: 15 },
      { header: 'Project', key: 'project_name', width: 25 },
      { header: 'Category', key: 'category_name', width: 25 },
      { header: 'Status', key: 'status_name', width: 15 },
      { header: 'Reporter', key: 'reporter', width: 30 },
      { header: 'Supporter', key: 'supporter', width: 30 },
      { header: 'Create Date', key: 'create_date', width: 20 },
      { header: 'Due Date', key: 'due_date', width: 20 },
      { header: 'Lead Time', key: 'lead_time', width: 10 },
      { header: 'Rating', key: 'rating', width: 10 },
    ];

    // 🧠 ดึง permission ของ user จาก PermissionService
    const userInfo = await this.permissionService.getUserPermissionInfo(userId);
    const userPermissions = userInfo ? userInfo.roles.map(r => r.roleId) : [];

    const canViewAll = await this.permissionService.canReadAllTickets(userId, userPermissions);
    const canViewOwn = await this.permissionService.canReadTicketDetial(userId, userPermissions);

    if (!canViewAll && !canViewOwn) {
      throw new ForbiddenException('You do not have permission to export tickets');
    }

    // 🧩 QueryBuilder
    let query = this.ticketRepo
      .createQueryBuilder('t')
      .leftJoin('project', 'p', 'p.id = t.project_id')
      .leftJoin('ticket_categories', 'tc', 'tc.id = t.categories_id')
      .leftJoin('ticket_categories_language', 'tcl', 'tcl.category_id = tc.id and tcl.language_id = :lang', { lang: 'th' })
      .leftJoin('ticket_status', 'ts', 'ts.id = t.status_id')
      .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id and tsl.language_id = :lang', { lang: 'th' })
      .leftJoin('users', 'u', 'u.id = t.create_by')
      .leftJoin('ticket_assigned', 'ta', 'ta.ticket_id = t.id')
      .leftJoin('users', 'su', 'su.id = ta.user_id')
      .leftJoin('ticket_satisfaction', 'sa', 'sa.ticket_id = t.id')
      .select([
        't.ticket_no as ticket_no',
        'p.name as project_name',
        'tcl.name as category_name',
        'tsl.name as status_name',
        "CONCAT(u.firstname, ' ', u.lastname) as reporter",
        "CONCAT(su.firstname, ' ', su.lastname) as supporter",
        "TO_CHAR(t.create_date, 'YYYY-MM-DD') as create_date",
        "TO_CHAR(t.due_date, 'YYYY-MM-DD') as due_date",
        't.lead_time as lead_time',
        'sa.rating as rating',
      ]);

    // 🎯 เงื่อนไขตามสิทธิ์
    if (canViewOwn && !canViewAll) {
      query = query.where('t.create_by = :userId', { userId });

      // ✅ filter เพิ่มได้ถ้าส่งมา
      if (filter) {
        if (filter.projectId) query = query.andWhere('t.project_id = :projectId', { projectId: filter.projectId });
        if (filter.statusId) query = query.andWhere('t.status_id = :statusId', { statusId: filter.statusId });
        if (filter.categoryId) query = query.andWhere('t.categories_id = :categoryId', { categoryId: filter.categoryId });
        if (filter.startDate && filter.endDate) {
          query = query.andWhere('t.create_date BETWEEN :start AND :end', {
            start: filter.startDate,
            end: filter.endDate,
          });
        }
        if (filter.keyword) {
          const keyword = `%${filter.keyword}%`;
          query = query.andWhere(
            '(t.ticket_no ILIKE :keyword OR t.issue_description ILIKE :keyword OR u.firstname ILIKE :keyword OR su.firstname ILIKE :keyword)',
            { keyword },
          );
        }
      }
    } else if (canViewAll) {
      // ✅ export ทั้งหมด ไม่ต้อง filter
      console.log('User can view all tickets → exporting full dataset.');
    }

    // 📦 ดึงข้อมูล
    const tickets = await query.getRawMany();

    // ✏️ เขียนข้อมูลลง Excel
    tickets.forEach((t) => {
      worksheet.addRow({
        ticket_no: t.ticket_no,
        project_name: t.project_name,
        category_name: t.category_name,
        status_name: t.status_name,
        reporter: t.reporter,
        supporter: t.supporter,
        create_date: t.create_date,
        due_date: t.due_date,
        lead_time: t.lead_time,
        rating: t.rating,
      });
    });

    // 🎨 header style
    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // 📤 ส่งไฟล์
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="tickets.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  }
}