import { forwardRef, Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Users } from '../users/entities/user.entity';
import { MailerModule } from '@nestjs-modules/mailer';
import { TicketStatus } from '../ticket_status/entities/ticket_status.entity';
import { TicketAssigned } from '../ticket_assigned/entities/ticket_assigned.entity';
import { UserAllowRole } from '../user_allow_role/entities/user_allow_role.entity';
import { ConfigModule } from '@nestjs/config';
import { TicketModule } from '../ticket/ticket.module';
import { TicketCategory } from '../ticket_categories/entities/ticket_category.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forFeature([
      Notification,
      Users,
      Ticket,
      TicketStatus,
      TicketAssigned,
      UserAllowRole,
      TicketCategory,
    ]),
    MailerModule.forRoot({
      transport: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
      },
      defaults: {
        from: ' "No Reply" <noreply@example.com>',
      },
    }),
    forwardRef(() => TicketModule),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
  ],
  exports: [
    NotificationService,
  ],
})
export class NotificationModule {}
