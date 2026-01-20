import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateTicketStatusHistoryDto } from './dto/create-ticket_status_history.dto';
import { UpdateTicketStatusHistoryDto } from './dto/update-ticket_status_history.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { TicketStatusHistory } from './entities/ticket_status_history.entity';
import { Ticket } from '../ticket/entities/ticket.entity'; // ✅ เพิ่ม import
import { Repository, DataSource } from 'typeorm';
import { Users } from '../users/entities/user.entity';

@Injectable()
export class TicketStatusHistoryService {
  constructor(
    @InjectRepository(TicketStatusHistory)
    private readonly historyRepo: Repository<TicketStatusHistory>,
    
    // ✅ เพิ่ม Ticket repository
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,

    @InjectRepository(Users)
    private readonly userRepo: Repository<Users>,
    
    // ✅ เพิ่ม DataSource สำหรับ query ที่ซับซ้อน
    private readonly dataSource: DataSource,
  ){}

  // ✅ บันทึก history entry ใหม่ (แก้ไขแล้ว)
  async createHistory(createData: {
    ticket_id: number;
    status_id: number;
    create_by: number;
  }): Promise<TicketStatusHistory> {
    try {
      console.log('📝 Creating ticket status history:', createData);

      // ✅ Validate required fields
      if (!createData.ticket_id || !createData.status_id || !createData.create_by) {
        throw new BadRequestException('ticket_id, status_id, and create_by are required');
      }

      // ✅ ตรวจสอบว่า ticket มีอยู่จริง (ใช้ ticketRepo)
      const ticket = await this.ticketRepo.findOne({
        where: { id: createData.ticket_id, isenabled: true }
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${createData.ticket_id} not found`);
      }

      // ✅ สร้าง entity โดยไม่ส่ง create_date (ให้ @CreateDateColumn จัดการ)
      const history = this.historyRepo.create({
        ticket_id: createData.ticket_id,
        status_id: createData.status_id,
        create_by: createData.create_by
        // create_date จะถูกสร้างอัตโนมัติจาก @CreateDateColumn
      });

      const savedHistory = await this.historyRepo.save(history);
      
      console.log('✅ History saved with ID:', savedHistory.id);
      return savedHistory;
    } catch (error) {
      console.error('💥 Error creating ticket status history:', error);
      throw error;
    }
  }

  // ✅ ดึง history ของ ticket โดยใช้ ticket_id โดยตรง (แก้ไขแล้ว)
  async getTicketHistory(ticketId: number): Promise<any[]> {
    try {
      console.log(`📋 Getting history for ticket ID: ${ticketId}`);

      // ✅ ตรวจสอบว่า ticket มีอยู่จริง (ใช้ ticketRepo ที่ถูกต้อง)
      const ticket = await this.ticketRepo.findOne({
        where: { id: ticketId, isenabled: true }
      });

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
      }

      console.log(`✅ Ticket found: ${ticket.ticket_no}`);

      // ✅ ใช้ TypeORM QueryBuilder แทน raw query
      const history = await this.historyRepo
        .createQueryBuilder('tsh')
        .leftJoinAndSelect('tsh.status', 'ts', 'ts.isenabled = :enabled', { enabled: true })
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id AND tsl.language_id = :lang', { lang: 'th' })
        .leftJoin('users', 'u', 'u.id = tsh.create_by')
        .select([
          'tsh.id',
          'tsh.ticket_id', 
          'tsh.status_id',
          'tsh.create_by',
          'tsh.create_date',
          'COALESCE(tsl.name, CONCAT(\'Status \', tsh.status_id)) AS status_name',
          'CONCAT(u.firstname, \' \', u.lastname) AS created_by_name'
        ])
        .where('tsh.ticket_id = :ticketId', { ticketId })
        .orderBy('tsh.create_date', 'DESC')
        .getRawMany();

      console.log(`✅ Found ${history.length} history records`);
      return history;

    } catch (error) {
      console.error('💥 Error getting ticket history:', error);
      throw error;
    }
  }

  // ✅ เพิ่ม method ใหม่สำหรับดึง current status ของ ticket
  async getCurrentTicketStatus(ticketId: number): Promise<{
    ticket_id: number;
    current_status_id: number;
    current_status_name: string;
    last_updated: Date;
  } | null> {
    try {
      const result = await this.historyRepo
        .createQueryBuilder('tsh')
        .select([
          'tsh.id',
          'tsh.ticket_id',
          'tsh.status_id',
          'tsh.create_by',
          'tsh.create_date',
          'tsh.comment',
          `COALESCE(tsl.name, CONCAT('Status ', tsh.status_id)) as status_name`,
          `CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, '')) as created_by_name`,
          'u.email as created_by_email',
        ])
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = tsh.status_id AND tsl.language_id = :lang', {
          lang: 'th',
        })
        .leftJoin('users', 'u', 'u.id = tsh.create_by')
        .where('tsh.ticket_id = :ticketId', { ticketId })
        .orderBy('tsh.create_date', 'ASC')
        .getRawMany();

      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error getting current ticket status:', error);
      return null;
    }
  }

  // ✅ เพิ่ม method สำหรับ debug การเปลี่ยนสถานะ
  async debugStatusChange(ticketId: number): Promise<{
    current_ticket_status: any;
    recent_history: any[];
    status_mismatch: boolean;
  }> {
    try {
      console.log(`🔍 Debug status change for ticket ${ticketId}`);

      // ดึงสถานะปัจจุบันของ ticket
      const currentStatus = await this.getCurrentTicketStatus(ticketId);
      
      // ดึง history ล่าสุด 5 รายการ
      const recentHistory = await this.historyRepo
        .createQueryBuilder('tsh')
        .select([
          'tsh.id',
          'tsh.status_id',
          'tsh.create_date',
          `COALESCE(tsl.name, CONCAT('Status ', tsh.status_id)) AS status_name`,
        ])
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = tsh.status_id AND tsl.language_id = :lang', {
          lang: 'th',
        })
        .where('tsh.ticket_id = :ticketId', { ticketId })
        .orderBy('tsh.create_date', 'DESC')
        .limit(5)
        .getRawMany();

      // ตรวจสอบว่าสถานะใน ticket table ตรงกับ history ล่าสุดหรือไม่
      const latestHistoryStatus = recentHistory.length > 0 ? recentHistory[0].status_id : null;
      const statusMismatch = currentStatus && latestHistoryStatus && 
                           currentStatus.current_status_id !== latestHistoryStatus;

      const debugInfo = {
        current_ticket_status: currentStatus,
        recent_history: recentHistory,
        status_mismatch: statusMismatch
      };

      console.log('🔍 Debug info:', debugInfo);
      return debugInfo;

    } catch (error) {
      console.error('Error in debug status change:', error);
      throw error;
    }
  }

  // ✅ เพิ่ม method สำหรับซิงค์สถานะ
  async syncTicketStatus(ticketId: number): Promise<{
    success: boolean;
    message: string;
    old_status: number;
    new_status: number;
  }> {
    try {
      console.log(`🔄 Syncing status for ticket ${ticketId}`);

      // ดึงสถานะล่าสุดจาก history
      const latestHistory = await this.dataSource.query(`
        SELECT status_id, create_date
        FROM ticket_status_history
        WHERE ticket_id = $1
        ORDER BY create_date DESC
        LIMIT 1
      `, [ticketId]);

      if (latestHistory.length === 0) {
        return {
          success: false,
          message: 'No history found for this ticket',
          old_status: 0,
          new_status: 0
        };
      }

      const latestStatusId = latestHistory[0].status_id;

      // ดึงสถานะปัจจุบันจาก ticket table
      const currentTicket = await this.ticketRepo.findOne({
        where: { id: ticketId }
      });

      if (!currentTicket) {
        return {
          success: false,
          message: 'Ticket not found',
          old_status: 0,
          new_status: 0
        };
      }

      const oldStatus = currentTicket.status_id;

      // อัปเดตสถานะใน ticket table ให้ตรงกับ history ล่าสุด
      if (oldStatus !== latestStatusId) {
        await this.ticketRepo.update(ticketId, {
          status_id: latestStatusId,
          update_date: new Date()
        });

        console.log(`✅ Synced ticket ${ticketId}: ${oldStatus} -> ${latestStatusId}`);

        return {
          success: true,
          message: 'Status synced successfully',
          old_status: oldStatus,
          new_status: latestStatusId
        };
      } else {
        return {
          success: true,
          message: 'Status already in sync',
          old_status: oldStatus,
          new_status: latestStatusId
        };
      }

    } catch (error) {
      console.error('Error syncing ticket status:', error);
      throw error;
    }
  }

  // Helper methods เหมือนเดิม...
  async getStatusName(statusId: number): Promise<string> {
    try {
      // ✅ ดึงชื่อสถานะจาก database แทนการ hardcode
      const result = await this.historyRepo
        .createQueryBuilder('ts')
        .select([
          `COALESCE(tsl.name, ts.name, CONCAT('Status ', :statusId)) AS name`,
        ])
        .leftJoin('ticket_status_language', 'tsl', 'tsl.status_id = ts.id AND tsl.language_id = :lang', {
          lang: 'th',
        })
        .where('ts.id = :statusId', { statusId })
        .andWhere('ts.isenabled = true')
        .limit(1)
        .setParameters({ statusId }) // เพิ่มเติมเพื่อความชัดเจนใน CONCAT
        .getRawOne();

      return result.length > 0 ? result[0].name : `Status ${statusId}`;
    } catch (error) {
      console.error('Error getting status name:', error);
      return `Status ${statusId}`;
    }
  }

  async getUserName(userId: number): Promise<string> {
    try {
      const result = await this.userRepo
        .createQueryBuilder('u')
        .select([
          `CONCAT(u.firstname, ' ', u.lastname) AS name`,
        ])
        .where('u.id = :userId', { userId })
        .limit(1)
        .getRawOne();

      return result.length > 0 ? result[0].name : `User ${userId}`;
    } catch (error) {
      console.error('Error getting user name:', error);
      return `User ${userId}`;
    }
  }

  async validateStatus(statusId: number, statusName: string): Promise<boolean> {
    try {
      const actualName = await this.getStatusName(statusId);
      return actualName.toLowerCase() === statusName.toLowerCase();
    } catch (error) {
      return false;
    }
  }

  findAll() {
    return `This action returns all ticketStatusHistory`;
  }

  findOne(id: number) {
    return `This action returns a #${id} ticketStatusHistory`;
  }

  update(id: number, updateTicketStatusHistoryDto: UpdateTicketStatusHistoryDto) {
    return `This action updates a #${id} ticketStatusHistory`;
  }

  remove(id: number) {
    return `This action removes a #${id} ticketStatusHistory`;
  }
}
