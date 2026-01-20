import { Module } from '@nestjs/common';
import { ExportExcelService } from './export-excel.service';
import { ExportExcelController } from './export-excel.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../ticket/entities/ticket.entity';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket
    ]),
    PermissionModule,
  ],
  controllers: [ExportExcelController],
  providers: [ExportExcelService],
})
export class ExportExcelModule {}
