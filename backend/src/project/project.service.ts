import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { CustomerForProject } from '../customer_for_project/entities/customer-for-project.entity';
import { Customer } from '../customer/entities/customer.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PermissionService } from '../permission/permission.service';

interface ProjectRow {
  project_id: number;
  project_name: string;
  customer_id?: number;     // optional เผื่อกรณีไม่มี customer
  customer_name?: string;
}

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,

    @InjectRepository(CustomerForProject)
    private customerForProjectRepository: Repository<CustomerForProject>,

    private readonly permissionService: PermissionService,
    private readonly dataSource: DataSource,
  ) { }

  // เพิ่มเมธอดสร้างโปรเจคใหม่
  async createProject(createProjectDto: CreateProjectDto) {
    try {
      const { create_by, ...projectData } = createProjectDto;

      if (!create_by) {
        throw new BadRequestException('User ID is required');
      }

      // ใช้เฉพาะฟิลด์ที่มีอยู่จริงใน Entity
      const newProject = this.projectRepository.create({
        ...projectData,
        create_by: create_by,
        isenabled: true
      });

      const savedProject = await this.projectRepository.save(newProject);

      return {
        code: 1,
        status: true,
        message: 'โปรเจคถูกสร้างเรียบร้อยแล้ว',
        data: savedProject
      };
    } catch (error) {
      console.error('Error creating project:', error);
      return {
        code: 0,
        status: false,
        message: 'เกิดข้อผิดพลาดในการสร้างโปรเจค',
        error: error.message
      };
    }
  }

  async checkUserPermissions(userId: number): Promise<number[]> {
    const rows = await this.dataSource.query(
      'SELECT role_id FROM users_allow_role WHERE user_id = $1',
      [userId]
    );
    // rows = [{ role_id: 1 }, { role_id: 2 }, ...]
    const roleIds = rows.map(r => r.role_id);
    return roleIds;
  }

  async getProjectsForUser(userId: number) {
    try {
      console.log('Getting projects for user:', userId);

      // check permission can see all project
      const userPermissions: number[] = await this.checkUserPermissions(userId);
      const canViewAllProject = await this.permissionService.canReadAllProject(
        userId,
        userPermissions,
      );

      let projects: ProjectRow[] = [];

      if (canViewAllProject) {
        // 🔑 เห็นทุกโปรเจค → ไม่สน customer
        projects = await this.projectRepository
          .createQueryBuilder('p')
          .where('p.isenabled = :enabled', { enabled: true })
          .select([
            'p.id as project_id',
            'p.name as project_name',
          ])
          .getRawMany<ProjectRow>();
      } else {
        // 🔒 เห็นเฉพาะโปรเจคที่มีสิทธิ์ และ join customer
        projects = await this.customerForProjectRepository
          .createQueryBuilder('cfp')
          .innerJoin('cfp.project', 'p')
          .innerJoin('cfp.customer', 'c')
          .andWhere('cfp.isenabled = :enabled', { enabled: true })
          .andWhere('p.isenabled = :projectEnabled', { projectEnabled: true })
          .andWhere('cfp.user_id = :userId', { userId })
          .select([
            'p.id as project_id',
            'p.name as project_name',
            'c.id as customer_id',
            'c.name as customer_name',
          ])
          .getRawMany<ProjectRow>();
      }

      if (projects.length === 0) {
        return {
          code: 1,
          status: false,
          message: 'ไม่พบข้อมูลโปรเจค',
          data: [],
        };
      }

      // กันข้อมูลซ้ำโดย project_id
      const uniqueProjects = new Map<number, ProjectRow>();
      projects.forEach(p => {
        if (!uniqueProjects.has(p.project_id)) {
          uniqueProjects.set(p.project_id, p);
        }
      });

      const formattedData = Array.from(uniqueProjects.values()).map(row => ({
        id: row.project_id,
        name: row.project_name,
        customer_id: row.customer_id ?? null,
        customer_name: row.customer_name ?? null,
      }));

      return {
        code: 1,
        status: true,
        message: 'Success',
        data: formattedData,
      };
    } catch (error) {
      console.error('Error in getProjectsForUser:', error);
      return {
        code: 0,
        status: false,
        message: 'Failed to fetch projects',
        error: error.message,
      };
    }
  }

  async getProjects() {
    try {
      const result = await this.projectRepository.query(`
        SELECT id, name, status
        FROM project
        WHERE isenabled = TRUE
      `);

      if (!result || result.length === 0) {
        return {
          code: 1,
          status: false,
          message: "ไม่พบข้อมูลโปรเจค",
          data: []
        };
      }

      return {
        code: 0,
        status: true,
        message: 'Get all projects successful',
        data: result
      };
    } catch (error) {
      console.log('Error of get all project:', error);
      return {
        code: 1,
        status: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลโปรเจค',
        data: []
      };
    }
  }

  // Method สำหรับหาโปรเจคตาม ID
  async getProjectById(projectId: number) {
    try {
      const project = await this.projectRepository.findOne({
        where: { id: projectId, isenabled: true },
        relations: ['customerProjects', 'customerProjects.customer', 'customerProjects.user'],
      });

      if (!project) {
        return {
          code: 0,
          status: false,
          message: 'ไม่พบโปรเจคที่ระบุ',
          data: null,
        };
      }

      const formattedData = {
        id: project.id,
        name: project.name,
        // description: project.description, // ลบออกถ้า entity ไม่มี field นี้
        create_date: project.create_date,
        isenabled: project.isenabled,
        assignments: project.customerProjects // เปลี่ยนจาก customerForProjects
          ?.filter(cfp => cfp.isenabled)
          .map(cfp => ({
            customer_id: cfp.customer?.id,
            customer_name: cfp.customer?.name,
            user_id: cfp.userId,
            user_name: cfp.users?.username || cfp.users?.email,
          })) || [],
      };

      return {
        code: 1,
        status: true,
        message: 'Success',
        data: formattedData,
      };
    } catch (error) {
      console.error('Error in getProjectById:', error);
      return {
        code: 0,
        status: false,
        message: 'Failed to fetch project',
        error: error.message,
      };
    }
  }

  async updateProject(id: number, updateProjectDto: Partial<UpdateProjectDto>) {
    // หา project ก่อน
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }

    // อัพเดตค่าที่มีใน DTO
    Object.assign(project, updateProjectDto);

    // บันทึก
    await this.projectRepository.save(project);

    return {
      code: 1,
      message: 'Project updated successfully',
      data: project,
    };
  }


  async deleteProject(id: number) {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with id ${id} not found`);
    }

    await this.projectRepository.remove(project);

    return {
      code: 1,
      message: 'Project deleted successfully',
    };
  }
}