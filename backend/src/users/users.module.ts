import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './entities/user.entity';
import { UserService } from './users.service';
import { UserController } from './users.controller';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { PermissionModule } from '../permission/permission.module';
import { UserAllowRoleModule } from '../user_allow_role/user_allow_role.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Users, UserAllowRole
    ]),
    forwardRef(() => UserAllowRoleModule),
    PermissionModule,
  ],
  providers: [UserService],
  exports: [UserService],
  controllers: [UserController],
})
export class UserModule {}
