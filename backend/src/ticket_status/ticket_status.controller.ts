import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Request,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import { TicketStatusService } from './ticket_status.service';
import { CreateTicketStatusDto } from './dto/create-ticket_status.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket_status.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { RequireAnyAction } from '../permission/permission.decorator';

@Controller('api')
export class TicketStatusController {
  constructor(private readonly statusService: TicketStatusService) { }

  @UseGuards(JwtAuthGuard)
  @RequireAnyAction('assign_ticket', 'solve_problem')
  @Post('getStatusDDL')
  async getStatusDDL(@Body() body: { language_id?: string }) {
    console.log('Controller received body:', body);
    return this.statusService.getStatusDDL(body?.language_id);
  }
  
  // ✅ แก้ไข function ให้มี return ครบทุก path
  private getLanguage(req: any, defaultLang: string = 'th'): string {
    try {
      console.log('🌐 Detecting language...');

      // 1. จาก query parameter (?lang=th)
      if (req.query && req.query.lang) {
        console.log(`✅ Language from query: ${req.query.lang}`);
        return String(req.query.lang);
      }

      // 2. จาก custom header (X-Language: th)
      if (req.headers) {
        const customLang = req.headers['x-language'] || req.headers['x-lang'];
        if (customLang) {
          console.log(`✅ Language from header: ${customLang}`);
          return String(customLang);
        }
      }

      // 3. จาก Accept-Language header
      if (req.headers && req.headers['accept-language']) {
        const acceptLang = req.headers['accept-language'];
        console.log(`🔍 Accept-Language: ${acceptLang}`);

        const lang = acceptLang.split(',')[0].split('-')[0].toLowerCase().trim();

        if (lang === 'th' || lang === 'thai') {
          console.log(`✅ Detected Thai language`);
          return 'th';
        }

        if (lang === 'en' || lang === 'english') {
          console.log(`✅ Detected English language`);
          return 'en';
        }
      }

      // 4. ✅ Default case - จะ return เสมอ
      console.log(`⚠️ Using default language: ${defaultLang}`);
      return defaultLang;

    } catch (error) {
      // 5. ✅ Error case - จะ return เสมอ
      console.error(`❌ Error detecting language:`, error);
      return defaultLang;
    }
  }

  // ✅ Get single ticket status
  @Get(':id/status')
  async getTicketStatus(
    @Param('id', ParseIntPipe) ticketId: number,
    @Req() req: any
  ) {
    try {
      const languageId = this.getLanguage(req);
      console.log(`🌐 Auto-detected language: ${languageId} for ticket ${ticketId}`);

      const ticketStatus = await this.statusService.getTicketStatusWithName(
        ticketId,
        languageId
      );

      if (!ticketStatus) {
        return {
          code: 0,
          message: `Ticket ${ticketId} not found`,
          data: null
        };
      }

      return {
        code: 1,
        message: 'Success',
        data: {
          ...ticketStatus,
          detected_language: languageId
        }
      };
    } catch (error) {
      return {
        code: 0,
        message: 'Failed to get ticket status',
        error: error.message
      };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('status')
  async createStatus(@Body() body: any, @Request() req) {
    console.log('=== DEBUG: Incoming Request ===');
    console.log('Raw body:', JSON.stringify(body, null, 2));
    console.log('statusLang value:', body.statusLang);
    console.log('statusLang type:', typeof body.statusLang);
    console.log('Is array:', Array.isArray(body.statusLang));
    console.log('Body keys:', Object.keys(body));
    console.log('==============================');

    const userId = req.user.id || req.user.sub || req.user.userId;
    body.create_by = userId;

    return this.statusService.createStatus(body);
  }

  @Get('ticketHistory/:id')
  @UseGuards(JwtAuthGuard)
  async getTicketHistory(@Param('id', ParseIntPipe) ticketId: number) {
    try {
      const history = await this.statusService.getTicketStatusHistory(ticketId);

      return {
        code: 1,
        message: 'Success',
        data: history,
      };
    } catch (error) {
      console.error('Error getting ticket history:', error);
      return {
        code: 2,
        message: error.message || 'Failed to get ticket history',
        data: null,
      };
    }
  }
}