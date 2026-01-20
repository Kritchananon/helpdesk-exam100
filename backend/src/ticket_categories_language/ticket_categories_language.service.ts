import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTicketCategoriesLanguageDto } from './dto/create-ticket_categories_language.dto';
import { UpdateTicketCategoriesLanguageDto } from './dto/update-ticket_categories_language.dto';
import { TicketCategoryLanguage } from './entities/ticket_categories_language.entity';

@Injectable()
export class TicketCategoriesLanguageService {
  constructor(
    @InjectRepository(TicketCategoryLanguage)
    private readonly categoryLangRepo: Repository<TicketCategoryLanguage>,
  ) {}

  async create(createTicketCategoriesLanguageDto: CreateTicketCategoriesLanguageDto) {
    const categoryLang = this.categoryLangRepo.create(createTicketCategoriesLanguageDto);
    const saved = await this.categoryLangRepo.save(categoryLang);
    
    return {
      code: 1,
      message: 'Category language created successfully',
      data: saved,
    };
  }

  async findAll() {
    const results = await this.categoryLangRepo.find({
      relations: ['category'],
    });
    
    return {
      code: 1,
      message: 'Success',
      data: results,
    };
  }

  async findOne(id: number) {
    const result = await this.categoryLangRepo.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!result) {
      return {
        code: 0,
        message: 'Category language not found',
      };
    }
    
    return {
      code: 1,
      message: 'Success',
      data: result,
    };
  }

  async update(id: number, updateTicketCategoriesLanguageDto: UpdateTicketCategoriesLanguageDto) {
    const result = await this.categoryLangRepo.update(id, updateTicketCategoriesLanguageDto);
    
    if (result.affected === 0) {
      return {
        code: 0,
        message: 'Category language not found or no changes made',
      };
    }

    const updated = await this.findOne(id);
    return {
      code: 1,
      message: 'Category language updated successfully',
      data: updated.data,
    };
  }

  async remove(id: number) {
    const result = await this.categoryLangRepo.delete(id);
    
    if (result.affected === 0) {
      return {
        code: 0,
        message: 'Category language not found',
      };
    }

    return {
      code: 1,
      message: 'Category language deleted successfully',
    };
  }
}
