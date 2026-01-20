import { Test, TestingModule } from '@nestjs/testing';
import { ExportExcelController } from './export-excel.controller';
import { ExportExcelService } from './export-excel.service';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt_auth.guard'; // 1. Import Guards
import { PermissionGuard } from '../permission/permission.guard';
import { ExecutionContext } from '@nestjs/common';

// 2. สร้าง Mock Service (เหมือนเดิม)
const mockExportExcelService = {
  exportTickets: jest.fn(),
};

describe('ExportExcelController', () => {
  let controller: ExportExcelController;
  let service: ExportExcelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportExcelController],
      providers: [
        {
          provide: ExportExcelService,
          useValue: mockExportExcelService,
        },
      ],
    })
      // 3. Override Guards ที่ Controller นี้ใช้
      .overrideGuard(JwtAuthGuard)
      .useValue({
        // 4. Mock 'canActivate' ของ JwtAuthGuard
        canActivate: (context: ExecutionContext) => {
          // เราต้องจำลองการทำงานของ Guard ที่จะแนบ 'user' เข้ามาใน 'req'
          const req = context.switchToHttp().getRequest();
          req.user = { userId: 123 }; // ใช้ user id ที่ตรงกับใน test case
          return true; // คืนค่า true เพื่อให้ Guard ผ่าน
        },
      })
      .overrideGuard(PermissionGuard)
      .useValue({
        // 5. Mock 'canActivate' ของ PermissionGuard
        canActivate: () => true, // คืนค่า true เพื่อให้ Guard ผ่าน
      })
      .compile(); // 6. compile() หลัง override

    controller = module.get<ExportExcelController>(ExportExcelController);
    service = module.get<ExportExcelService>(ExportExcelService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('exportTickets', () => {
    it('should call exportExcelService.exportTickets with correct parameters', async () => {
      const mockRes = {} as Response;
      const mockFilter = { projectId: 1, statusId: 2 };
      // 7. เรายังคงต้องส่ง mockReq ที่มี 'user' object เข้าไป
      //    เพราะตัว decorator @Request() ใน Controller จะดึงค่านี้มา
      const mockReq = { user: { userId: 123 } };

      const serviceSpy = jest.spyOn(service, 'exportTickets');

      // 8. แม้ว่า Guard จะถูก mock แต่เรายังต้องส่ง mockReq ให้ Controller
      await controller.exportTickets(mockRes, mockFilter, mockReq);

      // 9. ตรวจสอบว่า service ถูกเรียกด้วย userId ที่ถูกต้อง (จาก mockReq)
      expect(serviceSpy).toHaveBeenCalledTimes(1);
      expect(serviceSpy).toHaveBeenCalledWith(mockRes, mockFilter, 123);
    });
  });
});