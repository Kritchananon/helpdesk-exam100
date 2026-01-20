import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { MasterRole } from '../master_role/entities/master_role.entity';
import { Users } from '../users/entities/user.entity';
import { PermissionService } from './permission.service';
import { PermissionGuard } from './permission.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserAllowRole,
      MasterRole,
      Users,
    ])
  ],
  providers: [PermissionService, PermissionGuard],
  exports: [PermissionService, PermissionGuard],
})
export class PermissionModule {}