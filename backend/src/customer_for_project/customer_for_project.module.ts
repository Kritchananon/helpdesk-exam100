import { Module } from '@nestjs/common';
import { CustomerForProjectService } from './customer_for_project.service';
import { CustomerForProjectController } from './customer_for_project.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerForProject } from './entities/customer-for-project.entity';
import { Project } from '../project/entities/project.entity';
import { Customer } from '../customer/entities/customer.entity';
import { PermissionModule } from '../permission/permission.module';
import { UserModule } from '../users/users.module';
import { Users } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerForProject, 
      Project, 
      Customer,
      Users
    ]),
    PermissionModule,
    UserModule
  ],
  controllers: [CustomerForProjectController],
  providers: [CustomerForProjectService],
})
export class CustomerForProjectModule {}
