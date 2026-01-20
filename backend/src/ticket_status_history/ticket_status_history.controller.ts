import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Request,
  NotFoundException,
  BadRequestException,
  UseGuards,
  InternalServerErrorException
} from '@nestjs/common';
import { TicketStatusHistoryService } from './ticket_status_history.service';
import { CreateTicketStatusHistoryDto } from './dto/create-ticket_status_history.dto';
import { UpdateTicketStatusHistoryDto } from './dto/update-ticket_status_history.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';

@Controller('api')
export class TicketStatusHistoryController {
  constructor(private readonly ticketStatusHistoryService: TicketStatusHistoryService) { }

  @Get('ticket/:ticketId/current-status')
  @UseGuards(JwtAuthGuard)
  async getCurrentStatus(
  @Param('ticketId', ParseIntPipe) ticketId: number,
  @Request() req: any
) {
  try {
    const currentStatus = await this.ticketStatusHistoryService.getCurrentTicketStatus(ticketId);

    if (!currentStatus) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    return {
      success: true,
      message: 'Current status retrieved',
      data: currentStatus,
    };
  } catch (error) {
    // ถ้าเป็น HTTP exception ให้ throw ออก
    if (error instanceof NotFoundException || error instanceof BadRequestException) {
      throw error;
    }

    console.error('💥 Error getting current status:', error);

    // throw หรือ return internal error
    throw new InternalServerErrorException('Failed to get current status');
  }
}

  // ✅ POST - บันทึก status change (แก้ไขแล้ว)
  @Post('history/:ticketId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createHistory(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() createDto: { status_id: number }, // เปลี่ยนเป็น inline type ง่ายๆ
    @Request() req: any
  ) {
    try {
      console.log(`📝 Creating history for ticket ${ticketId}, status: ${createDto.status_id}`);

      // ✅ สร้าง history data โดยไม่ส่ง create_date (ให้ database จัดการ)
      const historyData = {
        ticket_id: ticketId,
        status_id: createDto.status_id,
        create_by: req.user.id
        // ไม่ส่ง create_date เพราะ @CreateDateColumn จะจัดการให้
      };

      // ✅ บันทึก history
      const history = await this.ticketStatusHistoryService.createHistory(historyData);

      // ✅ ดึงข้อมูล status name สำหรับ response
      const statusName = await this.ticketStatusHistoryService.getStatusName(createDto.status_id);

      return {
        success: true,
        message: 'History entry created successfully',
        data: {
          id: history.id,
          ticket_id: history.ticket_id,
          status_id: history.status_id,
          status_name: statusName,
          create_by: history.create_by,
          create_date: history.create_date,
          created_by_user: req.user.username || req.user.email
        }
      };
    } catch (error) {
      console.error('💥 Error creating history:', error);
      throw error;
    }
  }

  // ✅ POST - บันทึก status change พร้อมชื่อ status (แก้ไขแล้ว)
  @Post('history/status-change/:ticketId')
  @HttpCode(HttpStatus.CREATED)
  async logStatusChange(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() body: {
      status_id: number;
      status_name?: string; // optional สำหรับ validation
    },
    @Request() req: any
  ) {
    try {
      console.log(`📊 Logging status change for ticket ${ticketId} to status ${body.status_id}`);

      // ✅ Validate status exists ถ้าส่ง status_name มา
      if (body.status_name) {
        const isValidStatus = await this.ticketStatusHistoryService.validateStatus(body.status_id, body.status_name);
        if (!isValidStatus) {
          throw new BadRequestException(`Invalid status: ${body.status_name} (ID: ${body.status_id})`);
        }
      }

      // ✅ สร้าง history โดยไม่ส่ง create_date
      const historyData = {
        ticket_id: ticketId,
        status_id: body.status_id,
        create_by: req.user.id
      };

      const history = await this.ticketStatusHistoryService.createHistory(historyData);
      const statusName = await this.ticketStatusHistoryService.getStatusName(body.status_id);

      return {
        success: true,
        message: 'Status change logged successfully',
        data: {
          id: history.id,
          ticket_id: ticketId,
          status_id: body.status_id,
          status_name: statusName,
          create_date: history.create_date,
          changed_by: req.user.username || req.user.email
        }
      };
    } catch (error) {
      console.error('💥 Error logging status change:', error);
      throw error;
    }
  }
}
