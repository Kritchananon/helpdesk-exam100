import { Test, TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from '../permission/permission.guard';
import { UpdateProjectDto } from './dto/update-project.dto';

describe('ProjectController', () => {
  let controller: ProjectController;
  let service: ProjectService;

  // Mock service ให้มีทุกเมธอดที่ controller เรียกใช้
  const mockProjectService = {
    getProjectsForUser: jest.fn(),
    createProject: jest.fn(),
    getProjects: jest.fn(), // <--- แก้ไข: controller เรียก getProjectAll() ซึ่งไปเรียก service.getProjects()
    updateProject: jest.fn(),
    deleteProject: jest.fn(),
  };

  const mockUser = {
    id: 1,
    sub: 1,
    userId: 1,
  };

  const mockRequest = { user: mockUser };
  const mockResult = { code: 1, status: true, message: 'Success', data: {} };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        {
          provide: ProjectService,
          useValue: mockProjectService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProjectController>(ProjectController);
    service = module.get<ProjectService>(ProjectService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // เคลียร์ mock ทุกครั้งหลังจบ test
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProjectDDL', () => {
    it('should call getProjectsForUser with user ID from request', async () => {
      mockProjectService.getProjectsForUser.mockResolvedValue(mockResult);

      await controller.getProjectDDL(mockRequest);

      // ตรวจสอบว่า service ถูกเรียกด้วย userId ที่ถูกต้อง
      expect(mockProjectService.getProjectsForUser).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });

  describe('createProject', () => {
    it('should call createProject with correct DTO and user ID', async () => {
      const createDto: CreateProjectDto = { name: 'New Project', status: true };
      mockProjectService.createProject.mockResolvedValue(mockResult);

      const result = await controller.createProject(createDto, mockRequest);

      // ตรวจสอบว่ามีการเพิ่ม create_by เข้าไปใน DTO ก่อนส่ง
      expect(createDto.create_by).toBe(mockUser.id);
      expect(mockProjectService.createProject).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockResult);
    });
  });

  // --- เทสเมธอดที่มีอยู่จริง ---
  describe('getProjectAll', () => {
    it('should call service.getProjects', async () => {
      mockProjectService.getProjects.mockResolvedValue(mockResult);

      await controller.getProjectAll();

      expect(mockProjectService.getProjects).toHaveBeenCalled();
    });
  });

  describe('updateProject', () => {
    it('should call service.updateProject with id and dto', async () => {
      const id = 1;
      const dto: Partial<UpdateProjectDto> = { name: 'Updated Name' };
      mockProjectService.updateProject.mockResolvedValue(mockResult);

      await controller.updateProject(id, dto);

      expect(mockProjectService.updateProject).toHaveBeenCalledWith(id, dto);
    });
  });

  describe('deleteProject', () => {
    it('should call service.deleteProject with id', async () => {
      const id = 1;
      mockProjectService.deleteProject.mockResolvedValue(mockResult);

      await controller.deleteProject(id);

      expect(mockProjectService.deleteProject).toHaveBeenCalledWith(id);
    });
  });
});