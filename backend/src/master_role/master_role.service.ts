import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateMasterRoleDto } from './dto/create-master_role.dto';
import { UpdateMasterRoleDto } from './dto/update-master_role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MasterRole } from './entities/master_role.entity';
import { Repository } from 'typeorm';

@Injectable()
export class MasterRoleService {
  constructor(
    @InjectRepository(MasterRole)
    private masterRoleRepo: Repository<MasterRole>,
  ){}
  async create(createMasterRoleDto: CreateMasterRoleDto): Promise<MasterRole> {
    const existingRole = await this.masterRoleRepo.findOne({
      where: { role_name: createMasterRoleDto.role_name }
    });

    if (existingRole) {
      throw new ConflictException('Role name already exists');
    }

    const role = this.masterRoleRepo.create(createMasterRoleDto);
    return await this.masterRoleRepo.save(role);
  }

  async findAll(): Promise<MasterRole[]> {
    return await this.masterRoleRepo.find({
      relations: ['userAllowRoles']
    });
  }

  async findOne(id: number): Promise<MasterRole> {
    const role = await this.masterRoleRepo.findOne({ 
      where: { id },
      relations: ['userAllowRoles']
    });
    
    if (!role) {
      throw new NotFoundException(`Master role with ID ${id} not found`);
    }
    
    return role;
  }

  async update(id: number, updateMasterRoleDto: UpdateMasterRoleDto): Promise<MasterRole> {
    const role = await this.findOne(id);
    
    if (updateMasterRoleDto.role_name) {
      const existingRole = await this.masterRoleRepo.findOne({
        where: { role_name: updateMasterRoleDto.role_name }
      });
      
      if (existingRole && existingRole.id !== id) {
        throw new ConflictException('Role name already exists');
      }
    }

    Object.assign(role, updateMasterRoleDto);
    return await this.masterRoleRepo.save(role);
  }

  async remove(id: number): Promise<void> {
    const role = await this.masterRoleRepo.findOne({
      where: { id },
      relations: ['userAllowRoles']
    });

    if (!role) {
      throw new NotFoundException(`Master role with ID ${id} not found`);
    }

    if (role.userAllowRole && role.userAllowRole.length > 0) {
      throw new ConflictException('Cannot delete role that is assigned to users');
    }

    await this.masterRoleRepo.remove(role);
  }

  async findByName(role_name: string): Promise<MasterRole> {
    const role = await this.masterRoleRepo.findOne({
      where: { role_name }
    });

    if (!role) {
      throw new NotFoundException(`Master role with name ${role_name} not found`);
    }

    return role;
  }

  async getAllRoles(): Promise<MasterRole[]> {
    return this.masterRoleRepo.find({ order: { id: 'ASC' } });
  }

  async getRoleById(roleId: number): Promise<MasterRole | null> {
    return this.masterRoleRepo.findOne({ where: { id: roleId } });
  }
}
