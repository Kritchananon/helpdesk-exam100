import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketCategoriesLanguageService } from './ticket_categories_language.service';
import { TicketCategoriesLanguageController } from './ticket_categories_language.controller';
import { TicketCategoryLanguage } from './entities/ticket_categories_language.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketCategoryLanguage
    ])
  ],
  controllers: [TicketCategoriesLanguageController],
  providers: [TicketCategoriesLanguageService],
  exports: [TicketCategoriesLanguageService],
})
export class TicketCategoriesLanguageModule {}
