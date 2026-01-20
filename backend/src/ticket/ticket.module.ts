import { forwardRef, Module } from '@nestjs/common';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketAttachment } from '../ticket_attachment/entities/ticket_attachment.entity';
import { TicketStatusHistory } from '../ticket_status_history/entities/ticket_status_history.entity';
import { AttachmentService } from '../ticket_attachment/ticket_attachment.service';
import { TicketAttachmentController } from '../ticket_attachment/ticket_attachment.controller';
import { TicketCategory } from '../ticket_categories/entities/ticket_category.entity';
import { Project } from '../project/entities/project.entity';
import { TicketStatus } from '../ticket_status/entities/ticket_status.entity';
import { TicketStatusHistoryModule } from '../ticket_status_history/ticket_status_history.module';
import { TicketStatusService } from '../ticket_status/ticket_status.service';
import { TicketStatusModule } from '../ticket_status/ticket_status.module';
import { Satisfaction } from '../satisfaction/entities/satisfaction.entity';
import { Users } from '../users/entities/user.entity';
import { NotificationModule } from '../notification/notification.module';
import { TicketAssigned } from '../ticket_assigned/entities/ticket_assigned.entity';
import { PermissionModule } from '../permission/permission.module';
import { UserModule } from '../users/users.module';
import { UserAllowRoleModule } from '../user_allow_role/user_allow_role.module';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { TicketCategoriesModule } from '../ticket_categories/ticket_categories.module';
import { TicketPriorityModule } from '../ticket_priority/ticket_priority.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      Users,
      Satisfaction,
      TicketAttachment,
      TicketStatusHistory,
      TicketCategory,
      Project,
      TicketStatus,
      TicketAssigned,
      UserAllowRole,
    ]),
    forwardRef(() => NotificationModule),
    TicketStatusHistoryModule,
    TicketStatusModule,
    NotificationModule,
    PermissionModule,
    UserModule,
    UserAllowRoleModule,
    TicketCategoriesModule,
    TicketPriorityModule,
  ],
  controllers: [TicketController, TicketAttachmentController],
  providers: [
    TicketService,
    AttachmentService,
  ],
  exports: [
    TicketService,
  ]
})
export class TicketModule {}
