import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { CreateUserAllowRoleDto } from './dto/create-user_allow_role.dto';
import { UpdateUserAllowRoleDto } from './dto/update-user_allow_role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { UserAllowRole } from './entities/user_allow_role.entity';
import { Repository, In } from 'typeorm';
import { MasterRole } from '../master_role/entities/master_role.entity';
import { Users } from '../users/entities/user.entity';

@Injectable()
export class UserAllowRoleService {
  constructor(
    @InjectRepository(UserAllowRole)
    private userAllowRepo: Repository<UserAllowRole>,

    @InjectRepository(MasterRole)
    private masterRepo: Repository<MasterRole>,
  ) {}

  async create(createUserAllowRoleDto: CreateUserAllowRoleDto): Promise<UserAllowRole[]> {
    const { user_id, role_id } = createUserAllowRoleDto;
    
    // Check if all roles exist
    const roles = await this.masterRepo.findBy({ id: In(role_id) });
    if (roles.length !== role_id.length) {
      throw new NotFoundException('One or more roles not found');
    }

    // Check existing assignments
    const existingRoles = await this.userAllowRepo.find({
      where: { user_id },
    });
    
    const existingRoleIds = existingRoles.map(ur => ur.role_id);
    const newRoleIds = role_id.filter(roleId => !existingRoleIds.includes(roleId));

    if (newRoleIds.length === 0) {
      throw new ConflictException('All roles are already assigned to this user');
    }

    // Create new assignments
    const newAssignments = newRoleIds.map(role_id_item => 
      this.userAllowRepo.create({ user_id, role_id: role_id_item })
    );

    await this.userAllowRepo.save(newAssignments);
    
    return await this.findByUserId(user_id);
  }

  async findAll(): Promise<UserAllowRole[]> {
    return await this.userAllowRepo.find({
      relations: ['role'],
    });
  }

  async findByUserId(user_id: number): Promise<UserAllowRole[]> {
    return await this.userAllowRepo.find({
      where: { user_id },
      relations: ['role'],
    });
  }

  async findByRoleId(role_id: number): Promise<UserAllowRole[]> {
    // Check if role exists
    const role = await this.masterRepo.findOne({ where: { id: role_id } });
    if (!role) {
      throw new NotFoundException(`Role with ID ${role_id} not found`);
    }

    return await this.userAllowRepo.find({
      where: { role_id },
      relations: ['role'],
    });
  }

  async findOne(user_id: number, role_id: number): Promise<UserAllowRole> {
    const userRole = await this.userAllowRepo.findOne({
      where: { user_id, role_id },
      relations: ['role'],
    });

    if (!userRole) {
      throw new NotFoundException(`User role assignment not found for user_id: ${user_id}, role_id: ${role_id}`);
    }

    return userRole;
  }

  async remove(user_id: number, role_id: number): Promise<void> {
    const userRole = await this.userAllowRepo.findOne({
      where: { user_id, role_id },
    });

    if (!userRole) {
      throw new NotFoundException(`User role assignment not found for user_id: ${user_id}, role_id: ${role_id}`);
    }

    await this.userAllowRepo.remove(userRole);
  }

  async removeMultiple(user_id: number, role_ids: number[]): Promise<void> {
    const userRoles = await this.userAllowRepo.find({
      where: { 
        user_id, 
        role_id: In(role_ids) 
      },
    });

    if (userRoles.length === 0) {
      throw new NotFoundException(`No role assignments found for user_id: ${user_id} with given role_ids`);
    }

    await this.userAllowRepo.remove(userRoles);
  }

  async removeAllByUserId(user_id: number): Promise<void> {
    await this.userAllowRepo.delete({ user_id });
  }

  async removeAllByRoleId(role_id: number): Promise<void> {
    await this.userAllowRepo.delete({ role_id });
  }

  async userHasRole(user_id: number, role_id: number): Promise<boolean> {
    const userRole = await this.userAllowRepo.findOne({
      where: { user_id, role_id },
    });
    return !!userRole;
  }

  async userHasAnyRole(user_id: number, role_ids: number[]): Promise<boolean> {
    const count = await this.userAllowRepo.count({
      where: { user_id, role_id: In(role_ids) },
    });
    return count > 0;
  }

  async userHasAllRoles(user_id: number, role_ids: number[]): Promise<boolean> {
    const count = await this.userAllowRepo.count({
      where: { user_id, role_id: In(role_ids) },
    });
    return count === role_ids.length;
  }

  async getUserRoleNames(user_id: number): Promise<string[]> {
    const userRoles = await this.userAllowRepo.find({
      where: { user_id },
      relations: ['role'],
    });

    return userRoles.map(ur => ur.role.role_name);
  }

  async replaceUserRoles(user_id: number, role_ids: number[]): Promise<UserAllowRole[]> {
    // Remove all existing roles
    await this.removeAllByUserId(user_id);
    
    // Add new roles
    const createDto: CreateUserAllowRoleDto = { user_id, role_id: role_ids };
    return await this.create(createDto);
  }

  async getUsersByRole(roleId: number): Promise<Users[]> {
    const userAllowRoles = await this.userAllowRepo.find({
      where: { role_id: roleId },
      relations: ['user'], // ต้องมี relation ใน entity UserAllowRole ชื่อ 'user'
    });

    return userAllowRoles.map(uar => uar.user); // map ให้ได้ Users[]
  }

}
