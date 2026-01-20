import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CustomerForProject } from './entities/customer-for-project.entity';
import { Project } from '../project/entities/project.entity';
import { Customer } from '../customer/entities/customer.entity';
import { CreateCustomerForProjectDto } from './dto/create-customer_for_project.dto';
import { UpdateCustomerForProjectDto } from './dto/update-customer_for_project.dto';
import { Users } from '../users/entities/user.entity';

@Injectable()
export class CustomerForProjectService {
  constructor(
    @InjectRepository(CustomerForProject)
    private customerForProjectRepository: Repository<CustomerForProject>,
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(Customer)
    private customerRepository: Repository<Customer>,
    @InjectRepository(Users)
    private userRepo: Repository<Users>,
  ) { }

  async create(createDto: CreateCustomerForProjectDto) {
    // ตรวจสอบ project
    const project = await this.projectRepository.findOneBy({ id: createDto.project_id });
    if (!project) {
      return { code: '0', status: false, message: 'ไม่พบข้อมูลโปรเจค', data: null };
    }

    // ตรวจสอบ customer
    const customer = await this.customerRepository.findOneBy({ id: createDto.customer_id });
    if (!customer) {
      return { code: '0', status: false, message: 'ไม่พบข้อมูลลูกค้า', data: null };
    }

    const savedRecords: CustomerForProject[] = [];

    for (const user of createDto.assigned_users) {
      // ตรวจสอบซ้ำ
      const existing = await this.customerForProjectRepository.findOne({
        where: {
          customerId: createDto.customer_id,
          projectId: createDto.project_id,
          userId: user.user_id,
          isenabled: true,
        },
      });

      if (existing) {
        // ข้าม user ที่ซ้ำ
        continue;
      }

      const customerForProject = new CustomerForProject();
      customerForProject.customerId = createDto.customer_id;
      customerForProject.projectId = createDto.project_id;
      customerForProject.userId = user.user_id;
      customerForProject.create_by = createDto.create_by;
      customerForProject.update_by = createDto.update_by;
      customerForProject.isenabled = true;

      const saved = await this.customerForProjectRepository.save(customerForProject);
      savedRecords.push(saved);
    }

    return {
      code: '2',
      status: true,
      message: 'สร้างข้อมูลสำเร็จ',
      data: savedRecords,
    };
  }

  async getCFPdata() {
    const result = await this.customerRepository
      .createQueryBuilder('c')
      .leftJoin('customer_for_project', 'cfp', 'cfp.customer_id = c.id AND cfp.isenabled = true')
      .leftJoin('project', 'p', 'p.id = cfp.project_id')
      .leftJoin('users_allow_role', 'uar', 'uar.user_id = cfp.user_id')
      .leftJoin('users', 'u', 'u.id = uar.user_id')
      .leftJoin('ticket', 't', 't.project_id = p.id AND t.status_id = :openStatusId')
      .select([
        'p.id as project_id',
        'p.name as project_name',
        'p.status as project_status',
        'c.id as customer_id',
        'c.name as customer_name',
        'c.email as customer_email',
        'c.telephone as customer_phone',
        `COALESCE(
        JSON_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'cfp_id', cfp.id,
            'user_id', u.id,
            'name', u.firstname || ' ' || u.lastname
          )
        ) FILTER (WHERE u.id IS NOT NULL), '[]'
      ) as assigned_users`,
        'COUNT(DISTINCT c.id) as customer_count',
        'COUNT(DISTINCT cfp.user_id) as user_count',
        'COUNT(DISTINCT t.id) as open_ticket_count',
      ])
      .setParameter('openStatusId', 2)
      .groupBy('p.id, p.name, p.status, c.id, c.name, c.email, c.telephone')
      .getRawMany();

    // 👉 Group ตาม project_id
    const projectsMap = new Map<number, any>();

    result.forEach((row) => {
      const projectId = row.project_id;

      if (!projectsMap.has(projectId)) {
        projectsMap.set(projectId, {
          project_id: row.project_id,
          project_name: row.project_name,
          project_status: row.project_status,
          customers: [],
        });
      }

      const project = projectsMap.get(projectId);

      project.customers.push({
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        customer_phone: row.customer_phone,
        assigned_users: row.assigned_users || [],
        customer_count: parseInt(row.customer_count) || 0,
        user_count: parseInt(row.user_count) || 0,
        open_ticket_count: parseInt(row.open_ticket_count) || 0,
      });
    });

    return {
      status: 1,
      message: 'Success',
      data: Array.from(projectsMap.values()),
    };
  }

  async findAllByUser(userId: number) {
    const records = await this.customerForProjectRepository.find({
      where: { userId: userId, isenabled: true },
      relations: ['customer', 'project'],
      order: { create_date: 'DESC' }
    });

    const customerMap = new Map();

    records.forEach(record => {
      if (!customerMap.has(record.customer.id)) {
        customerMap.set(record.customer.id, {
          customerId: record.customer.id,
          customerName: record.customer.name,
          project: []
        });
      }

      customerMap.get(record.customer.id).project.push({
        projectId: record.project.id,
        projectName: record.project.name
      });
    });

    return {
      code: '2',
      status: true,
      message: 'Success',
      data: records.map(record => ({
        id: record.id,
        customer: {
          id: record.customer.id,
          name: record.customer.name
        },
        project: {
          id: record.project.id,
          name: record.project.name
        },
        createDate: record.create_date
      }))
    };
  }

  async findOne(id: number) {
    const record = await this.customerForProjectRepository.findOne({
      where: { id, isenabled: true },
      relations: ['users', 'project', 'customer']
    });

    if (!record) {
      return {
        status: 0,
        message: 'ไม่พบข้อมูล',
        data: null
      };
    }

    return {
      status: 1,
      message: 'Success',
      data: record
    };
  }

  async update(id: number, updateDto: UpdateCustomerForProjectDto, userId: number) {
    const record = await this.customerForProjectRepository.findOneBy({ id, isenabled: true });

    if (!record) {
      throw new NotFoundException('ไม่พบข้อมูล customer_for_project');
    }

    // -----------------------------
    // ตรวจสอบ project_id
    // -----------------------------
    if (updateDto.project_id !== undefined) {
      const project = await this.projectRepository.findOneBy({ id: updateDto.project_id });
      if (!project) {
        throw new NotFoundException('ไม่พบข้อมูลโปรเจค');
      }
      record.projectId = updateDto.project_id;
    }

    // -----------------------------
    // ตรวจสอบ customer_id
    // -----------------------------
    if (updateDto.customer_id !== undefined) {
      const customer = await this.customerRepository.findOneBy({ id: updateDto.customer_id });
      if (!customer) {
        throw new NotFoundException('ไม่พบข้อมูลลูกค้า');
      }
      record.customerId = updateDto.customer_id;
    }

    // -----------------------------
    // จัดการ assigned_users
    // -----------------------------
    if (updateDto.assigned_users !== undefined) {
      const existingRecords = await this.customerForProjectRepository.findBy({
        projectId: record.projectId,
        customerId: record.customerId,
        isenabled: true,
      });
      const existingUserIds = existingRecords.map(r => r.userId);

      const newUserIds = updateDto.assigned_users.map(u => u.user_id);

      // validate user id ที่ส่งมาใหม่ว่ามีจริงในระบบหรือไม่
      for (const uid of newUserIds) {
        const user = await this.userRepo.findOneBy({ id: uid });
        if (!user) {
          throw new BadRequestException(`ไม่พบ user id: ${uid}`);
        }
      }

      const usersToAdd = newUserIds.filter(uid => !existingUserIds.includes(uid));
      const usersToRemove = existingUserIds.filter(uid => !newUserIds.includes(uid));

      // ✅ Insert ใหม่
      for (const uid of usersToAdd) {
        try {
          const newRecord = this.customerForProjectRepository.create({
            projectId: record.projectId,
            customerId: record.customerId,
            userId: uid,
            create_by: userId,
            update_by: userId,
            update_date: new Date(),
            isenabled: true,
          });
          await this.customerForProjectRepository.save(newRecord);
        } catch (err) {
          throw new InternalServerErrorException(`Insert userId ${uid} ล้มเหลว: ${err.message}`);
        }
      }

      // ✅ Soft delete
      if (usersToRemove.length > 0) {
        try {
          const result = await this.customerForProjectRepository
            .createQueryBuilder()
            .update()
            .set({ isenabled: false, update_by: userId, update_date: new Date() })
            .where('projectId = :projectId', { projectId: record.projectId })
            .andWhere('customerId = :customerId', { customerId: record.customerId })
            .andWhere('userId IN (:...usersToRemove)', { usersToRemove })
            .execute();

          if (result.affected === 0) {
            throw new NotFoundException(`ไม่พบ userIds ที่จะลบ: ${usersToRemove.join(', ')}`);
          }
        } catch (err) {
          throw new InternalServerErrorException(`Soft delete ล้มเหลว: ${err.message}`);
        }
      }
    }

    // -----------------------------
    // Update field อื่น ๆ
    // -----------------------------
    const allowedFields: (keyof UpdateCustomerForProjectDto)[] = ['customer_id', 'project_id'];
    allowedFields.forEach(field => {
      if (updateDto[field] !== undefined && !['project_id', 'customer_id'].includes(field)) {
        (record as any)[field] = updateDto[field];
      }
    });

    record.update_by = userId;
    record.update_date = new Date();

    await this.customerForProjectRepository.save(record);

    // ✅ ดึงข้อมูลล่าสุด
    const updatedRecords = await this.customerForProjectRepository.findBy({
      projectId: record.projectId,
      customerId: record.customerId,
      isenabled: true,
    });

    return {
      status: 1,
      message: 'อัพเดทข้อมูลสำเร็จ',
      data: updatedRecords,
    };
  }

  async remove(id: number | number[]) {
    // แปลงเป็น array เสมอ
    const ids = Array.isArray(id) ? id : [id];
    
    // ตรวจสอบว่ามี ids ส่งมาหรือไม่
    if (ids.length === 0) {
      return {
        status: 0,
        message: 'ไม่มีข้อมูลที่ต้องการลบ',
        data: null
      };
    }

    // ค้นหาข้อมูลทั้งหมดที่ต้องการลบ
    const records = await this.customerForProjectRepository.findBy({ 
      id: In(ids), 
      isenabled: true 
    });

    if (records.length === 0) {
      return {
        status: 0,
        message: 'ไม่พบข้อมูล',
        data: null
      };
    }

    // Soft delete โดยเปลี่ยนค่า isenabled เป็น false ทั้งหมด
    records.forEach(record => {
      record.isenabled = false;
    });
    
    await this.customerForProjectRepository.save(records);

    return {
      status: 1,
      message: `ลบข้อมูลสำเร็จ ${records.length} รายการ`,
      data: {
        deletedCount: records.length,
        deletedIds: records.map(r => r.id)
      }
    };
  }

  // เพิ่มเมธอดนี้ใน CustomerForProjectService
  async changeUserAssignment(id: number, newUserId: number, currentUserId: number) {
    const record = await this.customerForProjectRepository.findOneBy({ id, isenabled: true });

    if (!record) {
      return {
        status: 0,
        message: 'ไม่พบข้อมูล',
        data: null
      };
    }

    // อัพเดทข้อมูล user_id
    record.userId = newUserId;
    record.update_date = new Date();
    record.update_by = currentUserId;

    await this.customerForProjectRepository.save(record);

    return {
      status: 1,
      message: 'เปลี่ยนผู้รับผิดชอบสำเร็จ',
      data: record
    };
  }

  // เพิ่มเมธอดใหม่สำหรับดึงข้อมูลโปรเจคตามลูกค้า
  async getProjectsByCustomer(customerId: number) {
    const records = await this.customerForProjectRepository.find({
      where: { customerId: customerId, isenabled: true },
      relations: ['project']
    });

    if (records.length === 0) {
      return {
        status: 0,
        message: 'ไม่พบข้อมูลโปรเจคของลูกค้านี้',
        data: null
      };
    }

    // กรองโปรเจคที่ซ้ำกัน
    const uniqueProjects = new Map();

    records.forEach(record => {
      if (!uniqueProjects.has(record.project.id)) {
        uniqueProjects.set(record.project.id, {
          id: record.id, // เอา id ของ record แรกที่เจอ
          project: {
            id: record.project.id,
            name: record.project.name
          }
        });
      }
    });

    return {
      status: 1,
      message: 'Success',
      data: Array.from(uniqueProjects.values())
    };
  }

  // เพิ่มเมธอดใน CustomerForProjectService
  async getUsersByCustomer(customerId: number) {
    const records = await this.customerForProjectRepository.find({
      where: { customerId: customerId, isenabled: true },
      relations: ['users']
    });

    if (records.length === 0) {
      return {
        status: 0,
        message: 'ไม่พบข้อมูล users ของลูกค้านี้',
        data: null
      };
    }

    // สร้าง array ของ users (ไม่ซ้ำกัน)
    const userMap = new Map();
    records.forEach(record => {
      if (!userMap.has(record.users.id)) {
        userMap.set(record.users.id, {
          id: record.users.id,
          name: record.users.username,
          email: record.users.email,
          firstname: record.users.firstname,
          lastname: record.users.lastname,
          phone: record.users.phone
        });
      }
    });

    return {
      code: '2',
      status: true,
      message: 'Success',
      data: Array.from(userMap.values())
    };
  }

  async getCustomerProjectsByUser(userId: number) {
    const records = await this.customerForProjectRepository.find({
      where: { userId: userId, isenabled: true },
      relations: ['customer', 'project']
    });

    if (records.length === 0) {
      return {
        code: '0',
        status: false,
        message: 'ไม่พบข้อมูลลูกค้าและโปรเจคของ user นี้',
        data: null
      };
    }

    // จัดกลุ่มข้อมูลตามลูกค้า
    const customerMap = new Map();

    records.forEach(record => {
      if (!customerMap.has(record.customer.id)) {
        customerMap.set(record.customer.id, {
          id: record.customer.id,
          name: record.customer.name,
          projects: []
        });
      }

      customerMap.get(record.customer.id).projects.push({
        id: record.project.id,
        name: record.project.name,
      });
    });

    return {
      code: '2',
      status: true,
      message: 'Success',
      data: Array.from(customerMap.values())
    };
  }
}
