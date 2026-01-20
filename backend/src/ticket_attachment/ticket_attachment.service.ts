import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, IsNull } from 'typeorm';
import { TicketAttachment } from './entities/ticket_attachment.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { extname } from 'path';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AttachmentService {
  constructor(
    @InjectRepository(TicketAttachment)
    private readonly attachmentRepo: Repository<TicketAttachment>,
  ) { }

  /**
   * สร้างข้อมูลไฟล์แนบใหม่
   */
  async create(data: {
    ticket_id: number;
    type: string;
    file: Express.Multer.File;
    create_by: number;
  }): Promise<TicketAttachment> {
    // หา extension จาก originalname และจำกัดความยาว
    const extension = extname(data.file.originalname).substring(1); // ตัด . ออก
    const safeExtension = extension.length > 10 ? extension.substring(0, 10) : extension;

    // ใช้ filename ที่ส่งมาจาก controller (ที่ปรับแล้ว)
    const safeFilename = data.file.filename.length > 10 ?
      data.file.filename.substring(0, 10) :
      data.file.filename;

    // สร้าง entity ใหม่
    const attachment = new TicketAttachment();
    attachment.ticket_id = data.ticket_id;
    attachment.type = data.type;
    attachment.extension = safeExtension; // ใช้ extension ที่ปลอดภัย
    attachment.filename = safeFilename; // ใช้ filename ที่ปลอดภัย
    attachment.create_by = data.create_by;

    console.log('Saving attachment with:', {
      ticket_id: attachment.ticket_id,
      type: attachment.type,
      extension: attachment.extension,
      filename: attachment.filename,
      create_by: attachment.create_by
    });

    // บันทึกลงฐานข้อมูล
    return this.attachmentRepo.save(attachment);
  }

  /**
   * อัปเดตข้อมูลไฟล์แนบ
   */
  async update(id: number, data: Partial<TicketAttachment>): Promise<TicketAttachment | null> {
    await this.attachmentRepo.update(id, { ...data });
    return this.attachmentRepo.findOne({ where: { id } });
  }

  /**
   * ค้นหาไฟล์แนบตาม ticket_id
   */
  async findByTicketId(ticketId: number): Promise<TicketAttachment[]> {
    return this.attachmentRepo.find({
      where: { ticket_id: ticketId },
      order: { create_date: 'DESC' },
    });
  }

  // ✅ ค้นหา attachment ที่เป็นรูปภาพด้วย ID
  async findImageById(id: number) {
    return await this.attachmentRepo
      .createQueryBuilder('a')
      .select([
        'a.id',
        'a.filename',
        'a.extension',
        'a.ticket_id',
      ])
      .where('a.id = :id', { id })
      .andWhere('a.extension IN (:...extensions)', {
        extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff']
      })
      .getOne();
  }

  /**
   * ค้นหาไฟล์แนบตาม id
   */
  async findById(id: number): Promise<TicketAttachment | null> {
    return this.attachmentRepo.findOne({ where: { id } });
  }

  /**
   * เพิ่มไฟล์แนบให้กับ ticket
   * สามารถใช้กับ ticket entity โดยตรง
   */
  async createWithTicket(data: {
    ticket: Ticket;
    type?: string;
    filename?: string;
    extension?: string;
    create_by: number;
  }): Promise<TicketAttachment> {
    const attachment = new TicketAttachment();
    attachment.ticket_id = data.ticket.id;
    attachment.type = data.type || 'reporter';
    attachment.extension = (data.extension || '').substring(0, 10); // จำกัดความยาว
    attachment.filename = (data.filename || '').substring(0, 10); // จำกัดความยาว
    attachment.create_by = data.create_by;

    return this.attachmentRepo.save(attachment);
  }
  // ✅ Soft Delete ไฟล์แนบทั้งหมดของ ticket
  async softDeleteAllByTicketId(ticketId: number): Promise<void> {
    try {
      const attachments = await this.attachmentRepo.find({
        where: { ticket_id: ticketId, isenabled: true }
      });

      if (attachments.length === 0) {
        console.log(`No active attachments found for ticket ${ticketId}`);
        return;
      }

      // Soft delete ทั้งหมด
      for (const attachment of attachments) {
        attachment.isenabled = false;
        attachment.deleted_at = new Date();
      }

      await this.attachmentRepo.save(attachments);
      console.log(`Soft deleted ${attachments.length} attachments for ticket ${ticketId}`);
    } catch (error) {
      console.error('Error in softDeleteAllByTicketId:', error);
      throw error;
    }
  }

  // ✅ กู้คืนไฟล์แนบทั้งหมดของ ticket
  async restoreAllByTicketId(ticketId: number): Promise<void> {
    try {
      const attachments = await this.attachmentRepo.find({
        where: { ticket_id: ticketId, isenabled: false }
      });

      if (attachments.length === 0) {
        console.log(`No deleted attachments found for ticket ${ticketId}`);
        return;
      }

      // ตรวจสอบว่าไฟล์แนบยังกู้คืนได้หรือไม่ (ภายใน 7 วัน)
      const now = Date.now();
      const validAttachments = attachments.filter(attachment => {
        if (!attachment.deleted_at) return false;
        const daysSinceDeleted = Math.floor(
          (now - attachment.deleted_at.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceDeleted <= 7;
      });

      if (validAttachments.length === 0) {
        throw new BadRequestException('Cannot restore attachments. Restoration period expired (over 7 days).');
      }

      // กู้คืนไฟล์แนบที่ยังอยู่ในช่วงเวลา
      for (const attachment of validAttachments) {
        attachment.isenabled = true;
        attachment.deleted_at = undefined;
      }

      await this.attachmentRepo.save(validAttachments);
      console.log(`Restored ${validAttachments.length} attachments for ticket ${ticketId}`);
    } catch (error) {
      console.error('Error in restoreAllByTicketId:', error);
      throw error;
    }
  }

  // ✅ ลบไฟล์แนบอย่างถาวร (จากฐานข้อมูลและไฟล์จริง)
  async permanentDeleteAllByTicketId(ticketId: number): Promise<{
    deletedCount: number;
    deletedFiles: string[];
    errors: string[];
  }> {
    try {
      // หาไฟล์แนบที่ถูก soft delete แล้ว
      const attachments = await this.attachmentRepo.find({
        where: {
          ticket_id: ticketId,
          isenabled: false
        }
      });

      if (attachments.length === 0) {
        return {
          deletedCount: 0,
          deletedFiles: [],
          errors: []
        };
      }

      const deletedFiles: string[] = [];
      const errors: string[] = [];

      // ลบไฟล์จากระบบไฟล์
      for (const attachment of attachments) {
        try {
          const filePath = this.getAttachmentFilePath(attachment);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFiles.push(filePath);
            console.log(`Deleted file: ${filePath}`);
          } else {
            console.warn(`File not found: ${filePath}`);
          }
        } catch (fileError) {
          const errorMsg = `Failed to delete file for attachment ${attachment.id}: ${fileError.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // ลบ records จากฐานข้อมูล
      await this.attachmentRepo.remove(attachments);

      console.log(`Permanently deleted ${attachments.length} attachments for ticket ${ticketId}`);

      return {
        deletedCount: attachments.length,
        deletedFiles,
        errors
      };
    } catch (error) {
      console.error('Error in permanentDeleteAllByTicketId:', error);
      throw error;
    }
  }

  // ✅ หา path ของไฟล์แนบ
  private getAttachmentFilePath(attachment: TicketAttachment): string {
    // สมมติว่าไฟล์เก็บใน uploads/attachments/
    const uploadsDir = path.join(process.cwd(), 'uploads', 'attachments');

    // Format: ticketId_attachmentId.extension
    let filename: string;
    if (attachment.extension) {
      filename = `${attachment.ticket_id}_${attachment.id}.${attachment.extension}`;
    } else {
      filename = `${attachment.ticket_id}_${attachment.id}`;
    }

    return path.join(uploadsDir, filename);
  }

  // ✅ ลบไฟล์แนบที่หมดอายุ (เกิน 7 วัน) - สำหรับ Cron Job
  async cleanupExpiredAttachments(): Promise<{
    deletedCount: number;
    deletedFiles: string[];
    errors: string[];
  }> {
    try {
      const sevenDaysAgo = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

      // หาไฟล์แนบที่ soft delete ไปแล้วเกิน 7 วัน
      const expiredAttachments = await this.attachmentRepo.find({
        where: {
          isenabled: false,
          deleted_at: LessThan(sevenDaysAgo)
        }
      });

      if (expiredAttachments.length === 0) {
        return {
          deletedCount: 0,
          deletedFiles: [],
          errors: []
        };
      }

      const deletedFiles: string[] = [];
      const errors: string[] = [];

      // ลบไฟล์จากระบบไฟล์
      for (const attachment of expiredAttachments) {
        try {
          const filePath = this.getAttachmentFilePath(attachment);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deletedFiles.push(filePath);
          }
        } catch (fileError) {
          errors.push(`Failed to delete file for attachment ${attachment.id}: ${fileError.message}`);
        }
      }

      // ลบ records จากฐานข้อมูล
      await this.attachmentRepo.remove(expiredAttachments);

      console.log(`Cleaned up ${expiredAttachments.length} expired attachments`);

      return {
        deletedCount: expiredAttachments.length,
        deletedFiles,
        errors
      };
    } catch (error) {
      console.error('Error in cleanupExpiredAttachments:', error);
      throw error;
    }
  }

  // ✅ ตรวจสอบสถานะไฟล์แนับที่ถูกลบ
  async getDeletedAttachmentsByTicketId(ticketId: number): Promise<{
    attachments: any[];
    summary: {
      total: number;
      canRestore: number;
      expired: number;
    };
  }> {
    try {
      const deletedAttachments = await this.attachmentRepo.find({
        where: {
          ticket_id: ticketId,
          isenabled: false,
          deleted_at: Not(IsNull()) // ✅ แก้ไขให้ถูกต้อง
        },
        order: { deleted_at: 'DESC' }
      });

      const now = Date.now();

      // ✅ เพิ่มการตรวจสอบ null safety และกรองข้อมูล
      const processedAttachments = deletedAttachments
        .filter(attachment => attachment.deleted_at != null) // กรองเอา null/undefined ออก
        .map(attachment => {
          // ✅ ตอนนี้ TypeScript รู้แล้วว่า deleted_at ไม่เป็น null
          const deletedTime = attachment.deleted_at!.getTime(); // ใช้ ! เพื่อบอก TypeScript ว่าแน่ใจว่าไม่เป็น null
          const daysSinceDeleted = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
          const daysLeft = Math.max(0, 7 - daysSinceDeleted);
          const canRestore = daysLeft > 0;

          return {
            id: attachment.id,
            filename: attachment.filename,
            type: attachment.type,
            deleted_at: attachment.deleted_at,
            days_since_deleted: daysSinceDeleted,
            days_left_to_restore: daysLeft,
            can_restore: canRestore,
            expires_at: new Date(deletedTime + (7 * 24 * 60 * 60 * 1000)),
            status: canRestore ? 'Can Restore' : 'Expired'
          };
        });

      const summary = {
        total: processedAttachments.length,
        canRestore: processedAttachments.filter(a => a.can_restore).length,
        expired: processedAttachments.filter(a => !a.can_restore).length
      };

      return {
        attachments: processedAttachments,
        summary
      };
    } catch (error) {
      console.error('Error in getDeletedAttachmentsByTicketId:', error);
      throw error;
    }
  }

  async deleteIssueAttachment(id: number, userId: number) {
    const attachment = await this.attachmentRepo.findOne({
      where: { id },
      relations: ['ticket'],
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // ✅ ตรวจสอบว่าเป็นไฟล์ประเภท reporter จริงหรือไม่
      if (attachment.type !== 'reporter') {
        console.log(`❌ Attachment ID ${id} is not a reporter type (type: ${attachment.type})`);
        throw new BadRequestException('This attachment is not an issue attachment');
      }

    // ลบไฟล์จริง
    const fileIssuePath = path.join(__dirname, '..', '..', 'public', 'images', 'issue_attachment', attachment.filename);

    try {
      await fs.promises.unlink(fileIssuePath);
    } catch (error) {
      console.warn('File issue might already be deleted or not found:', fileIssuePath);
    }

    await this.attachmentRepo.remove(attachment);

    return {
      code: 0,
      message: 'Attachment deleted successfully',
      data: { id },
    };
  }

  async deleteFixIssueAttachment(id: number, userId: number) {
    const attachment = await this.attachmentRepo.findOne({
      where: { id },
      relations: ['ticket'],
    });

    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    // ✅ ตรวจสอบว่าเป็นไฟล์ประเภท reporter จริงหรือไม่
      if (attachment.type !== 'supporter') {
        console.log(`❌ Attachment ID ${id} is not a reporter type (type: ${attachment.type})`);
        throw new BadRequestException('This attachment is not an issue attachment');
      }

    // ลบไฟล์จริง
    const fileFixIssuePath = path.join(__dirname, '..', '..', 'public', 'images', 'fix_issue', attachment.filename);

    try {
      await fs.promises.unlink(fileFixIssuePath);
    } catch (error) {
      console.warn('File fix issue might already be deleted or not found:', fileFixIssuePath);
    }

    await this.attachmentRepo.remove(attachment);

    return {
      code: 0,
      message: 'Attachment deleted successfully',
      data: { id },
    };
  }
}