import { Module } from '@nestjs/common';
import { MasterRoleService } from './master_role.service';
import { MasterRoleController } from './master_role.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MasterRole } from './entities/master_role.entity';
import { PermissionModule } from '../permission/permission.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MasterRole
    ]),
    PermissionModule
  ],
  controllers: [MasterRoleController],
  providers: [MasterRoleService],
  exports: [TypeOrmModule]
})
export class MasterRoleModule {}
