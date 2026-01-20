import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketCategoriesLanguageService } from './ticket_categories_language.service';
import { TicketCategoryLanguage } from './entities/ticket_categories_language.entity';
import { CreateTicketCategoriesLanguageDto } from './dto/create-ticket_categories_language.dto';
import { UpdateTicketCategoriesLanguageDto } from './dto/update-ticket_categories_language.dto';

describe('TicketCategoriesLanguageService', () => {
  let service: TicketCategoriesLanguageService;
  let categoryLangRepo: Repository<TicketCategoryLanguage>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketCategoriesLanguageService,
        {
          provide: getRepositoryToken(TicketCategoryLanguage),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TicketCategoriesLanguageService>(TicketCategoriesLanguageService);
    categoryLangRepo = module.get<Repository<TicketCategoryLanguage>>(
      getRepositoryToken(TicketCategoryLanguage)
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a category language successfully', async () => {
      const createDto: CreateTicketCategoriesLanguageDto = {
        language_id: 'en',
        name: 'Test Category',
      };

      const mockCategoryLang = {
        id: 1,
        category_id: 1,
        language_id: 'en',
        name: 'Test Category',
      };

      mockRepository.create.mockReturnValue(mockCategoryLang);
      mockRepository.save.mockResolvedValue(mockCategoryLang);

      const result = await service.create(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalledWith(mockCategoryLang);
      expect(result).toEqual({
        code: 1,
        message: 'Category language created successfully',
        data: mockCategoryLang,
      });
    });

    it('should handle create errors', async () => {
      const createDto: CreateTicketCategoriesLanguageDto = {
        language_id: 'en',
        name: 'Test Category',
      };

      const errorMessage = 'Database error';
      mockRepository.create.mockReturnValue({});
      mockRepository.save.mockRejectedValue(new Error(errorMessage));

      await expect(service.create(createDto)).rejects.toThrow(errorMessage);
    });
  });

  describe('findAll', () => {
    it('should return all category languages with relations', async () => {
      const mockCategoryLanguages = [
        {
          id: 1,
          category_id: 1,
          language_id: 'en',
          name: 'Category 1',
          category: { id: 1, create_by: 1, isenabled: true },
        },
        {
          id: 2,
          category_id: 2,
          language_id: 'th',
          name: 'หมวดหมู่ 2',
          category: { id: 2, create_by: 1, isenabled: true },
        },
      ];

      mockRepository.find.mockResolvedValue(mockCategoryLanguages);

      const result = await service.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith({
        relations: ['category'],
      });
      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: mockCategoryLanguages,
      });
    });

    it('should return empty array when no records found', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: [],
      });
    });
  });

  describe('findOne', () => {
    it('should return a specific category language when found', async () => {
      const mockCategoryLanguage = {
        id: 1,
        category_id: 1,
        language_id: 'en',
        name: 'Category 1',
        category: { id: 1, create_by: 1, isenabled: true },
      };

      mockRepository.findOne.mockResolvedValue(mockCategoryLanguage);

      const result = await service.findOne(1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['category'],
      });
      expect(result).toEqual({
        code: 1,
        message: 'Success',
        data: mockCategoryLanguage,
      });
    });

    it('should return error when category language not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne(999);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 999 },
        relations: ['category'],
      });
      expect(result).toEqual({
        code: 0,
        message: 'Category language not found',
      });
    });
  });

  describe('update', () => {
    it('should update category language successfully', async () => {
      const updateDto: UpdateTicketCategoriesLanguageDto = {
        name: 'Updated Category',
      };

      const mockUpdatedRecord = {
        id: 1,
        category_id: 1,
        language_id: 'en',
        name: 'Updated Category',
        category: { id: 1, create_by: 1, isenabled: true },
      };

      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValue(mockUpdatedRecord);

      const result = await service.update(1, updateDto);

      expect(mockRepository.update).toHaveBeenCalledWith(1, updateDto);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['category'],
      });
      expect(result).toEqual({
        code: 1,
        message: 'Category language updated successfully',
        data: mockUpdatedRecord,
      });
    });

    it('should return error when update affects no records', async () => {
      const updateDto: UpdateTicketCategoriesLanguageDto = {
        name: 'Updated Category',
      };

      mockRepository.update.mockResolvedValue({ affected: 0 });

      const result = await service.update(999, updateDto);

      expect(mockRepository.update).toHaveBeenCalledWith(999, updateDto);
      expect(result).toEqual({
        code: 0,
        message: 'Category language not found or no changes made',
      });
    });

    it('should handle partial updates', async () => {
      const updateDto: UpdateTicketCategoriesLanguageDto = {
        language_id: 'th',
      };

      const mockUpdatedRecord = {
        id: 1,
        category_id: 1,
        language_id: 'th',
        name: 'Original Name',
        category: { id: 1, create_by: 1, isenabled: true },
      };

      mockRepository.update.mockResolvedValue({ affected: 1 });
      mockRepository.findOne.mockResolvedValue(mockUpdatedRecord);

      const result = await service.update(1, updateDto);

      expect(mockRepository.update).toHaveBeenCalledWith(1, updateDto);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['category'],
      });
      expect(result).toEqual({
        code: 1,
        message: 'Category language updated successfully',
        data: mockUpdatedRecord,
      });
      expect(result.data?.language_id).toBe('th');
    });
  });

  describe('remove', () => {
    it('should delete category language successfully', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(1);

      expect(mockRepository.delete).toHaveBeenCalledWith(1);
      expect(result).toEqual({
        code: 1,
        message: 'Category language deleted successfully',
      });
    });

    it('should return error when delete affects no records', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.remove(999);

      expect(mockRepository.delete).toHaveBeenCalledWith(999);
      expect(result).toEqual({
        code: 0,
        message: 'Category language not found',
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors in findAll', async () => {
      const errorMessage = 'Database connection error';
      mockRepository.find.mockRejectedValue(new Error(errorMessage));

      await expect(service.findAll()).rejects.toThrow(errorMessage);
    });

    it('should handle database errors in update', async () => {
      const updateDto: UpdateTicketCategoriesLanguageDto = {
        name: 'Updated Category',
      };

      const errorMessage = 'Database connection error';
      mockRepository.update.mockRejectedValue(new Error(errorMessage));

      await expect(service.update(1, updateDto)).rejects.toThrow(errorMessage);
    });

    it('should handle database errors in remove', async () => {
      const errorMessage = 'Database connection error';
      mockRepository.delete.mockRejectedValue(new Error(errorMessage));

      await expect(service.remove(1)).rejects.toThrow(errorMessage);
    });
  });
});