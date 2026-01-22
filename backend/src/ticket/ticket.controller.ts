import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  Request,
  Delete,
  Patch,
  HttpStatus,
  HttpException,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  Query
} from '@nestjs/common';
import { TicketService } from './ticket.service';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { TicketStatusService } from '../ticket_status/ticket_status.service';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateSatisfactionDto } from '../satisfaction/dto/create-satisfaction.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { RequireAnyAction } from '../permission/permission.decorator';
import { PermissionGuard } from '../permission/permission.guard';
import { CategoryStatsDTO } from './dto/dashboard.dto';

@Controller('api')
export class TicketController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly ticketStatusService: TicketStatusService,
  ) { }

  // ✅ เพิ่ม Language Detection Methods
  private getLanguage(req: any, defaultLang: string = 'th'): string {
    try {
      console.log('🌐 Detecting language...');

      // 1. จาก query parameter (?lang=th) - ความสำคัญสูงสุด
      if (req.query && req.query.lang) {
        const queryLang = String(req.query.lang).toLowerCase();
        console.log(`✅ Language from query: ${queryLang}`);
        return this.validateLanguage(queryLang, defaultLang);
      }

      // 2. จาก custom header (X-Language: th)
      if (req.headers) {
        const customLang = req.headers['x-language'] || req.headers['x-lang'];
        if (customLang) {
          const headerLang = String(customLang).toLowerCase();
          console.log(`✅ Language from header: ${headerLang}`);
          return this.validateLanguage(headerLang, defaultLang);
        }
      }

      // 3. จาก Accept-Language header
      if (req.headers && req.headers['accept-language']) {
        const acceptLang = req.headers['accept-language'];
        console.log(`🔍 Accept-Language: ${acceptLang}`);

        const parsedLang = this.parseAcceptLanguage(acceptLang);
        if (parsedLang) {
          console.log(`✅ Detected language from Accept-Language: ${parsedLang}`);
          return parsedLang;
        }
      }

      // 4. จาก user preferences (ถ้ามี user context)
      if (req.user && req.user.preferred_language) {
        const userLang = String(req.user.preferred_language).toLowerCase();
        console.log(`✅ Language from user preferences: ${userLang}`);
        return this.validateLanguage(userLang, defaultLang);
      }

      // 5. Default case
      console.log(`⚠️ Using default language: ${defaultLang}`);
      return defaultLang;

    } catch (error) {
      console.error(`❌ Error detecting language:`, error);
      return defaultLang;
    }
  }

  // ✅ ตรวจสอบว่าภาษาที่ได้รับเป็นภาษาที่รองรับหรือไม่
  private validateLanguage(lang: string, defaultLang: string): string {
    const normalizedLang = lang.toLowerCase().trim();

    // แปลงชื่อภาษาให้เป็นรหัสมาตรฐาน
    const langMapping = {
      'th': 'th',
      'thai': 'th',
      'thailand': 'th',
      'en': 'en',
      'eng': 'en',
      'english': 'en',
      'us': 'en',
      'gb': 'en'
    };

    return langMapping[normalizedLang] || defaultLang;
  }

  // ✅ แยกการ parse Accept-Language header
  private parseAcceptLanguage(acceptLanguage: string): string | null {
    try {
      // Accept-Language: th,en;q=0.9,en-US;q=0.8
      const languages = acceptLanguage
        .split(',')
        .map(lang => {
          const [code, qValue] = lang.split(';');
          return {
            code: code.trim().toLowerCase(),
            quality: qValue ? parseFloat(qValue.replace('q=', '')) : 1.0
          };
        })
        .sort((a, b) => b.quality - a.quality); // เรียงตาม quality

      for (const lang of languages) {
        const mainLang = lang.code.split('-')[0]; // th-TH -> th
        const validatedLang = this.validateLanguage(mainLang, 'th');

        if (validatedLang !== 'th' || mainLang === 'th') {
          return validatedLang;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error parsing Accept-Language:', error);
      return null;
    }
  }

  // ✅ ปรับปรุง checkPermission ให้ debug ชัดเจนขึ้น
  // ===================== Permission & Ownership Check =====================

  private async isTicketOwner(userId: number, ticketId: number, userPermissions: number[]): Promise<boolean> {
    if (!userId || !ticketId) return false;
    try {
      const isOwner = await this.ticketService.checkTicketOwnership(userId, ticketId, userPermissions);
      if (!isOwner) {
        throw new ForbiddenException('คุณไม่มีสิทธิ์เข้าถึงตั๋วนี้');
      }
      console.log(`👤 isTicketOwner: userId=${userId}, ticketId=${ticketId}, owner=${isOwner}`);
      return isOwner;
    } catch (error) {
      console.error('💥 isTicketOwner error:', error);
      return false;
    }
  }

  // ===================== General Access =====================

  private async canAccessTicket(userId: number, ticketId: number, userPermissions: number[]): Promise<boolean> {
    try {
      console.log(`🔍 Checking ticket access: ticket ${ticketId}, user ${userId}`);

      if (!userId || !ticketId) {
        console.log(`❌ Invalid parameters: userId=${userId}, ticketId=${ticketId}`);
        return false;
      }
      // ถ้ามีสิทธิ์ใดใน [2, 12, 13] ก็ผ่าน
      const hasTrack = [2, 12, 13].some(p => userPermissions.includes(p));
      if (hasTrack) return true;

      // ถ้าไม่มีสิทธิ์ข้างต้น ให้เช็คว่าเป็นเจ้าของตั๋วหรือไม่
      const owner = await this.isTicketOwner(userId, ticketId, userPermissions);
      return owner;
    } catch (error) {
      console.error('Error', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_ticket', 'solve_problem', 'create_user')
  @Get('dashboard')
  async getDashboardStats(
    @Query('userId') userId: number,
    @Req() req,
  ) {
    try {
      // ✅ ดึง user จาก JWT (JwtAuthGuard จะ inject req.user ให้อัตโนมัติ)
      const user = req.user || {};
      const userId = user.userId || user.id || user.user_id || user.sub;

      console.log('🔍 Fetching dashboard statistics for userId:', userId);
      console.log('🔍 Fetching dashboard statistics...');

      const data = await this.ticketService.getDashboardStatsByUserId(userId);

      return {
        code: '1',
        status: 1,
        message: 'Dashboard stats retrieved successfully',
        data,
      };
    } catch (error) {
      console.error('❌ Error fetching dashboard stats:', error);
      throw new HttpException(
        {
          code: '0',
          status: 0,
          message: 'Failed to retrieve dashboard statistics',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_ticket', 'solve_problem', 'create_user')
  @Get('summaryCategories')
  async getCategoryBreakdown(
    @Request() req: any,
    @Query('year') year?: string,
    @Query('userId') userId?: string,
  ): Promise<CategoryStatsDTO[]> {
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    // ✅ ดึง userId จาก token ถ้า frontend ไม่ส่งมา
    const targetUserId = userId ? parseInt(userId) : (
      req.user?.id || req.user?.userId || req.user?.user_id || req.user?.sub
    );

    console.log('📊 [Controller] getCategoryBreakdown called:', {
      currentYear,
      targetUserId,
    });

    // ✅ ส่งค่า year และ userId ให้ service
    return this.ticketService.getCategoryBreakdown(currentYear, targetUserId);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('create_ticket', 'update_ticket')
  @Post('saveTicket')
  async saveTicket(@Body() dto: any, @Request() req: any): Promise<any> {
    const userId = req.user?.id || req.user?.sub || req.user?.user_id || req.user?.userId;

    if (!userId) {
      return { code: 2, message: 'User not authenticated properly', data: null };
    }

    // ส่วน validate และ save ticket เหมือนเดิม
    const transformedDto = {
      ticket_id: dto.ticket_id ? parseInt(dto.ticket_id) : undefined,
      project_id: parseInt(dto.project_id),
      categories_id: parseInt(dto.categories_id),
      issue_description: dto.issue_description,
      status_id: dto.status_id ? parseInt(dto.status_id) : 1,
      issue_attachment: dto.issue_attachment || null,
    };

    try {
      const result = await this.ticketService.saveTicket(transformedDto, userId);
      return {
        code: 1,
        message: 'Success',
        ticket_id: result.ticket_id,
        ticket_no: result.ticket_no,
      };
    } catch (error) {
      return { code: 2, message: error.message || 'เกิดข้อผิดพลาด', data: null };
    }
  }

  // ✅ แก้ไข getTicketData ให้ใช้ ticket_no แทน ticket_id
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('read_ticket', 'read_all_tickets')
  @Post('getTicketData')
  async getTicketData(@Body() body: { ticket_no: string }, @Req() req: any) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        return { code: 2, message: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่', data: null };
      }

      const ticketNo = body.ticket_no?.toString().trim().toUpperCase();
      if (!ticketNo) {
        return { code: 2, message: 'กรุณาส่ง ticket_no', data: null };
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const data = await this.ticketService.getTicketData(ticketNo, baseUrl);

      return { code: 1, message: 'Success', data };
    } catch (error) {
      console.error('Error in getTicketData:', error);
      return { code: 2, message: error.message || 'เกิดข้อผิดพลาด', data: null };
    }
  }

  @Get('getAllTicket')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('read_ticket', 'read_all_tickets')
  async getAllTicket(
    @Request() req: any,
    @Query('page') page: string,
    @Query('perPage') perPage: string,
    @Query('status_id') status_id?: string,
    @Query('project_id') project_id?: string,
    @Query('categories_id') categories_id?: string,
    @Query('priority') priority?: string,
    @Query('keyword') keyword?: string,
    // @Query('date_start') date_start?: string,
    // @Query('date_end') date_end?: string,
  ) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        return { success: false, message: 'User ID not found in token', pagination: null, data: [] };
      }

      const pageNum = Number(page) || 1;
      const perPageNum = Number(perPage) || 25;

      const filters = {
        status_id: status_id ? Number(status_id) : undefined,
        project_id: project_id ? Number(project_id) : undefined,
        categories_id: categories_id ? Number(categories_id) : undefined,
        priority: priority ? Number(priority) : undefined,
        keyword: keyword?.trim() || undefined,
        // date_start,
        // date_end,
      };
      console.log(`👤 userId: ${userId} | page=${pageNum}, perPage=${perPageNum} | filters:`, filters);

      const result = await this.ticketService.getAllTicket(userId, pageNum, perPageNum, filters);

      return {
        success: result.success,
        message: result.message,
        pagination: result.pagination,
        data: result.data,
      };
    } catch (error) {
      console.error('💥 Error in getAllTicket:', error);
      return { success: false, message: error?.message || 'Unexpected error', pagination: null, data: [] };
    }
  }

  // ดึง priority ddl
  @Post('getPriorityDDL')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('assign_ticket')
  async getPriorityDDL() {
    try {
      console.log('📋 === getPriorityDDL Debug ===');
      const result = await this.ticketService.getPriorityDdl(); // ✅ เรียกใช้ service
      return result;
    } catch (error) {
      console.error('💥 Error in getPriorityDDL:', error);
      throw new HttpException('เกิดข้อผิดพลาดในระบบ', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('solve_problem', 'change_status')
  @Post('saveSupporter/:ticket_no')
  @UseInterceptors(FilesInterceptor('attachments'))
  async saveSupporter(
    @Param('ticket_no') ticketNo: string,
    @Body() body: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: any
  ) {
    const toNumber = (v: any): number | undefined => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  };
    try {
      const status_id = toNumber(body.status_id);
      const assignTo = toNumber(body.user_id);
      const priority = body.priority !== undefined ? toNumber(body.priority) : undefined;

      const userId =
        req.user?.id || req.user?.userId || req.user?.user_id || req.user?.sub;

      console.log('📥 Incoming saveSupporter request:', {
        ticketNo,
        status_id,
        assignTo,
        priority,
        userId,
        body,
        filesCount: files?.length || 0,
      });

      // ✅ ตรวจสอบค่าพื้นฐาน
      if (!status_id) {
        return { success: false, message: 'status_id is required' };
      }
      if (!userId) {
        return { success: false, message: 'User ID not found in token' };
      }

      // ✅ ตรวจสอบ priority (เฉพาะตอนส่งมา)
      if (priority !== undefined) {
        const allowed = [1, 2, 3];
        if (!allowed.includes(priority)) {
          throw new HttpException(
            { success: false, message: 'Invalid priority value. Must be 1, 2, or 3.' },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      // ✅ ส่งต่อไป service
      const result = await this.ticketService.saveSupporter(
        ticketNo,
        body,
        files,
        userId,
        status_id,
        assignTo,
      );

      return {
        success: true,
        message: 'Supporter data saved successfully',
        data: result,
      };
    } catch (error) {
      console.error('❌ Error in saveSupporter:', error);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to save supporter data',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('read_all_project', 'get_all_master_fillter')
  @Post('getAllMasterFilter')
  async getAllMasterFilter(@Req() req) {
    try {
      console.log('📋 === getAllMasterFilter Debug ===');

      const userId = this.extractUserId(req);
      console.log('👤 Extracted userId:', userId);

      if (!userId) {
        throw new ForbiddenException('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
      }
      const userPermissions: number[] = Array.isArray(req.user?.permissions)
        ? req.user.permissions
        : [];
      // ✅ ดึงข้อมูล Master Filter
      const result = await this.ticketService.getAllMasterFilter(userId);
      console.log('✅ getAllMasterFilter success');

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('💥 Error in getAllMasterFilter:', error);

      if (error instanceof ForbiddenException) {
        throw error;
      }

      throw new HttpException('เกิดข้อผิดพลาดในระบบ', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ✅ Specific ticket routes (with "ticket" prefix) come BEFORE generic :id route
  @Get('tickets/:ticket_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('read_ticket', 'read_all_tickets')
  async getTicketByNo(@Param('ticket_no') ticketNo: string, @Req() req: any) {
    try {
      // ✅ ดึง userId จาก token
      const userId = req.user?.id || req.user?.userId || req.user?.user_id || req.user?.sub;
      if (!userId) {
        return {
          code: 2,
          message: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่',
          data: null,
        };
      }

      // ✅ ดึงข้อมูลตั๋ว
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const data = await this.ticketService.getTicketData(ticketNo, baseUrl);

      return {
        code: 1,
        message: 'Success',
        data,
      };
    } catch (error) {
      console.error('Error in getTicketByNo:', error);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  // ใช้สำหรับ supporter
  @Patch('tickets/:ticket_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('update_ticket')
  async updateTicketByNo(
    @Param('ticket_no') ticket_no: string,
    @Body() updateDto: UpdateTicketDto,
    @Request() req: any
  ) {
    try {
      const userId = this.extractUserId(req);

      if (!userId) {
        return {
          code: 2,
          message: 'User not authenticated',
          data: null,
        };
      }

      // ✅ เรียก service เพื่ออัปเดตตั๋ว
      const ticket = await this.ticketService.updateTicket(ticket_no, updateDto, userId);

      return {
        code: 1,
        message: 'Ticket updated successfully',
        data: ticket,
      };
    } catch (error) {
      console.error('Error:', error.message);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('change_status')
  @Patch('updateTicketStatus/:id')
  @ApiOperation({ summary: 'Update ticket status and log history' })
  @ApiParam({ name: 'id', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket status updated successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async updateTicketStatus(
    @Param('id', ParseIntPipe) ticketId: number,
    @Body() body: {
      status_id: number;
      fix_issue_description?: string;
    },
    @Request() req: any,
  ) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        throw new HttpException('User not authenticated properly', HttpStatus.UNAUTHORIZED);
      }

      // ✅ Validate status_id
      if (!body.status_id || isNaN(body.status_id)) {
        return {
          code: 2,
          message: 'status_id must be a valid number',
          data: null,
        };
      }

      const result = await this.ticketStatusService.updateTicketStatusAndHistory(
        ticketId,
        body.status_id,
        userId,
        body.fix_issue_description,
      );

      return {
        code: 1,
        message: 'Ticket status updated successfully',
        data: result,
      };
    } catch (error) {
      console.error('💥 Error updating ticket status:', error);
      return {
        code: 2,
        message: error.message || 'Failed to update ticket status',
        data: null,
      };
    }
  }

  // ✅ ลบตั๋วด้วย ticket_no
  @Delete('tickets/:ticket_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('delete_ticket')
  async deleteTicketByNo(
    @Param('ticket_no') ticket_no: string,
    @Request() req: any
  ) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        return { code: 2, message: 'User not authenticated', data: null };
      }

      await this.ticketService.softDeleteTicket(ticket_no, userId);

      return {
        code: 1,
        message: 'ลบตั๋วสำเร็จ',
        data: { ticket_no, deleted_by: userId, deleted_at: new Date().toISOString() },
      };
    } catch (error) {
      console.error('💥 Error deleting ticket:', error);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาดในการลบตั๋ว',
        data: null,
      };
    }
  }

  // ✅ กู้คืนตั๋ว
  @Post('tickets/restore/:ticker_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('restore_ticket')
  async restoreTicketByNo(
    @Param('ticket_no') ticket_no: string,
    @Request() req: any
  ) {
    try {
      const userId = this.extractUserId(req);
      if (!userId) {
        return { code: 2, message: 'User not authenticated', data: null };
      }

      await this.ticketService.restoreTicketByNo(ticket_no, userId);

      return {
        code: 1,
        message: 'กู้คืนตั๋วสำเร็จ',
        data: {
          ticket_no,
          restored_by: userId,
          restored_at: new Date().toISOString()
        },
      };
    } catch (error) {
      console.error('💥 Error restoring ticket:', error);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาดในการกู้คืน',
        data: null,
      };
    }
  }

  // ✅ ดูรายการตั๋วที่ถูกลบ (สำหรับผู้ที่มีสิทธิ์ดูทั้งหมด)
  @Get('tickets/deleted')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('viwe_ticket_delete')
  async softDeleteTicket(@Request() req: any) {
    try {
      const userId = this.extractUserId(req);

      if (!userId) {
        return {
          code: 2,
          message: 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่',
          data: null,
        };
      }

      // ✅ ดึงรายการตั๋วที่ถูกลบ
      const deletedTickets = await this.ticketService.getDeletedTickets();

      return {
        code: 1,
        message: 'ดึงรายการตั๋วที่ถูกลบสำเร็จ',
        data: deletedTickets,
      };
    } catch (error) {
      console.error('💥 Error getting deleted tickets:', error);
      return {
        code: 2,
        message: error.message || 'เกิดข้อผิดพลาด',
        data: null,
      };
    }
  }

  // rating from user
  @Post('satisfaction/:ticket_no')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('rate_satisfaction')
  @HttpCode(HttpStatus.CREATED)
  async saveSatisfaction(
    @Param('ticket_no') ticketNo: string,
    @Body() createSatisfactionDto: CreateSatisfactionDto,
    @Request() req: any
  ) {
    try {
      const userId = req.user?.id;

      const result = await this.ticketService.saveSatisfaction(
        ticketNo,
        createSatisfactionDto,
        userId
      );

      return {
        success: true,
        message: 'บันทึกคะแนนความพึงพอใจสำเร็จ',
        data: result
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: 'ไม่สามารถบันทึกการประเมินได้',
          error: error.message
        },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // ✅ ปรับปรุง extractUserId ให้ debug และ handle หลาย format
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

  @UseGuards(JwtAuthGuard)
  @Get(':id/status')
  async getTicketStatus(
    @Param('id', ParseIntPipe) ticketId: number,
    @Req() req: any
  ) {
    try {
      console.log('🚀 Request started for ticket:', ticketId);

      const userId = this.extractUserId(req);
      if (!userId) {
        throw new UnauthorizedException('Cannot extract user information from token');
      }

      // ✅ ตรวจสอบสิทธิ์การเข้าถึงด้วย role
      const userPermissions = req.user.permissions || [];
      const hasAccess = await this.canAccessTicket(userId, ticketId, userPermissions)
      if (!hasAccess) {
        throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงสถานะตั๋วปัญหานี้');
      }

      const languageId = this.getLanguage(req);

      const ticketStatus = await this.ticketStatusService.getTicketStatusWithName(
        ticketId,
        languageId
      );

      if (!ticketStatus) {
        throw new NotFoundException(`ไม่พบตั๋วปัญหา ID: ${ticketId}`);
      }

      return {
        code: 1,
        message: 'Success',
        data: {
          ...ticketStatus,
          detected_language: languageId,
          request_timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('💥 Error getting ticket status:', error);

      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      return {
        code: 0,
        message: 'ไม่สามารถดึงสถานะตั๋วปัญหาได้',
        error: error.message,
        data: null
      };
    }
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequireAnyAction('assign_ticket')
  @Get('getTicketRelate')
  async getRelatedTickets(
    @Query('project_id') project_id: number,
    @Query('categories_id') categories_id: number,
  ){
    return this.ticketService.getRelatedTickets(project_id, categories_id);
  }
}