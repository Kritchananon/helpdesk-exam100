import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFiles,
  UseInterceptors,
  Body,
  BadRequestException,
  NotFoundException,
  Request,
  UseGuards,
  Res,
  Delete,
  Patch
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Response } from 'express';
import { TicketService } from '../ticket/ticket.service';
import { AttachmentService } from './ticket_attachment.service';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { RequireAnyAction } from '../permission/permission.decorator';
import { PermissionService } from '../permission/permission.service';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

// เก็บ counter สำหรับแต่ละ ticket
const fileCounters = new Map<string, number>();

// ✅ แก้ไขฟังก์ชัน getNextFilename ให้นับเลขต่อเนื่องถูกต้อง
export async function getNextFilename(uploadPath: string, ticket_id: string, originalname: string): Promise<string> {
  let existingFiles: string[] = [];
  try {
    existingFiles = await fs.promises.readdir(uploadPath);
  } catch (err) {
    // ถ้าโฟลเดอร์ไม่มี ให้สร้างโฟลเดอร์ใหม่
    await fs.promises.mkdir(uploadPath, { recursive: true });
    existingFiles = [];
  }

  // ✅ Filter เฉพาะไฟล์ที่เริ่มต้นด้วย ticket_id
  const ticketFiles = existingFiles.filter(f => f.startsWith(`${ticket_id}_`));

  // ✅ Extract หมายเลขจากชื่อไฟล์และหาหมายเลขสูงสุด
  let maxNumber = 0;

  ticketFiles.forEach(filename => {
    // Pattern: ticket_id_number.extension
    const match = filename.match(new RegExp(`^${ticket_id}_(\\d+)\\.`));
    if (match) {
      const number = parseInt(match[1], 10);
      if (number > maxNumber) {
        maxNumber = number;
      }
    }
  });

  // ✅ หมายเลขถัดไป = หมายเลขสูงสุด + 1
  const nextNumber = maxNumber + 1;
  const ext = extname(originalname);

  const newFilename = `${ticket_id}_${nextNumber}${ext}`;
  console.log(`📝 Generated filename: ${newFilename} (existing files: ${ticketFiles.length}, max number: ${maxNumber})`);

  return newFilename;
}

export async function getNextFilenameWithCounter(uploadPath: string, ticket_id: string, originalname: string): Promise<string> {
  // ✅ ถ้ายังไม่มี counter สำหรับ ticket นี้ ให้นับจากไฟล์ที่มีอยู่
  if (!fileCounters.has(ticket_id)) {
    let existingFiles: string[] = [];
    try {
      existingFiles = await fs.promises.readdir(uploadPath);
    } catch (err) {
      await fs.promises.mkdir(uploadPath, { recursive: true });
      existingFiles = [];
    }

    // นับไฟล์ที่มีอยู่แล้วสำหรับ ticket นี้
    const ticketFiles = existingFiles.filter(f => f.startsWith(`${ticket_id}_`));

    let maxNumber = 0;
    ticketFiles.forEach(filename => {
      const match = filename.match(new RegExp(`^${ticket_id}_(\\d+)\\.`));
      if (match) {
        const number = parseInt(match[1], 10);
        if (number > maxNumber) {
          maxNumber = number;
        }
      }
    });

    fileCounters.set(ticket_id, maxNumber);
  }

  // ✅ เพิ่ม counter และใช้งาน
  const currentCounter = fileCounters.get(ticket_id)! + 1;
  fileCounters.set(ticket_id, currentCounter);

  const ext = extname(originalname);
  const newFilename = `${ticket_id}_${currentCounter}${ext}`;

  console.log(`📝 Generated filename with counter: ${newFilename} (counter: ${currentCounter})`);
  return newFilename;
}

@Controller('api')
export class TicketAttachmentController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly attachmentService: AttachmentService,
    private readonly permissionService: PermissionService,
  ) { }
  
  // ✅ แก้ไข endpoint เดิมให้รองรับไฟล์ทุกประเภท สำหรับดึงไฟล์แนปจาก issue_attachments
  @Get('images/issue_attachment/:id')
  async getIssueAttachmentImage(
    @Param('id') id: number,
    @Res() res: Response
  ) {
    try {
      console.log(`🔎 Getting issue attachment file with ID: ${id}`);

      const attachment = await this.attachmentService.findById(id);

      if (!attachment) {
        console.log(`❌ Attachment ID ${id} not found in database`);
        throw new NotFoundException('Attachment not found');
      }

      // ✅ ตรวจสอบว่าเป็นไฟล์ประเภท reporter จริงหรือไม่
      if (attachment.type !== 'reporter') {
        console.log(`❌ Attachment ID ${id} is not a reporter type (type: ${attachment.type})`);
        throw new BadRequestException('This attachment is not an issue attachment');
      }

      console.log(`📄 Found reporter attachment: ${JSON.stringify(attachment)}`);

      // ✅ ใช้ folder issue_attachment
      const filePath = path.join(process.cwd(), 'uploads', 'issue_attachment', attachment.filename);
      console.log(`🔍 Looking for file at: ${filePath}`);

      try {
        await stat(filePath);
        console.log(`✅ File found: ${filePath}`);
      } catch (error) {
        console.log(`❌ File not found: ${filePath}`);
        throw new NotFoundException('File not found on disk');
      }

      const fileBuffer = await readFile(filePath);
      console.log(`📖 File read successfully, size: ${fileBuffer.length} bytes`);

      const contentTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'tiff': 'image/tiff',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'json': 'application/json',
        'xml': 'application/xml',
        'rtf': 'application/rtf',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed'
      };

      const extension = attachment.extension.toLowerCase();
      const contentType = contentTypes[extension] || 'application/octet-stream';

      const inlineExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'pdf', 'txt', 'json', 'xml'];
      const disposition = inlineExtensions.includes(extension) ? 'inline' : 'attachment';

      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': `${disposition}; filename="${attachment.filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'X-Attachment-ID': id,
        'X-Ticket-ID': attachment.ticket_id,
        'X-File-Extension': extension,
        'X-Attachment-Type': attachment.type
      });

      res.send(fileBuffer);
      console.log(`✅ File sent successfully for ID: ${id}, type: ${contentType}, disposition: ${disposition}`);

    } catch (error) {
      console.error(`💥 Error getting file ${id}:`, error.message);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new NotFoundException('File not found');
    }
  }

  // ✅ แก้ไข endpoint เดิมให้รองรับไฟล์ทุกประเภท สำหรับดึงไฟล์แนปจาก fix_issue
  @Get('images/fix_issue/:id')
  async getFixIssueAttachmentImage(
    @Param('id') id: number,
    @Res() res: Response
  ) {
    try {
      console.log(`🔎 Getting fix issue attachment file with ID: ${id}`);

      const attachment = await this.attachmentService.findById(id);

      if (!attachment) {
        console.log(`❌ Attachment ID ${id} not found in database`);
        throw new NotFoundException('Attachment not found');
      }

      // ✅ ตรวจสอบว่าเป็นไฟล์ประเภท supporter จริงหรือไม่
      if (attachment.type !== 'supporter') {
        console.log(`❌ Attachment ID ${id} is not a supporter type (type: ${attachment.type})`);
        throw new BadRequestException('This attachment is not a fix issue attachment');
      }

      console.log(`📄 Found supporter attachment: ${JSON.stringify(attachment)}`);

      // ✅ ใช้ folder fix_issue
      const filePath = path.join(process.cwd(), 'uploads', 'fix_issue', attachment.filename);
      console.log(`🔍 Looking for file at: ${filePath}`);

      try {
        await stat(filePath);
        console.log(`✅ File found: ${filePath}`);
      } catch (error) {
        console.log(`❌ File not found: ${filePath}`);
        throw new NotFoundException('File not found on disk');
      }

      const fileBuffer = await readFile(filePath);
      console.log(`📖 File read successfully, size: ${fileBuffer.length} bytes`);

      const contentTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'tiff': 'image/tiff',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'json': 'application/json',
        'xml': 'application/xml',
        'rtf': 'application/rtf',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed'
      };

      const extension = attachment.extension.toLowerCase();
      const contentType = contentTypes[extension] || 'application/octet-stream';

      const inlineExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'pdf', 'txt', 'json', 'xml'];
      const disposition = inlineExtensions.includes(extension) ? 'inline' : 'attachment';

      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': `${disposition}; filename="${attachment.filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'X-Attachment-ID': id,
        'X-Ticket-ID': attachment.ticket_id,
        'X-File-Extension': extension,
        'X-Attachment-Type': attachment.type
      });

      res.send(fileBuffer);
      console.log(`✅ File sent successfully for ID: ${id}, type: ${contentType}, disposition: ${disposition}`);

    } catch (error) {
      console.error(`💥 Error getting file ${id}:`, error.message);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new NotFoundException('File not found');
    }
  }

  // ใช้สำหรับการแนปไฟล์ครั้งแรกของการสร้างทิกเก็ต
  @Post('updateAttachment')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_ticket')
  @UseInterceptors(FilesInterceptor('files', 5, {
    storage: diskStorage({
      destination: './uploads/issue_attachment',
      filename: async (req, file, cb) => {
        const ticket_id = req.body?.ticket_id || req.query?.ticket_id;
        if (!ticket_id) return cb(new BadRequestException('ticket_id is required'), '');

        try {
          const newFilename = await getNextFilenameWithCounter('./uploads/issue_attachment', ticket_id, file.originalname);
          cb(null, newFilename);
        } catch (error) {
          cb(error, '');
        }
      }
    }),
    fileFilter: (req, file, cb) => {
      console.log('File being uploaded:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });

      const allowedMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv', 'application/json',
        'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-zip-compressed',
        'application/rtf', 'application/xml', 'text/xml'
      ];

      const allowedExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.txt', '.csv', '.json', '.xml', '.rtf',
        '.zip', '.rar', '.7z'
      ];

      const fileExtension = extname(file.originalname).toLowerCase();

      if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        console.log('File type not allowed:', {
          mimetype: file.mimetype,
          extension: fileExtension,
          filename: file.originalname
        });

        return cb(
          new BadRequestException(
            `File type '${file.mimetype}' with extension '${fileExtension}' is not allowed. ` +
            `Allowed types: images, PDF, Word, Excel, PowerPoint, text files, and archives.`
          ),
          false
        );
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024,
    }
  }))
  async updateAttachment(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('ticket_id') ticket_id: string,
    @Body('project_id') project_id: string,
    @Body('categories_id') categories_id: string,
    @Body('issue_description') issue_description: string,
    @Request() req: any
  ) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files uploaded');
      }

      if (!ticket_id) {
        throw new BadRequestException('ticket_id is required');
      }

      // ✅ กำหนด type จาก role_id
      const attachmentType = 'reporter';
      console.log(`User role_id: ${req.user?.role_id}, Attachment type: ${attachmentType} (issue attachment)`);

      const uploadedFiles: any[] = [];
      const errors: any[] = [];

      for (const file of files) {
        try {
          const processedFile = await this.processImage(file);

          const attachment = await this.attachmentService.create({
            ticket_id: parseInt(ticket_id),
            type: attachmentType, // ✅ ใช้ type ที่กำหนดจาก role_id
            file: file,
            create_by: req.user.id
          });

          if (project_id || categories_id || issue_description) {
            console.log('Additional data to process:', {
              project_id,
              categories_id,
              issue_description,
              attachment_id: attachment.id
            });
          }

          uploadedFiles.push({
            id: attachment.id,
            filename: attachment.filename,
            original_name: file.originalname,
            file_size: processedFile.size,
            file_url: `/images/issue_attachment/${attachment.id}`,
            extension: attachment.extension
          });

          if (file.filename !== processedFile.filename) {
            await this.deleteFile(file.path);
          }

        } catch (error) {
          console.error('File processing error:', error);

          if (file.path) {
            await this.deleteFile(file.path);
          }

          errors.push({
            filename: file.originalname,
            error: error.message
          });
        }
      }

      const response = {
        success: uploadedFiles.length > 0,
        message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
        data: {
          uploaded_files: uploadedFiles,
          total_uploaded: uploadedFiles.length,
          total_files: files.length,
          errors: errors.length > 0 ? errors : undefined
        }
      };

      if (errors.length === 0) {
        return response;
      }

      if (uploadedFiles.length > 0) {
        return {
          ...response,
          message: `Uploaded ${uploadedFiles.length}/${files.length} files with some errors`
        };
      }

      throw new BadRequestException({
        message: 'Failed to upload any files',
        errors: errors
      });

    } catch (error) {
      console.error('Upload error:', error);

      if (files && files.length > 0) {
        for (const file of files) {
          if (file.path) {
            await this.deleteFile(file.path);
          }
        }
      }
      throw error;
    }
  }

  // ใช้ update หรือ edit ticket ของลูกค้า โดยสามารถทำได้โดยลูกค้าและแอดมิน คนที่มีสิทธิ์
  @Patch('updateAttachment')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_ticket', 'update_ticket')
  @UseInterceptors(FilesInterceptor('files', 5, {
    storage: diskStorage({
      destination: './uploads/issue_attachment',
      filename: async (req, file, cb) => {
        const ticket_id = req.body?.ticket_id || req.query?.ticket_id;
        if (!ticket_id) {
          console.error('ticket_id is missing in form-data');
          return cb(new BadRequestException('ticket_id is required'), '');
        }

        try {
          const newFilename = await getNextFilenameWithCounter('./uploads/issue_attachment', ticket_id, file.originalname);
          cb(null, newFilename);
        } catch (error) {
          cb(error, '');
        }
      }
    }),
    fileFilter: (req, file, cb) => {
      console.log('File being uploaded:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });

      const allowedMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv', 'application/json',
        'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-zip-compressed',
        'application/rtf', 'application/xml', 'text/xml'
      ];

      const allowedExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.txt', '.csv', '.json', '.xml', '.rtf',
        '.zip', '.rar', '.7z'
      ];

      const fileExtension = extname(file.originalname).toLowerCase();

      if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        console.log('File type not allowed:', {
          mimetype: file.mimetype,
          extension: fileExtension,
          filename: file.originalname
        });

        return cb(
          new BadRequestException(
            `File type '${file.mimetype}' with extension '${fileExtension}' is not allowed. ` +
            `Allowed types: images, PDF, Word, Excel, PowerPoint, text files, and archives.`
          ),
          false
        );
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024,
    }
  }))
  async updateUserAttachment(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('ticket_id') ticket_id: string,
    @Request() req: any,
  ) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files uploaded');
      }

      if (!ticket_id) {
        throw new BadRequestException('ticket_id is required');
      }

      // ✅ แก้ตรงนี้ - Fix เป็น reporter เสมอ
      const attachmentType = 'reporter';
      console.log(`User role_id: ${req.user?.role_id}, Attachment type: ${attachmentType} (Issue attachment)`);
      const uploadedFiles: any[] = [];
      const errors: any[] = [];

      for (const file of files) {
        try {
          const processedFile = await this.processImage(file);

          const attachment = await this.attachmentService.create({
            ticket_id: parseInt(ticket_id),
            type: attachmentType, // ✅ ใช้ type ที่กำหนดจาก role_id
            file,
            create_by: req.user.id,
          });

          uploadedFiles.push({
            id: attachment.id,
            filename: attachment.filename,
            original_name: file.originalname,
            file_size: processedFile.size,
            file_url: `/images/issue_attchment/${attachment.id}`,
            extension: attachment.extension,
          });

          if (file.filename !== processedFile.filename) {
            await this.deleteFile(file.path);
          }

        } catch (error) {
          console.error('File processing error:', error);

          if (file.path) {
            await this.deleteFile(file.path);
          }

          errors.push({
            filename: file.originalname,
            error: error.message,
          });
        }
      }

      const response = {
        success: uploadedFiles.length > 0,
        message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
        data: {
          uploaded_files: uploadedFiles,
          total_uploaded: uploadedFiles.length,
          total_files: files.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      };

      if (errors.length === 0) return response;

      if (uploadedFiles.length > 0) {
        return {
          ...response,
          message: `Uploaded ${uploadedFiles.length}/${files.length} files with some errors`,
        };
      }

      throw new BadRequestException({
        message: 'Failed to upload any files',
        errors: errors,
      });

    } catch (error) {
      console.error('Upload error:', error);

      if (files && files.length > 0) {
        for (const file of files) {
          if (file.path) {
            await this.deleteFile(file.path);
          }
        }
      }
      throw error;
    }
  }

  // ใช้สำหรับการแนปไฟลล์เพื่อตอบกลับลูกค้าในส่วนของ support information ของ supporter
  @Patch('fix_issue/attachment')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('solve_problem')
  @UseInterceptors(FilesInterceptor('files', 5, {
    storage: diskStorage({
      destination: './uploads/fix_issue',
      filename: async (req, file, cb) => {
        const ticket_id = req.body?.ticket_id || req.query?.ticket_id;
        if (!ticket_id) {
          console.error('ticket_id is missing in form-data');
          return cb(new BadRequestException('ticket_id is required'), '');
        }

        try {
          const newFilename = await getNextFilenameWithCounter('./uploads/fix_issue', ticket_id, file.originalname);
          cb(null, newFilename);
        } catch (error) {
          cb(error, '');
        }
      }
    }),
    fileFilter: (req, file, cb) => {
      console.log('File being uploaded:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });

      const allowedMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
        'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv', 'application/json',
        'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-zip-compressed',
        'application/rtf', 'application/xml', 'text/xml'
      ];

      const allowedExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.txt', '.csv', '.json', '.xml', '.rtf',
        '.zip', '.rar', '.7z'
      ];

      const fileExtension = extname(file.originalname).toLowerCase();

      if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        console.log('File type not allowed:', {
          mimetype: file.mimetype,
          extension: fileExtension,
          filename: file.originalname
        });

        return cb(
          new BadRequestException(
            `File type '${file.mimetype}' with extension '${fileExtension}' is not allowed. ` +
            `Allowed types: images, PDF, Word, Excel, PowerPoint, text files, and archives.`
          ),
          false
        );
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024,
    }
  }))
  async fix_issue_attachment(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('ticket_id') ticket_id: string,
    @Request() req: any,
  ) {
    try {
      if (!files || files.length === 0) {
        throw new BadRequestException('No files uploaded');
      }

      if (!ticket_id) {
        throw new BadRequestException('ticket_id is required');
      }

      // ✅ แก้ตรงนี้ - Fix เป็น supporter เสมอ
      const attachmentType = 'supporter';
      console.log(`User role_id: ${req.user?.role_id}, Attachment type: ${attachmentType} (fix issue attachment)`);
      const uploadedFiles: any[] = [];
      const errors: any[] = [];

      for (const file of files) {
        try {
          const processedFile = await this.processImage(file);

          const attachment = await this.attachmentService.create({
            ticket_id: parseInt(ticket_id),
            type: attachmentType, // ✅ ใช้ type ที่กำหนดจาก role_id
            file,
            create_by: req.user.id,
          });

          uploadedFiles.push({
            id: attachment.id,
            filename: attachment.filename,
            original_name: file.originalname,
            file_size: processedFile.size,
            file_url: `/images/fix_issue/${attachment.id}`,
            extension: attachment.extension,
          });

          if (file.filename !== processedFile.filename) {
            await this.deleteFile(file.path);
          }

        } catch (error) {
          console.error('File processing error:', error);

          if (file.path) {
            await this.deleteFile(file.path);
          }

          errors.push({
            filename: file.originalname,
            error: error.message,
          });
        }
      }

      const response = {
        success: uploadedFiles.length > 0,
        message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
        data: {
          uploaded_files: uploadedFiles,
          total_uploaded: uploadedFiles.length,
          total_files: files.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      };

      if (errors.length === 0) return response;

      if (uploadedFiles.length > 0) {
        return {
          ...response,
          message: `Uploaded ${uploadedFiles.length}/${files.length} files with some errors`,
        };
      }

      throw new BadRequestException({
        message: 'Failed to upload any files',
        errors: errors,
      });

    } catch (error) {
      console.error('Upload error:', error);

      if (files && files.length > 0) {
        for (const file of files) {
          if (file.path) {
            await this.deleteFile(file.path);
          }
        }
      }
      throw error;
    }
  }

  // Helper methods
  private async deleteFile(filePath: string): Promise<void> {
    try {
      const fs = require('fs').promises;
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to delete file:', filePath, error);
    }
  }

  private async processImage(file: Express.Multer.File): Promise<{
    filename: string;
    path: string;
    size: number;
  }> {
    return {
      filename: file.filename,
      path: file.path,
      size: file.size
    };
  }

  @Delete('issue_attachment/:id')
  @UseGuards(JwtAuthGuard)
  async deleteIssueAttachment(
    @Param('id') id: number,
    @Request() req: any
  ) {
    const userId = req.user?.id;
    console.log(`🔎 Deleting issue_attachment ID: ${id}, by user: ${userId}`);
    return this.attachmentService.deleteIssueAttachment(Number(id), userId);
  }

  @Delete('fix_issue/:id')
  @UseGuards(JwtAuthGuard)
  async deleteFixIssueAttachment(
    @Param('id') id: number,
    @Request() req: any
  ) {
    const userId = req.user?.id;
    console.log(`🔎 Deleting fix_issue ID: ${id}, by user: ${userId}`);
    return this.attachmentService.deleteFixIssueAttachment(Number(id), userId);
  }
}