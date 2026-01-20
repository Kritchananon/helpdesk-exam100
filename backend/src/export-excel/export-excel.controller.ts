import { Controller, Post, Res, Body, UseGuards, Request } from '@nestjs/common';
import { ExportExcelService } from './export-excel.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from '../permission/permission.guard';

@Controller('api')
export class ExportExcelController {
  constructor(private readonly exportExcelService: ExportExcelService) { }

  @Post('export-excel')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  async exportTickets(@Res() res: Response, @Body() filter: any, @Request() req: any) {
    const userId = req.user?.userId;
    return this.exportExcelService.exportTickets(res, filter, userId);
  }
}