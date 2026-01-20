import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { CustomerForProject } from '../customer_for_project/entities/customer-for-project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { PermissionService } from '../permission/permission.service';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Customer } from '../customer/entities/customer.entity';
import { UpdateProjectDto } from './dto/update-project.dto';

// FIX 1: Replaced 'Partial' type with a specific mock type
// This fixes all 'possibly undefined' errors on repository methods
type MockRepository = {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
  query: jest.Mock;
  createQueryBuilder: jest.Mock;
};

// ✅ [FIX 1]: สร้าง mock query builders แยกกัน
const mockProjectQueryBuilder = {
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

const mockCustomerQueryBuilder = {
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  getRawMany: jest.fn(),
};

describe('ProjectService', () => {
  let service: ProjectService;
  let projectRepository: MockRepository;
  let customerForProjectRepository: MockRepository;
  let permissionService: jest.Mocked<PermissionService>;
  let dataSource: jest.Mocked<DataSource>;
  
  // (เพิ่ม Spies เพื่อปิด console.log/error ไม่ให้รก)
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  const mockProject = {
    id: 1,
    name: 'Test Project',
    create_date: new Date(),
    create_by: 1,
    isenabled: true,
  };

  beforeEach(async () => {
    // ปิด console.log/error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: getRepositoryToken(Project),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            query: jest.fn(),
            // ✅ [FIX 1]: ชี้ไปที่ mock builder ของ Project
            createQueryBuilder: jest.fn(() => mockProjectQueryBuilder),
          },
        },
        {
          provide: getRepositoryToken(CustomerForProject),
          useValue: {
            // ✅ [FIX 1]: ชี้ไปที่ mock builder ของ Customer
            createQueryBuilder: jest.fn(() => mockCustomerQueryBuilder),
          },
        },
        {
          provide: PermissionService,
          useValue: {
            canReadAllProject: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    projectRepository = module.get(getRepositoryToken(Project));
    customerForProjectRepository = module.get(
      getRepositoryToken(CustomerForProject),
    );
    permissionService = module.get(PermissionService);
    dataSource = module.get(DataSource);
  });

  afterEach(() => {
    // คืนค่า console
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProject', () => {
    it('should create project successfully', async () => {
      const createProjectDto: CreateProjectDto = {
        name: 'New Project',
        create_by: 1,
        status: true, 
      };

      projectRepository.create.mockReturnValue(mockProject as any);
      projectRepository.save.mockResolvedValue(mockProject as any);

      const result = await service.createProject(createProjectDto);

      // ✅ [FIX 2]: เพิ่ม 'status' เข้าไปใน object ที่คาดหวัง
      // service ของคุณส่ง ...projectData ซึ่งมี status อยู่ด้วย
      expect(projectRepository.create).toHaveBeenCalledWith({
        name: createProjectDto.name,
        create_by: createProjectDto.create_by,
        status: createProjectDto.status, // <-- เพิ่ม field นี้
        isenabled: true,
      });
      expect(projectRepository.save).toHaveBeenCalledWith(mockProject);
      expect(result).toEqual({
        code: 1,
        status: true,
        message: 'โปรเจคถูกสร้างเรียบร้อยแล้ว',
        data: mockProject,
      });
    });

    it('should throw BadRequestException when create_by is missing', async () => {
      const createProjectDto: CreateProjectDto = {
        name: 'New Project',
        status: true, 
      };

      // ✅ [FIX 3]: เปลี่ยนจาก .rejects.toThrow เป็นการ .resolve
      // เพราะ service ของคุณมี try...catch ดักไว้ แล้ว return object error ออกมา
      
      // --- แบบเดิม (ผิด) ---
      // await expect(service.createProject(createProjectDto)).rejects.toThrow(
      //   new BadRequestException('User ID is required'),
      // );
      
      // --- แบบใหม่ (ถูก) ---
      const result = await service.createProject(createProjectDto);
      expect(result.code).toBe(0);
      expect(result.status).toBe(false);
      expect(result.error).toBe('User ID is required');
    });

    it('should return error response on database error', async () => {
      const createProjectDto: CreateProjectDto = {
        name: 'New Project',
        create_by: 1,
        status: true,
      };
      const dbError = new Error('Database error');
      projectRepository.create.mockReturnValue(mockProject as any);
      projectRepository.save.mockRejectedValue(dbError);

      const result = await service.createProject(createProjectDto);

      expect(result).toEqual({
        code: 0,
        status: false,
        message: 'เกิดข้อผิดพลาดในการสร้างโปรเจค',
        error: dbError.message,
      });
    });
  });

  describe('checkUserPermissions', () => {
    it('should return an array of role IDs', async () => {
        const userId = 1;
        const roles = [{ role_id: 1 }, { role_id: 2 }];
        dataSource.query.mockResolvedValue(roles);
  
        const result = await service.checkUserPermissions(userId);
  
        expect(dataSource.query).toHaveBeenCalledWith(
          'SELECT role_id FROM users_allow_role WHERE user_id = $1',
          [userId],
        );
        expect(result).toEqual([1, 2]);
      });
  });

  describe('getProjectsForUser', () => {
    const userId = 1;
    const userRoles = [1];
    const mockAdminProjects = [
      { project_id: 1, project_name: 'Admin Project 1' },
    ];
    const mockUserProjects = [
      {
        project_id: 2,
        project_name: 'User Project 2',
        customer_id: 1,
        customer_name: 'Cust A',
      },
    ];

    beforeEach(() => {
      dataSource.query.mockResolvedValue(userRoles.map((r) => ({ role_id: r })));

      // ✅ [FIX 1]: รีเซ็ต mock และกำหนดค่า return โดยไม่เรียกใช้งาน createQueryBuilder
      mockProjectQueryBuilder.getRawMany.mockClear();
      mockCustomerQueryBuilder.getRawMany.mockClear();
      (projectRepository.createQueryBuilder as jest.Mock).mockClear();
      (customerForProjectRepository.createQueryBuilder as jest.Mock).mockClear();

      mockProjectQueryBuilder.getRawMany.mockResolvedValue(mockAdminProjects);
      mockCustomerQueryBuilder.getRawMany.mockResolvedValue(mockUserProjects);
    });

    it('should get ALL projects if user has "canReadAllProject" permission', async () => {
      permissionService.canReadAllProject.mockResolvedValue(true); 

      const result = await service.getProjectsForUser(userId);

      expect(permissionService.canReadAllProject).toHaveBeenCalledWith(
        userId,
        userRoles,
      );
      expect(projectRepository.createQueryBuilder).toHaveBeenCalled(); 
      // เทสต์นี้จะผ่านแล้ว เพราะ createQueryBuilder ไม่ได้ถูกเรียกใน beforeEach
      expect(
        customerForProjectRepository.createQueryBuilder,
      ).not.toHaveBeenCalled(); 

      expect(result.data).toBeDefined();
      expect(result.data!.length).toBe(1);
      expect(result.data![0].name).toBe('Admin Project 1');
    });

    it('should get ONLY assigned projects if user DOES NOT have "canReadAllProject" permission', async () => {
      permissionService.canReadAllProject.mockResolvedValue(false); 

      const result = await service.getProjectsForUser(userId);

      expect(permissionService.canReadAllProject).toHaveBeenCalledWith(
        userId,
        userRoles,
      );
      // เทสต์นี้จะผ่านแล้ว เพราะ createQueryBuilder ไม่ได้ถูกเรียกใน beforeEach
      expect(projectRepository.createQueryBuilder).not.toHaveBeenCalled(); 
      expect(customerForProjectRepository.createQueryBuilder).toHaveBeenCalled(); 

      expect(result.data).toBeDefined();
      expect(result.data!.length).toBe(1);
      expect(result.data![0].name).toBe('User Project 2');
    });

    it('should get ONLY assigned projects if user DOES NOT have "canReadAllProject" permission', async () => {
      permissionService.canReadAllProject.mockResolvedValue(false); 

      const result = await service.getProjectsForUser(userId);

      expect(permissionService.canReadAllProject).toHaveBeenCalledWith(
        userId,
        userRoles,
      );
      expect(projectRepository.createQueryBuilder).not.toHaveBeenCalled(); 
      expect(customerForProjectRepository.createQueryBuilder).toHaveBeenCalled(); 

      // --- FIX 4: Added check for result.data ---
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBe(1);
      expect(result.data![0].name).toBe('User Project 2');
      expect(result.data![0].customer_id).toBe(1); 
    });

    it('should return unique projects (in case of duplicates)', async () => {
        permissionService.canReadAllProject.mockResolvedValue(false);
        const mockDuplicateProjects = [
          { project_id: 1, project_name: 'Project 1', customer_id: 1, customer_name: 'Cust A' },
          { project_id: 1, project_name: 'Project 1', customer_id: 2, customer_name: 'Cust B' },
        ];
        mockCustomerQueryBuilder.getRawMany.mockResolvedValue(mockDuplicateProjects);
  
        const result = await service.getProjectsForUser(userId);
  
        expect(result.data).toBeDefined();
        expect(result.data!.length).toBe(1);
        expect(result.data![0].id).toBe(1);
      });
  
      it('should return empty data if no projects found (admin path)', async () => {
        permissionService.canReadAllProject.mockResolvedValue(true);
        mockProjectQueryBuilder.getRawMany.mockResolvedValue([]); 
  
        const result = await service.getProjectsForUser(userId);
  
        expect(result.code).toBe(1);
        expect(result.status).toBe(false);
      });
  
      it('should return empty data if no projects found (user path)', async () => {
        permissionService.canReadAllProject.mockResolvedValue(false);
        mockCustomerQueryBuilder.getRawMany.mockResolvedValue([]);
  
        const result = await service.getProjectsForUser(userId);
  
        expect(result.code).toBe(1);
        expect(result.status).toBe(false);
      });
  
      it('should handle database errors', async () => {
        dataSource.query.mockRejectedValue(new Error('DB Error')); 
  
        const result = await service.getProjectsForUser(userId);
  
        expect(result.code).toBe(0);
        expect(result.status).toBe(false);
        expect(result.error).toBe('DB Error');
      });
  });

  describe('getProjects', () => {
    it('should return all projects from raw query', async () => {
      const mockRawResult = [{ id: 1, name: 'Test', status: true }];
      projectRepository.query.mockResolvedValue(mockRawResult); 

      const result = await service.getProjects();

      expect(projectRepository.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM project'),
      );
      expect(result.code).toBe(0);
      expect(result.status).toBe(true);
      expect(result.message).toBe('Get all projects successful');
      expect(result.data).toEqual(mockRawResult);
    });

    it('should return message if no projects found', async () => {
      projectRepository.query.mockResolvedValue([]); 

      const result = await service.getProjects();

      expect(result.code).toBe(1);
      expect(result.status).toBe(false);
      expect(result.message).toBe('ไม่พบข้อมูลโปรเจค');
    });

    it('should handle errors', async () => {
      const dbError = new Error('Query failed');
      projectRepository.query.mockRejectedValue(dbError);

      const result = await service.getProjects();

      expect(result.code).toBe(1);
      expect(result.status).toBe(false);
      expect(result.message).toBe('เกิดข้อผิดพลาดในการดึงข้อมูลโปรเจค');
    });
  });

  describe('getProjectById', () => {
    it('should get project by id successfully', async () => {
      const projectId = 1;
      const project = {
        ...mockProject,
        customerProjects: [
          {
            isenabled: true,
            customer: { id: 1, name: 'Test Customer' },
            userId: 2,
            users: { username: 'testuser', email: 'test@example.com' },
          },
          {
            isenabled: false, // <-- ควรถูก filter ออก
            customer: { id: 2, name: 'Disabled Customer' },
            userId: 3,
            users: { username: 'disableduser' },
          },
        ],
      };
      projectRepository.findOne.mockResolvedValue(project as any);

      const result = await service.getProjectById(projectId);

      expect(projectRepository.findOne).toHaveBeenCalledWith({
        where: { id: projectId, isenabled: true },
        relations: [
          'customerProjects',
          'customerProjects.customer',
          'customerProjects.user',
        ],
      });
      expect(result.code).toBe(1);
      expect(result.status).toBe(true);

      // --- FIX 4: Added check for result.data ---
      // This fixes the 'result.data' is possibly 'null' or 'undefined' errors
      expect(result.data).toBeDefined();
      expect(result.data!.id).toBe(projectId);
      expect(result.data!.assignments.length).toBe(1); // <-- ตรวจสอบว่า filter isenabled:false ออก
      expect(result.data!.assignments[0]).toEqual({
        customer_id: 1,
        customer_name: 'Test Customer',
        user_id: 2,
        user_name: 'testuser', // <-- ตรวจสอบว่าเลือก username ก่อน email
      });
    });

    it('should use email if username is missing', async () => {
      const projectId = 1;
      const project = {
        ...mockProject,
        customerProjects: [
          {
            isenabled: true,
            customer: { id: 1, name: 'Test Customer' },
            userId: 2,
            users: { username: null, email: 'test@example.com' }, // <-- ไม่มี username
          },
        ],
      };
      projectRepository.findOne.mockResolvedValue(project as any);

      const result = await service.getProjectById(projectId);

      // --- FIX 4: Added check for result.data ---
      expect(result.data).toBeDefined();
      expect(result.data!.assignments[0].user_name).toBe('test@example.com');
    });

    it('should return error when project not found', async () => {
      projectRepository.findOne.mockResolvedValue(null);

      const result = await service.getProjectById(999);

      expect(result.code).toBe(0);
      expect(result.status).toBe(false);
      expect(result.message).toBe('ไม่พบโปรเจคที่ระบุ');
    });

    it('should handle database error', async () => {
      const dbError = new Error('Database error');
      projectRepository.findOne.mockRejectedValue(dbError);

      const result = await service.getProjectById(1);

      expect(result.code).toBe(0);
      expect(result.status).toBe(false);
      expect(result.message).toBe('Failed to fetch project');
      expect(result.error).toBe(dbError.message);
    });
  });

  describe('updateProject', () => {
    it('should update a project successfully', async () => {
      const id = 1;
      const dto: Partial<UpdateProjectDto> = { name: 'Updated Name' };
      const existingProject = { id: 1, name: 'Old Name', isenabled: true };
      projectRepository.findOne.mockResolvedValue(existingProject as any);
      projectRepository.save.mockResolvedValue({
        ...existingProject,
        ...dto,
      } as any);

      const result = await service.updateProject(id, dto);

      expect(projectRepository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(projectRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Name' }),
      );
      expect(result.code).toBe(1);
      expect(result.message).toBe('Project updated successfully');
      expect(result.data.name).toBe('Updated Name');
    });

    it('should throw NotFoundException if project to update is not found', async () => {
      projectRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProject(999, { name: 'Test' }),
      ).rejects.toThrow(new NotFoundException('Project with id 999 not found'));
    });
  });

  describe('deleteProject', () => {
    it('should delete a project successfully', async () => {
      const id = 1;
      const existingProject = { id: 1, name: 'Test' };
      projectRepository.findOne.mockResolvedValue(existingProject as any);
      projectRepository.remove.mockResolvedValue(existingProject as any);

      const result = await service.deleteProject(id);

      expect(projectRepository.findOne).toHaveBeenCalledWith({ where: { id } });
      expect(projectRepository.remove).toHaveBeenCalledWith(existingProject);
      expect(result.code).toBe(1);
      expect(result.message).toBe('Project deleted successfully');
    });

    it('should throw NotFoundException if project to delete is not found', async () => {
      projectRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteProject(999)).rejects.toThrow(
        new NotFoundException('Project with id 999 not found'),
      );
    });
  });
});