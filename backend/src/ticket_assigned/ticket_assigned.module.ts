import { Module } from '@nestjs/common';
import { TicketAssignedService } from './ticket_assigned.service';
import { TicketAssignedController } from './ticket_assigned.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { TicketAssigned } from './entities/ticket_assigned.entity';
import { Users } from '../users/entities/user.entity';
import { NotificationModule } from '../notification/notification.module';
import { PermissionModule } from '../permission/permission.module';
import { UserAllowRoleModule } from '../user_allow_role/user_allow_role.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketAssigned,
      Users,
      UserAllowRole
    ]),
    NotificationModule,
    PermissionModule,
    UserAllowRoleModule,
  ],
  controllers: [TicketAssignedController],
  providers: [
    TicketAssignedService
  ],
})
export class TicketAssignedModule {}
