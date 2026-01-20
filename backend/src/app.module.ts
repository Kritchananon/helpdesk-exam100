import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './users/users.module';
import { Users } from './users/entities/user.entity';
import { ProjectModule } from './project/project.module';
import { Project } from './project/entities/project.entity';
import { CustomerForProject } from './customer_for_project/entities/customer-for-project.entity';
import { CustomerForProjectModule } from './customer_for_project/customer_for_project.module';
import { Customer } from './customer/entities/customer.entity';
import { CustomerModule } from './customer/customer.module';
import { TicketCategoriesModule } from './ticket_categories/ticket_categories.module';
import { TicketCategoriesLanguageModule } from './ticket_categories_language/ticket_categories_language.module';
import { TicketCategoryLanguage } from './ticket_categories_language/entities/ticket_categories_language.entity';
import { TicketCategory } from './ticket_categories/entities/ticket_category.entity';
import { TicketModule } from './ticket/ticket.module';
import { TicketAttachmentModule } from './ticket_attachment/ticket_attachment.module';
import { Ticket } from './ticket/entities/ticket.entity';
import { TicketAttachment } from './ticket_attachment/entities/ticket_attachment.entity';
import { TicketStatusHistoryModule } from './ticket_status_history/ticket_status_history.module';
import { TicketStatusModule } from './ticket_status/ticket_status.module';
import { TicketStatusLanguageModule } from './ticket_status_language/ticket_status_language.module';
import { TicketStatusHistory } from './ticket_status_history/entities/ticket_status_history.entity';
import { TicketStatus } from './ticket_status/entities/ticket_status.entity';
import { TicketStatusLanguage } from './ticket_status_language/entities/ticket_status_language.entity';
import { TicketAssignedModule } from './ticket_assigned/ticket_assigned.module';
import { UserAllowRoleModule } from './user_allow_role/user_allow_role.module';
import { MasterRoleModule } from './master_role/master_role.module';
import { MasterRole } from './master_role/entities/master_role.entity';
import { UserAllowRole } from './user_allow_role/entities/user_allow_role.entity';
import { TicketAssigned } from './ticket_assigned/entities/ticket_assigned.entity';
import { SatisfactionModule } from './satisfaction/satisfaction.module';
import { Satisfaction } from './satisfaction/entities/satisfaction.entity';
import { Notification } from './notification/entities/notification.entity';
import { NotificationModule } from './notification/notification.module';
import { PermissionModule } from './permission/permission.module';
import { HtmlToPdfModule } from './html-to-pdf/html-to-pdf.module';
import { ExportExcelModule } from './export-excel/export-excel.module';
import { TicketPriorityModule } from './ticket_priority/ticket_priority.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,

      autoLoadEntities: true,
      synchronize: false,
      ssl: false, // ❌ local / postgres ธรรมดา ไม่ต้อง ssl
    }),
  AuthModule,
  UserModule,
  ProjectModule,
  CustomerForProjectModule,
  CustomerModule,
  TicketCategoriesModule,
  TicketCategoriesLanguageModule,
  TicketModule,
  TicketStatusHistoryModule,
  TicketStatusModule,
  TicketStatusLanguageModule,
  UserAllowRoleModule,
  MasterRoleModule,
  TicketAssignedModule,
  SatisfactionModule,
  NotificationModule,
  PermissionModule,
  HtmlToPdfModule,
  ExportExcelModule,
  TicketPriorityModule
  ],
  controllers: [AppController],
  providers: [
    // {
    //   provide: APP_GUARD,
    //   useClass: PermissionGuard,
    // },
    AppService,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req, res, next) => {
        res.header('Access-Control-Allow-Origin', 'https://helpdesk-support-44934.web.app', 'http://localhost:4200');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,PATCH,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
        next();
      })
      .forRoutes('*');
  }
}
