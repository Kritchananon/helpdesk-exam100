import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TicketCategory } from './entities/ticket_category.entity';
import { TicketCategoryLanguage } from '../ticket_categories_language/entities/ticket_categories_language.entity';
import { CreateCategoryDto } from './dto/create-ticket_category.dto';
import { UpdateTicketCategoriesLanguageDto } from '../ticket_categories_language/dto/update-ticket_categories_language.dto';

@Injectable()
export class TicketCategoryService {
  constructor(
    @InjectRepository(TicketCategory)
    private readonly categoryRepo: Repository<TicketCategory>,

    @InjectRepository(TicketCategoryLanguage)
    private readonly categoryLangRepo: Repository<TicketCategoryLanguage>,

    private readonly dataSource: DataSource,
  ) { }

  async getCategoriesDDL(languageId?: string) {
    try {
      console.log('Received languageId:', languageId); // Debug log

      // สร้าง query ใหม่โดยเริ่มจาก language table
      let queryBuilder;

      if (languageId && languageId.trim() !== '') {
        console.log('Filtering by language:', languageId);
        queryBuilder = this.categoryLangRepo
          .createQueryBuilder('tcl')
          .innerJoin('tcl.category', 'tc')
          .where('tc.isenabled = :enabled', { enabled: true })
          .andWhere('tcl.language_id = :languageId', { languageId: languageId.trim() });
      } else {
        queryBuilder = this.categoryLangRepo
          .createQueryBuilder('tcl')
          .innerJoin('tcl.category', 'tc')
          .where('tc.isenabled = :enabled', { enabled: true });
      }

      const results = await queryBuilder
        .select([
          'tc.id as tc_id',
          'tcl.name as tcl_name',
          'tcl.language_id as tcl_language_id'
        ])
        .getRawMany();

      console.log('Query results:', results); // Debug log

      return {
        code: 1,
        message: 'Success',
        data: results.map(row => ({
          id: row.tc_id,
          name: row.tcl_name,
          language_id: row.tcl_language_id,
        })),
      };
    } catch (error) {
      console.error('Error in getCategoriesDDL:', error);
      return {
        code: 0,
        message: 'Failed to fetch categories',
        error: error.message,
      };
    }
  }

  async createCategory(createCategoryDto: CreateCategoryDto) {
    try {
      console.log('=== Starting createCategory ===');
      console.log('Input data:', createCategoryDto);

      console.log('CategoryLangRepo metadata:', this.categoryLangRepo.metadata.tableName);
      console.log('CategoryLangRepo target:', this.categoryLangRepo.target);

      // ตรวจสอบความซ้ำซ้อนของชื่อ category ในแต่ละภาษา
      console.log('Starting validation...');

      for (let i = 0; i < createCategoryDto.languages.length; i++) {
        const lang = createCategoryDto.languages[i];
        console.log(`Checking language ${i + 1}:`, lang);

        const existingCategory = await this.categoryLangRepo
          .createQueryBuilder('tcl')
          .innerJoin('tcl.category', 'tc')
          .where('LOWER(tcl.name) = LOWER(:name)', { name: lang.name.trim() })
          .andWhere('tcl.language_id = :languageId', { languageId: lang.language_id })
          .andWhere('tc.isenabled = :enabled', { enabled: true })
          .getOne();

        console.log(`Existing category check ${i + 1}:`, existingCategory);

        if (existingCategory) {
          console.log('Found existing category, returning error');
          return {
            code: 0,
            message: `Category name "${lang.name}" already exists for language "${lang.language_id}"`,
            data: {
              existing_category: {
                id: existingCategory.id,
                name: existingCategory.name,
                language_id: existingCategory.language_id,
              },
            },
          };
        }
      }

      console.log('No existing categories found, continuing...');

      // ตรวจสอบซ้ำในชุดข้อมูลที่ส่งมา
      console.log('Checking duplicate language_ids...');
      const languageIds = createCategoryDto.languages.map(lang => lang.language_id);
      const uniqueLanguageIds = [...new Set(languageIds)];
      console.log('Language IDs:', languageIds);
      console.log('Unique Language IDs:', uniqueLanguageIds);

      if (languageIds.length !== uniqueLanguageIds.length) {
        console.log('Found duplicate language_ids');
        return {
          code: 0,
          message: 'Duplicate language_id found in the request',
        };
      }

      // ตรวจสอบชื่อซ้ำในชุดข้อมูลเดียวกัน
      console.log('Checking duplicate names...');
      const names = createCategoryDto.languages.map(lang =>
        `${lang.language_id}:${lang.name.toLowerCase().trim()}`
      );
      const uniqueNames = [...new Set(names)];
      console.log('Names:', names);
      console.log('Unique Names:', uniqueNames);

      if (names.length !== uniqueNames.length) {
        console.log('Found duplicate names');
        return {
          code: 0,
          message: 'Duplicate category name found in the same language within the request',
        };
      }

      console.log('All validations passed, creating category...');

      // สร้าง category หลัก
      console.log('Creating main category...');
      const category = this.categoryRepo.create({
        create_by: createCategoryDto.create_by,
        create_date: new Date(),
        isenabled: true,
      });

      console.log('Category object created:', category);

      const savedCategory = await this.categoryRepo.save(category);
      console.log('Saved main category:', savedCategory);

      // สร้าง language records
      console.log('Creating language records...');
      const savedLanguages: TicketCategoryLanguage[] = [];

      for (let i = 0; i < createCategoryDto.languages.length; i++) {
        const lang = createCategoryDto.languages[i];
        console.log(`Processing language ${i + 1}:`, lang);

        try {
          const categoryLang = this.categoryLangRepo.create({
            category_id: savedCategory.id,
            language_id: lang.language_id.trim(),
            name: lang.name.trim(),
          });

          console.log(`Created categoryLang object ${i + 1}:`, categoryLang);

          const savedLang = await this.categoryLangRepo.save(categoryLang);
          console.log(`Saved language record ${i + 1}:`, savedLang);

          savedLanguages.push(savedLang);

        } catch (langError) {
          console.error(`Error processing language ${i + 1}:`, langError);
          throw langError;
        }
      }

      console.log('All language records processed:', savedLanguages);

      return {
        code: 1,
        message: 'Category created successfully',
        data: {
          id: savedCategory.id,
          create_by: savedCategory.create_by,
          create_date: savedCategory.create_date,
          isenabled: savedCategory.isenabled,
          languages: savedLanguages.map(lang => ({
            id: lang.id,
            language_id: lang.language_id,
            name: lang.name,
            category_id: lang.category_id,
          })),
        },
      };

    } catch (error) {
      console.error('=== Error in createCategory ===');
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      return {
        code: 0,
        message: 'Failed to create category',
        error: error.message,
      };
    }
  }

  async findAll() {
    const rows = await this.categoryRepo
      .createQueryBuilder('tc')
      .leftJoin('ticket_categories_language', 'tcl', 'tcl.category_id = tc.id')
      .leftJoin('ticket', 't', 't.categories_id = tc.id')
      .where('tc.isenabled = :isenabled', { isenabled: true })
      .andWhere('tcl.name is not null')
      .select([
        'tc.id AS category_id',
        'tc.isenabled AS isenabled',
        'tcl.language_id AS language_id',
        'tcl.name AS language_name',
        'COUNT(t.id) AS usage_count',
      ])
      .groupBy('tc.id')
      .addGroupBy('tcl.language_id')
      .addGroupBy('tcl.name')

      .getRawMany();

    // รวม languages เป็น array
    const categoriesMap = new Map<number, any>();
    rows.forEach(row => {
      if (!categoriesMap.has(row.category_id)) {
        categoriesMap.set(row.category_id, {
          category_id: row.category_id,
          isenabled: row.isenabled,
          usage_count: parseInt(row.usage_count, 10) || 0,
          languages: [],
        });
      }
      if (row.language_id) {
        categoriesMap.get(row.category_id).languages.push({
          language_id: row.language_id,
          language_name: row.language_name,
        });
      }
    });

    return {
      code: 1,
      message: 'Success',
      data: Array.from(categoriesMap.values()),
    };
  }


  async findOne(id: number) {
    const category = await this.categoryRepo.findOne({
      where: { id, isenabled: true },
      relations: ['languages'],
    });

    if (!category) {
      return {
        code: 0,
        message: 'Category not found',
      };
    }

    return {
      code: 1,
      message: 'Success',
      data: category,
    };
  }

  // Method สำหรับตรวจสอบว่าชื่อ category ซ้ำหรือไม่
  async checkCategoryNameExists(name: string, languageId: string, excludeCategoryId?: number) {
    const query = this.categoryLangRepo
      .createQueryBuilder('tcl')
      .innerJoin('tcl.category', 'tc')
      .where('LOWER(tcl.name) = LOWER(:name)', { name: name.trim() })
      .andWhere('tcl.language_id = :languageId', { languageId })
      .andWhere('tc.isenabled = :enabled', { enabled: true });

    // ถ้ามี excludeCategoryId แสดงว่าเป็นการ update ให้ไม่เช็คกับตัวเอง
    if (excludeCategoryId) {
      query.andWhere('tc.id != :excludeId', { excludeId: excludeCategoryId });
    }

    const existing = await query.getOne();
    return !!existing;
  }

  // Method สำหรับ validate ข้อมูลก่อนสร้าง/อัพเดต
  async validateCategoryData(languages: { language_id: string; name: string }[]): Promise<string[]> {
    const errors: string[] = [];

    const languageIds = new Set<string>();
    const names = new Set<string>();

    for (const lang of languages) {
      // เช็ค duplicate language_id ใน request
      if (languageIds.has(lang.language_id)) {
        errors.push('Duplicate language_id found in the request');
      } else {
        languageIds.add(lang.language_id);
      }

      // เช็ค duplicate name ใน request (ข้ามภาษา)
      if (names.has(lang.name)) {
        errors.push('Duplicate category name found in the request');
      } else {
        names.add(lang.name);
      }

      // เช็คชื่อซ้ำกับ DB
      const existingCategory = await this.categoryLangRepo
        .createQueryBuilder('tcl')
        .innerJoin('tcl.category', 'tc')
        .where('tcl.name = :name', { name: lang.name })
        .andWhere('tcl.language_id = :languageId', { languageId: lang.language_id })
        .getOne();

      if (existingCategory) {
        errors.push(`Category name "${lang.name}" already exists for language "${lang.language_id}"`);
      }
    }

    return errors;
  }


  // Debug method เพื่อตรวจสอบข้อมูล
  async debugCategoryData() {
    try {
      const categories = await this.categoryRepo.find();
      const categoryLanguages = await this.categoryLangRepo.find();

      return {
        code: 1,
        message: 'Debug data retrieved',
        data: {
          categories: categories,
          categoryLanguages: categoryLanguages,
          categoriesCount: categories.length,
          languagesCount: categoryLanguages.length,
        },
      };
    } catch (error) {
      return {
        code: 0,
        message: 'Failed to retrieve debug data',
        error: error.message,
      };
    }
  }

  async updateCategory(id: number, updateDto: any) {
    const category = await this.categoryRepo.findOneBy({ id });
    if (!category) {
      return { code: 0, status: false, message: 'ไม่พบหมวดหมู่', data: null };
    }

    try {
      await this.categoryRepo.save(category);

      // ✅ อัพเดตหลายภาษา
      if (updateDto.languages && Array.isArray(updateDto.languages)) {
        for (const lang of updateDto.languages) {
          let langRecord = await this.categoryLangRepo.findOneBy({
            category_id: id,
            language_id: lang.language_id,
          });

          if (langRecord) {
            langRecord.name = lang.name;
            await this.categoryLangRepo.save(langRecord);
          } else {
            await this.categoryLangRepo.save({
              category_id: id,
              language_id: lang.language_id,
              name: lang.name,
            });
          }
        }
      }

      // ✅ อัพเดตภาษาเดียว
      else if (updateDto.language_id && updateDto.name) {
        let langRecord = await this.categoryLangRepo.findOneBy({
          category_id: id,
          language_id: updateDto.language_id,
        });

        if (langRecord) {
          langRecord.name = updateDto.name;
          await this.categoryLangRepo.save(langRecord);
        } else {
          await this.categoryLangRepo.save({
            category_id: id,
            language_id: updateDto.language_id,
            name: updateDto.name,
          });
        }
      }

      return { code: 1, status: true, message: 'อัพเดตหมวดหมู่สำเร็จ', data: category };
    } catch (error) {
      console.error('Error updating category:', error);
      return { code: 0, status: false, message: 'เกิดข้อผิดพลาดในการอัพเดตหมวดหมู่', data: null };
    }
  }

  async deleteCategories(category_id: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ลบ ticket_categories_language ก่อน
      await queryRunner.manager.delete(TicketCategoryLanguage, { category_id });

      // ลบ ticket_categories
      const result = await queryRunner.manager.delete(TicketCategory, { id: category_id });
      if (result.affected === 0) throw new Error('ไม่พบหมวดหมู่');

      await queryRunner.commitTransaction();

      return { code: 1, status: true, message: 'ลบหมวดหมู่สำเร็จ' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error deleting category:', error);
      return { code: 0, status: false, message: 'เกิดข้อผิดพลาดในการลบหมวดหมู่' };
    } finally {
      await queryRunner.release();
    }
  }
}