import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TicketCategoryService } from './ticket_categories.service';
import { TicketCategory } from './entities/ticket_category.entity';
import { TicketCategoryLanguage } from '../ticket_categories_language/entities/ticket_categories_language.entity';
import { CreateCategoryDto } from './dto/create-ticket_category.dto';

describe('TicketCategoryService', () => {
  let service: TicketCategoryService;
  let categoryRepo: Repository<TicketCategory>;
  let categoryLangRepo: Repository<TicketCategoryLanguage>;
  let dataSource: DataSource;

  const mockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(),
    getOne: jest.fn(),
  };

  const mockCategoryRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    metadata: { tableName: 'mock_category' }, // <--- แก้ไข: เพิ่มบรรทัดนี้
    target: 'mock_category_target', // <--- แก้ไข: เพิ่มบรรทัดนี้
  };

  const mockCategoryLangRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    metadata: { tableName: 'mock_category_lang' }, // <--- แก้ไข: เพิ่มบรรทัดนี้
    target: 'mock_category_lang_target', // <--- แก้ไข: เพิ่มบรรทัดนี้
  };

  // Mock สำหรับ QueryRunner (ใช้ใน delete)
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      delete: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketCategoryService,
        {
          provide: getRepositoryToken(TicketCategory),
          useValue: mockCategoryRepo,
        },
        {
          provide: getRepositoryToken(TicketCategoryLanguage),
          useValue: mockCategoryLangRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<TicketCategoryService>(TicketCategoryService);
    categoryRepo = module.get<Repository<TicketCategory>>(getRepositoryToken(TicketCategory));
    categoryLangRepo = module.get<Repository<TicketCategoryLanguage>>(getRepositoryToken(TicketCategoryLanguage));
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCategoriesDDL', () => {
    it('should return categories with specific language filter', async () => {
      const mockResults = [
        { tc_id: 1, tcl_name: 'Category 1', tcl_language_id: 'en' },
        { tc_id: 2, tcl_name: 'Category 2', tcl_language_id: 'en' },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockResults);

      const result = await service.getCategoriesDDL('en');

      expect(mockCategoryLangRepo.createQueryBuilder).toHaveBeenCalledWith('tcl');
      expect(mockQueryBuilder.innerJoin).toHaveBeenCalledWith('tcl.category', 'tc');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('tc.isenabled = :enabled', { enabled: true });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('tcl.language_id = :languageId', { languageId: 'en' });
      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: [
          { id: 1, name: 'Category 1', language_id: 'en' },
          { id: 2, name: 'Category 2', language_id: 'en' },
        ],
      });
    });

    it('should return all categories when no language filter provided', async () => {
      const mockResults = [
        { tc_id: 1, tcl_name: 'Category 1', tcl_language_id: 'en' },
        { tc_id: 2, tcl_name: 'Category 2', tcl_language_id: 'th' },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockResults);

      const result = await service.getCategoriesDDL();

      expect(mockCategoryLangRepo.createQueryBuilder).toHaveBeenCalledWith('tcl');
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalledWith('tcl.language_id = :languageId', expect.anything());
      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: [
          { id: 1, name: 'Category 1', language_id: 'en' },
          { id: 2, name: 'Category 2', language_id: 'th' },
        ],
      });
    });

    it('should handle empty language filter', async () => {
      const mockResults = [];
      mockQueryBuilder.getRawMany.mockResolvedValue(mockResults);

      const result = await service.getCategoriesDDL('');

      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: [],
      });
    });

    it('should handle database errors', async () => {
      const errorMessage = 'Database connection error';
      mockQueryBuilder.getRawMany.mockRejectedValue(new Error(errorMessage));

      const result = await service.getCategoriesDDL('en');

      expect(result).toEqual({
        code: 0,
        message: 'Failed to fetch categories',
        error: errorMessage,
      });
    });
  });

  describe('createCategory', () => {
    const createCategoryDto: CreateCategoryDto = {
      create_by: 1,
      languages: [
        { language_id: 'en', name: 'New Category' },
        { language_id: 'th', name: 'หมวดหมู่ใหม่' },
      ],
    };

    it('should create category successfully', async () => {
      const mockCategory = {
        id: 1,
        create_by: 1,
        create_date: new Date(),
        isenabled: true,
      };

      const mockLanguages = [
        { id: 1, language_id: 'en', name: 'New Category' },
        { id: 1, language_id: 'th', name: 'หมวดหมู่ใหม่' },
      ];

      // Mock no existing categories
      mockQueryBuilder.getOne.mockResolvedValue(null);

      // Mock category creation
      mockCategoryRepo.create.mockReturnValue(mockCategory);
      mockCategoryRepo.save.mockResolvedValue(mockCategory);

      // Mock language creation
      mockCategoryLangRepo.create.mockReturnValueOnce(mockLanguages[0]).mockReturnValueOnce(mockLanguages[1]);
      mockCategoryLangRepo.save.mockResolvedValueOnce(mockLanguages[0]).mockResolvedValueOnce(mockLanguages[1]);

      const result = await service.createCategory(createCategoryDto);

      expect(mockCategoryRepo.create).toHaveBeenCalledWith({
        create_by: 1,
        create_date: expect.any(Date),
        isenabled: true,
      });
      expect(mockCategoryRepo.save).toHaveBeenCalledWith(mockCategory);
      expect(mockCategoryLangRepo.create).toHaveBeenCalledTimes(2);
      expect(mockCategoryLangRepo.save).toHaveBeenCalledTimes(2);
      expect(result.code).toBe(1);
      expect(result.message).toBe('Category created successfully');
    });

    it('should return error when category name already exists', async () => {
      const existingCategory = {
        id: 1,
        name: 'New Category',
        language_id: 'en',
      };

      mockQueryBuilder.getOne.mockResolvedValueOnce(existingCategory);

      const result = await service.createCategory(createCategoryDto);

      expect(result).toEqual({
        code: 0,
        message: 'Category name "New Category" already exists for language "en"',
        data: {
          existing_category: {
            id: 1,
            name: 'New Category',
            language_id: 'en',
          },
        },
      });
    });

    it('should return error when duplicate language_id in request', async () => {
      const duplicateLanguageDto: CreateCategoryDto = {
        create_by: 1,
        languages: [
          { language_id: 'en', name: 'Category 1' },
          { language_id: 'en', name: 'Category 2' },
        ],
      };

      mockQueryBuilder.getOne.mockResolvedValue(null);

      const result = await service.createCategory(duplicateLanguageDto);

      expect(result).toEqual({
        code: 0,
        message: 'Duplicate language_id found in the request',
      });
    });

    it('should create category with multiple languages successfully', async () => {
      const multiLanguageDto: CreateCategoryDto = {
        create_by: 1,
        languages: [
          { language_id: 'en', name: 'New Category' },
          { language_id: 'th', name: 'หมวดหมู่ใหม่' },
          { language_id: 'ja', name: '新しいカテゴリ' },
        ],
      };

      const mockCategory = {
        id: 1,
        create_by: 1,
        create_date: new Date(),
        isenabled: true,
      };

      const mockLanguages = [
        { id: 1, language_id: 'en', name: 'New Category' },
        { id: 1, language_id: 'th', name: 'หมวดหมู่ใหม่' },
        { id: 1, language_id: 'ja', name: '新しいカテゴリ' },
      ];

      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockCategoryRepo.create.mockReturnValue(mockCategory);
      mockCategoryRepo.save.mockResolvedValue(mockCategory);

      mockCategoryLangRepo.create
        .mockReturnValueOnce(mockLanguages[0])
        .mockReturnValueOnce(mockLanguages[1])
        .mockReturnValueOnce(mockLanguages[2]);

      mockCategoryLangRepo.save
        .mockResolvedValueOnce(mockLanguages[0])
        .mockResolvedValueOnce(mockLanguages[1])
        .mockResolvedValueOnce(mockLanguages[2]);

      const result = await service.createCategory(multiLanguageDto);

      expect(result.code).toBe(1);
      expect(result.message).toBe('Category created successfully');
      expect(result.data?.languages).toHaveLength(3);
      expect(mockCategoryLangRepo.create).toHaveBeenCalledTimes(3);
      expect(mockCategoryLangRepo.save).toHaveBeenCalledTimes(3);
    });

    it('should handle database errors during creation', async () => {
      const errorMessage = 'Database error';
      mockQueryBuilder.getOne.mockResolvedValue(null);
      mockCategoryRepo.create.mockReturnValue({});
      mockCategoryRepo.save.mockRejectedValue(new Error(errorMessage));

      const result = await service.createCategory(createCategoryDto);

      expect(result).toEqual({
        code: 0,
        message: 'Failed to create category',
        error: errorMessage,
      });
    });
  });

  describe('findAll', () => {
    it('should return categories with usage count and mapped languages', async () => {
      const mockRawResults = [
        {
          category_id: 1,
          isenabled: true,
          language_id: 'en',
          language_name: 'Category 1 EN',
          usage_count: '2',
        },
        {
          category_id: 1,
          isenabled: true,
          language_id: 'th',
          language_name: 'หมวดหมู่ 1',
          usage_count: '2', // Usage count is grouped by category_id
        },
        {
          category_id: 2,
          isenabled: true,
          language_id: 'en',
          language_name: 'Category 2 EN',
          usage_count: '0',
        },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(mockRawResults);

      const result = await service.findAll();

      expect(mockCategoryRepo.createQueryBuilder).toHaveBeenCalledWith('tc');
      expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith('ticket_categories_language', 'tcl', 'tcl.category_id = tc.id');
      expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith('ticket', 't', 't.categories_id = tc.id');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('tc.isenabled = :isenabled', { isenabled: true });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('tcl.name is not null');
      expect(mockQueryBuilder.groupBy).toHaveBeenCalledWith('tc.id');
      expect(mockQueryBuilder.addGroupBy).toHaveBeenCalledWith('tcl.language_id');
      expect(mockQueryBuilder.addGroupBy).toHaveBeenCalledWith('tcl.name');
      expect(mockQueryBuilder.getRawMany).toHaveBeenCalled();

      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: [
          {
            category_id: 1,
            isenabled: true,
            usage_count: 2, // Check if parsed to int
            languages: [
              { language_id: 'en', language_name: 'Category 1 EN' },
              { language_id: 'th', language_name: 'หมวดหมู่ 1' },
            ],
          },
          {
            category_id: 2,
            isenabled: true,
            usage_count: 0,
            languages: [
              { language_id: 'en', language_name: 'Category 2 EN' },
            ],
          },
        ],
      });
    });

    it('should return empty array when no categories found', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: [],
      });
    });

    it('should handle database errors in findAll', async () => {
      const errorMessage = 'Database connection error';
      // mockCategoryRepo.find.mockRejectedValue(new Error(errorMessage)); // <--- ลบ
      mockQueryBuilder.getRawMany.mockRejectedValue(new Error(errorMessage)); // <--- แก้ไข: เปลี่ยนมา mock ที่นี่

      await expect(service.findAll()).rejects.toThrow(errorMessage);
    });
  });

  describe('findOne', () => {
    it('should return specific category when found', async () => {
      const mockCategory = {
        id: 1,
        create_by: 1,
        create_date: new Date(),
        isenabled: true,
        languages: [
          { id: 1, language_id: 'en', name: 'Category 1' },
          { id: 1, language_id: 'th', name: 'หมวดหมู่ 1' },
        ],
      };

      mockCategoryRepo.findOne.mockResolvedValue(mockCategory);

      const result = await service.findOne(1);

      expect(mockCategoryRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1, isenabled: true },
        relations: ['languages'],
      });
      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: mockCategory,
      });
    });

    it('should return error when category not found', async () => {
      mockCategoryRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne(999);

      expect(result).toEqual({
        code: 0,
        message: 'Category not found',
      });
    });

    it('should handle database errors in findOne', async () => {
      const errorMessage = 'Database connection error';
      mockCategoryRepo.findOne.mockRejectedValue(new Error(errorMessage));

      await expect(service.findOne(1)).rejects.toThrow(errorMessage);
    });
  });

  describe('checkCategoryNameExists', () => {
    it('should return true when category name exists', async () => {
      const existingCategory = {
        id: 1,
        name: 'Existing Category',
        language_id: 'en',
      };

      mockQueryBuilder.getOne.mockResolvedValue(existingCategory);

      const result = await service.checkCategoryNameExists('Existing Category', 'en');

      expect(result).toBe(true);
    });

    it('should return false when category name does not exist', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const result = await service.checkCategoryNameExists('Non-existing Category', 'en');

      expect(result).toBe(false);
    });

    it('should exclude specific category ID when provided', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await service.checkCategoryNameExists('Category Name', 'en', 1);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('tc.id != :excludeId', { excludeId: 1 });
    });
  });

  describe('validateCategoryData', () => {
    it('should return no errors for valid data', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const languages = [
        { language_id: 'en', name: 'Category 1' },
        { language_id: 'th', name: 'หมวดหมู่ 1' },
      ];

      const errors = await service.validateCategoryData(languages);

      expect(errors).toEqual([]);
    });

    it('should return errors for duplicate names in database', async () => {
      const existingCategory = {
        id: 1,
        name: 'Existing Category',
        language_id: 'en',
      };

      mockQueryBuilder.getOne
        .mockResolvedValueOnce(existingCategory)
        .mockResolvedValueOnce(null);

      const languages = [
        { language_id: 'en', name: 'Existing Category' },
        { language_id: 'th', name: 'หมวดหมู่ใหม่' },
      ];

      const errors = await service.validateCategoryData(languages);

      expect(errors).toContain('Category name "Existing Category" already exists for language "en"');
    });

    it('should return error for duplicate language_id in request', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const languages = [
        { language_id: 'en', name: 'Category 1' },
        { language_id: 'en', name: 'Category 2' },
      ];

      const errors = await service.validateCategoryData(languages);

      expect(errors).toContain('Duplicate language_id found in the request');
    });

    it('should return error for duplicate names in same request (across languages)', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      const languages = [
        { language_id: 'en', name: 'Same Name' },
        { language_id: 'th', name: 'Same Name' },
      ];

      const errors = await service.validateCategoryData(languages);

      expect(errors).toContain('Duplicate category name found in the request');
    });
  });

  describe('debugCategoryData', () => {
    it('should return debug data successfully', async () => {
      const mockCategories = [{ id: 1, name: 'Category 1' }];
      const mockLanguages = [{ id: 1, language_id: 'en', name: 'Category 1' }];

      mockCategoryRepo.find.mockResolvedValue(mockCategories);
      mockCategoryLangRepo.find.mockResolvedValue(mockLanguages);

      const result = await service.debugCategoryData();

      expect(result).toEqual({
        code: 1,
        message: 'Debug data retrieved',
        data: {
          categories: mockCategories,
          categoryLanguages: mockLanguages,
          categoriesCount: 1,
          languagesCount: 1,
        },
      });
    });

    it('should handle errors in debug data retrieval', async () => {
      const errorMessage = 'Database error';
      mockCategoryRepo.find.mockRejectedValue(new Error(errorMessage));

      const result = await service.debugCategoryData();

      expect(result).toEqual({
        code: 0,
        message: 'Failed to retrieve debug data',
        error: errorMessage,
      });
    });
  });

  describe('updateCategory', () => {
    const categoryId = 1;
    const mockCategory = { id: categoryId };

    beforeEach(() => {
      mockCategoryRepo.findOneBy.mockResolvedValue(mockCategory);
      mockCategoryRepo.save.mockResolvedValue(mockCategory);
    });

    it('should return error if category not found', async () => {
      mockCategoryRepo.findOneBy.mockResolvedValue(null);
      const result = await service.updateCategory(999, {});
      expect(result).toEqual({
        code: 0,
        status: false,
        message: 'ไม่พบหมวดหมู่',
        data: null,
      });
    });

    it('should update single language (existing record)', async () => {
      const updateDto = { language_id: 'en', name: 'Updated Name' };
      const mockLangRecord = { category_id: categoryId, language_id: 'en', name: 'Old Name' };

      mockCategoryLangRepo.findOneBy.mockResolvedValue(mockLangRecord);
      mockCategoryLangRepo.save.mockResolvedValue({ ...mockLangRecord, name: 'Updated Name' });

      const result = await service.updateCategory(categoryId, updateDto);

      expect(mockCategoryLangRepo.findOneBy).toHaveBeenCalledWith({ category_id: categoryId, language_id: 'en' });
      expect(mockCategoryLangRepo.save).toHaveBeenCalledWith({ ...mockLangRecord, name: 'Updated Name' });
      expect(result.code).toBe(1);
      expect(result.message).toBe('อัพเดตหมวดหมู่สำเร็จ');
    });

    it('should create single language (new record)', async () => {
      const updateDto = { language_id: 'th', name: 'ชื่อใหม่' };

      mockCategoryLangRepo.findOneBy.mockResolvedValue(null); // ไม่พบ record เก่า
      mockCategoryLangRepo.save.mockResolvedValue({ category_id: categoryId, ...updateDto });

      await service.updateCategory(categoryId, updateDto);

      expect(mockCategoryLangRepo.findOneBy).toHaveBeenCalledWith({ category_id: categoryId, language_id: 'th' });
      expect(mockCategoryLangRepo.save).toHaveBeenCalledWith({ category_id: categoryId, language_id: 'th', name: 'ชื่อใหม่' });
    });

    it('should update multiple languages (existing and new)', async () => {
      const updateDto = {
        languages: [
          { language_id: 'en', name: 'Updated EN' }, //
          { language_id: 'th', name: 'Updated TH' },
        ],
      };
      const mockLangEn = { category_id: categoryId, language_id: 'en', name: 'Old EN' };

      // Mock 'en' (existing)
      mockCategoryLangRepo.findOneBy.mockResolvedValueOnce(mockLangEn);
      // Mock 'th' (new)
      mockCategoryLangRepo.findOneBy.mockResolvedValueOnce(null);

      await service.updateCategory(categoryId, updateDto);

      // Check 'en' update
      expect(mockCategoryLangRepo.findOneBy).toHaveBeenCalledWith({ category_id: categoryId, language_id: 'en' });
      expect(mockCategoryLangRepo.save).toHaveBeenCalledWith({ ...mockLangEn, name: 'Updated EN' });

      // Check 'th' create
      expect(mockCategoryLangRepo.findOneBy).toHaveBeenCalledWith({ category_id: categoryId, language_id: 'th' });
      expect(mockCategoryLangRepo.save).toHaveBeenCalledWith({ category_id: categoryId, language_id: 'th', name: 'Updated TH' });
      
      expect(mockCategoryLangRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should handle database errors during update', async () => {
      const updateDto = { language_id: 'en', name: 'Updated Name' };
      const errorMessage = 'DB Error';
      mockCategoryLangRepo.findOneBy.mockRejectedValue(new Error(errorMessage));

      const result = await service.updateCategory(categoryId, updateDto);
      
      expect(result).toEqual({
        code: 0,
        status: false,
        message: 'เกิดข้อผิดพลาดในการอัพเดตหมวดหมู่',
        data: null,
      });
    });
  });

  describe('deleteCategories', () => {
    beforeEach(() => {
      // Reset mocks for queryRunner
      jest.clearAllMocks();
      mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);
    });

    it('should delete category and its languages successfully', async () => {
      const categoryId = 1;
      
      // Mock successful deletion for both entities
      mockQueryRunner.manager.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteCategories(categoryId);

      expect(mockDataSource.createQueryRunner).toHaveBeenCalled();
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      
      // Check deletion order
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(TicketCategoryLanguage, { category_id: categoryId });
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(TicketCategory, { id: categoryId });

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      
      expect(result).toEqual({ code: 1, status: true, message: 'ลบหมวดหมู่สำเร็จ' });
    });

    it('should rollback transaction if category not found', async () => {
      const categoryId = 999;
      
      // Mock successful language deletion
      mockQueryRunner.manager.delete.mockResolvedValueOnce({ affected: 1 });
      // Mock failed category deletion (not found)
      mockQueryRunner.manager.delete.mockResolvedValueOnce({ affected: 0 });

      const result = await service.deleteCategories(categoryId);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(TicketCategoryLanguage, { category_id: categoryId });
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(TicketCategory, { id: categoryId });
      
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();

      expect(result).toEqual({ code: 0, status: false, message: 'เกิดข้อผิดพลาดในการลบหมวดหมู่' });
    });

    it('should rollback transaction on database error', async () => {
      const categoryId = 1;
      const errorMessage = 'Database connection error';
      
      // Mock error during language deletion
      mockQueryRunner.manager.delete.mockRejectedValue(new Error(errorMessage));

      const result = await service.deleteCategories(categoryId);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.manager.delete).toHaveBeenCalledWith(TicketCategoryLanguage, { category_id: categoryId });
      
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();

      expect(result).toEqual({ code: 0, status: false, message: 'เกิดข้อผิดพลาดในการลบหมวดหมู่' });
    });
  });
});