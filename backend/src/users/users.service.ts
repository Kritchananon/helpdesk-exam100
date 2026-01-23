import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Users } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto'
import * as bcrypt from 'bcrypt';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { CreateUserAllowRoleDto } from '../user_allow_role/dto/create-user_allow_role.dto';
import { PermissionService } from '../permission/permission.service';
import { UserAllowRoleService } from '../user_allow_role/user_allow_role.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(Users)
    private userRepository: Repository<Users>,
    @InjectRepository(UserAllowRole)
    private readonly userAllowRoleRepo: Repository<UserAllowRole>,

    private readonly permissionService: PermissionService,
    private readonly allowRoleService: UserAllowRoleService,
  ) { }

  async findByEmail(email: string): Promise<Users> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(createUserDto: CreateUserDto, createUserAllowRoleDto: CreateUserAllowRoleDto) {
    if (!createUserDto.email) {
      return {
        code: '3',
        message: 'กรุณาระบุอีเมล'
      };
    }

    // ตรวจสอบทั้ง username และ email ว่ามีในระบบแล้วหรือไม่
    const existingUsername = await this.userRepository.findOne({
      where: { username: createUserDto.username },
    });

    if (existingUsername) {
      return {
        code: '2',
        message: 'สร้างผู้ใช้ไม่สำเร็จ มีชื่อผู้ใช้นี้ในระบบแล้ว',
      };
    }

    const existingEmail = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingEmail) {
      return {
        code: '2',
        message: 'สร้างผู้ใช้ไม่สำเร็จ มีอีเมลนี้ในระบบแล้ว',
      };
    }

    // เข้ารหัสรหัสผ่านก่อนบันทึก
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    console.log('DTO:', createUserDto);
    console.log('UserAllowRole DTO:', createUserAllowRoleDto);

    const user = this.userRepository.create({
      username: createUserDto.username,
      password: hashedPassword,
      email: createUserDto.email,
      firstname: createUserDto.firstname,
      lastname: createUserDto.lastname,
      phone: createUserDto.phone,
      create_by: createUserDto.create_by,
      update_by: createUserDto.update_by,
    });

    try {
      // บันทึกข้อมูล User ก่อน
      const savedUser = await this.userRepository.save(user);

      if (!savedUser) {
        return {
          code: '4',
          message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ใช้'
        };
      }

      // ตรวจสอบว่ามี role_id ที่ต้องการบันทึกหรือไม่
      if (createUserAllowRoleDto && createUserAllowRoleDto.role_id && createUserAllowRoleDto.role_id.length > 0) {
        // สร้างและบันทึกข้อมูล user_allow_role สำหรับแต่ละ role
        const userAllowRoles = createUserAllowRoleDto.role_id.map(roleId =>
          this.userAllowRoleRepo.create({
            user_id: savedUser.id, // ใช้ user_id ที่เพิ่งบันทึก
            role_id: roleId,
          })
        );

        // บันทึกข้อมูล user_allow_role ทั้งหมด
        const savedUserAllowRoles = await this.userAllowRoleRepo.save(userAllowRoles);

        if (!savedUserAllowRoles || savedUserAllowRoles.length === 0) {
          return {
            code: '4',
            message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูลสิทธิ์ผู้ใช้'
          };
        }

        console.log('User Allow Roles saved:', savedUserAllowRoles);
      }

      return {
        code: '1',
        message: 'บันทึกสำเร็จ',
        data: savedUser,
      };

    } catch (error: unknown) {
      // จัดการกับ error ซึ่งมีประเภทเป็น unknown
      let errorMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';

      // ตรวจสอบว่า error เป็น Error object หรือไม่
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      return {
        code: '4',
        message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
        error: errorMessage
      };
    }
  }

  // 🧩 ดึง user ทั้งหมด (ไม่ต้องไปเรียกตัวเอง)
  async getAllUser(): Promise<any[]> {
  const users = await this.userRepository
    .createQueryBuilder('u')
    .where(qb => {
      const subQuery = qb
        .subQuery()
        .select('uar.user_id')
        .from('users_allow_role', 'uar')
        .where('uar.role_id IN (:...excludedRoles)')
        .getQuery();

      return `u.id NOT IN ${subQuery}`;
    })
    .setParameter('excludedRoles', [8, 15])
    .select([
      'u.id AS id',
      `CONCAT(u.firstname, ' ', u.lastname) AS name`,
      'u.email AS email',
    ])
    .orderBy('u.id', 'ASC')
    .getRawMany();

  return users;
}

  // 🧩 ดึง user ที่ไม่มี role 8,15
  async getUsersWithoutRole8And15() {
    try {
      // ✅ ดึงผู้ใช้ทั้งหมด (จาก DB โดยตรง)
      const allUsers = await this.userRepository.find({
        select: ['id', 'firstname', 'lastname', 'email'],
      });

      // ✅ ดึงผู้ใช้ที่มี role 8 และ 15
      const role8Users = await this.allowRoleService.getUsersByRole(8);
      const role15Users = await this.allowRoleService.getUsersByRole(15);

      // ✅ รวม id ที่ต้องตัดออก
      const excludedIds = [
        ...new Set([...role8Users.map(u => u.id), ...role15Users.map(u => u.id)]),
      ];

      // ✅ กรอง user ที่ไม่อยู่ใน excludedIds
      const filteredUsers = allUsers.filter(u => !excludedIds.includes(u.id));

      // ✅ จัดรูปข้อมูลให้ครบ
      return filteredUsers.map(u => ({
        id: u.id,
        name: `${u.firstname || ''} ${u.lastname || ''}`.trim(),
        email: u.email,
      }));
    } catch (error) {
      console.error('❌ Error while fetching users without role 8,15:', error);
      throw error;
    }
  }

  // ใน user.service.ts
  async getUserIdsByRole(
    roleIds: number[],
    filter?: { createBy?: number }
  ): Promise<number[]> {
    let query = this.userAllowRoleRepo
      .createQueryBuilder('uar')
      .select('uar.user_id', 'user_id')
      .where('uar.role_id IN (:...roleIds)', { roleIds });

    if (filter?.createBy) {
      query = query.andWhere('uar.create_by = :createBy', { createBy: filter.createBy });
    }

    const result = await query.getRawMany();
    return result.map(r => r.user_id);
  }


  // เช็คว่า user มี role_id หรือไม่
  async hasRole(userId: number, roleIds: number[]): Promise<boolean> {
    const count = await this.userAllowRoleRepo.count({
      where: roleIds.map(rid => ({ user_id: userId, role_id: rid })),
    });
    return count > 0;
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // เราแน่ใจแล้วว่า user ไม่เป็น null จึงสามารถทำ destructuring ได้อย่างปลอดภัย
    const { password, ...result } = user;
    return result;
  }

  async update(user_id: number, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(user_id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ถ้ามีการอัปเดตรหัสผ่าน ให้เข้ารหัสก่อน
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    updateUserDto.update_date = new Date();

    await this.userRepository.update(user_id, updateUserDto);

    const updatedUser = await this.userRepository.findOneBy({ id: user_id });
    if (!updatedUser) {
      throw new NotFoundException('User not found after update');
    }

    // ใช้ spread operator แยกรหัสผ่านออกจากข้อมูลผู้ใช้
    const { password, ...result } = updatedUser;

    return {
      code: '1',
      message: 'อัปเดตสำเร็จ',
      data: result
    };
  }

  async remove(user_id: number) {
    const user = await this.findOne(user_id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.delete(user_id);

    return {
      code: '1',
      message: 'ลบข้อมูลสำเร็จ'
    };
  }

  async userAccount() {
    const account = await this.userRepository
      .createQueryBuilder('u')
      .leftJoin('customer_for_project', 'cfp', 'cfp.user_id = u.id')
      .leftJoin('customer', 'c', 'c.id = cfp.customer_id')
      .leftJoin('users_allow_role', 'uar', 'uar.user_id = u.id')
      .select([
        'u.id as id',
        'u.username as username',
        `u.firstname || ' ' || u.lastname AS name`,
        'u.email AS user_email',
        'u.phone AS user_phone',

        `array_agg(DISTINCT uar.role_id) as role_ids`,

        // ✅ รวม company ให้เป็น array ของ object
        `
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'company', c.name,
            'company_address', c.address,
            'company_phone', c.telephone
          )) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) as company
        `,
      ])
      .groupBy('u.id')
      .addGroupBy('u.username')
      .addGroupBy('u.firstname')
      .addGroupBy('u.lastname')
      .addGroupBy('u.email')
      .addGroupBy('u.phone')
      .getRawMany();

    return account;
  }

  async getUserAccountById(user_id: number) {
    try {
      const account = await this.userRepository
        .createQueryBuilder('u')
        .select([
          'u.id as id',
          'u.username as username',
          'u.firstname as firstname',
          'u.lastname as lastname',
          'u.email AS user_email',
          'u.phone AS user_phone',
        ])
        .where('u.id = :user_id', { user_id })
        .getRawOne();

      return {
        code: 1,
        status: 'success',
        message: 'pull user account by ID successfully',
        data: account
      }
    } catch (error) {
      console.log('Error fetching user account by ID:', error);
      throw error;
    }
  }
}