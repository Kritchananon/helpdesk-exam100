import { forwardRef, Module } from '@nestjs/common';
import { UserAllowRoleService } from './user_allow_role.service';
import { UserAllowRoleController } from './user_allow_role.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAllowRole } from './entities/user_allow_role.entity';
import { MasterRoleModule } from '../master_role/master_role.module';
import { UserModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserAllowRole
    ]),
    forwardRef(() => UserModule),
    MasterRoleModule
  ],
  controllers: [UserAllowRoleController],
  providers: [UserAllowRoleService],
  exports: [UserAllowRoleService, TypeOrmModule]
})
export class UserAllowRoleModule {}
