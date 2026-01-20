import { Test, TestingModule } from '@nestjs/testing';
import { TicketCategoriesLanguageController } from './ticket_categories_language.controller';
import { TicketCategoriesLanguageService } from './ticket_categories_language.service';
import { CreateTicketCategoriesLanguageDto } from './dto/create-ticket_categories_language.dto';
import { UpdateTicketCategoriesLanguageDto } from './dto/update-ticket_categories_language.dto';

  const mockTicketCategoriesLanguageService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

describe('TicketCategoriesLanguageController', () => {
  let controller: TicketCategoriesLanguageController;
  let service: TicketCategoriesLanguageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketCategoriesLanguageController],
      providers: [
        {
          provide: TicketCategoriesLanguageService,
          useValue: mockTicketCategoriesLanguageService,
        },
      ],
    }).compile();

    controller = module.get<TicketCategoriesLanguageController>(TicketCategoriesLanguageController);
    service = module.get<TicketCategoriesLanguageService>(TicketCategoriesLanguageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new category language', async () => {
      const createDto: CreateTicketCategoriesLanguageDto = {
        language_id: 'en',
        name: 'Test Category',
      };

      const expectedResult = {
        code: 1,
        message: 'Category language created successfully',
        data: {
          id: 1,
          category_id: 1,
          language_id: 'en',
          name: 'Test Category',
        },
      };

      mockTicketCategoriesLanguageService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle validation errors', async () => {
      const createDto: CreateTicketCategoriesLanguageDto = {
        language_id: '',
        name: '',
      };

      const expectedResult = {
        code: 0,
        message: 'Validation failed',
        error: 'language_id and name are required',
      };

      mockTicketCategoriesLanguageService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should return all category languages', async () => {
      const expectedResult = {
        code: 1,
        message: 'Success',
        data: [
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
        ],
      };

      mockTicketCategoriesLanguageService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('should return empty array when no records found', async () => {
      const expectedResult = {
        code: 1,
        message: 'Success',
        data: [],
      };

      mockTicketCategoriesLanguageService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return a specific category language when found', async () => {
      const categoryId = '1';
      const expectedResult = {
        code: 1,
        message: 'Success',
        data: {
          id: 1,
          category_id: 1,
          language_id: 'en',
          name: 'Category 1',
          category: { id: 1, create_by: 1, isenabled: true },
        },
      };

      mockTicketCategoriesLanguageService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(categoryId);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(expectedResult);
    });

    it('should return error when category language not found', async () => {
      const categoryId = '999';
      const expectedResult = {
        code: 0,
        message: 'Category language not found',
      };

      mockTicketCategoriesLanguageService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(categoryId);

      expect(service.findOne).toHaveBeenCalledWith(999);
      expect(result).toEqual(expectedResult);
    });

    it('should handle invalid ID format', async () => {
      const categoryId = 'invalid';
      const expectedResult = {
        code: 0,
        message: 'Category language not found',
      };

      mockTicketCategoriesLanguageService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(categoryId);

      expect(service.findOne).toHaveBeenCalledWith(NaN);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('update', () => {
    it('should update category language successfully', async () => {
      const categoryId = '1';
      const updateDto: UpdateTicketCategoriesLanguageDto = {
        name: 'Updated Category',
      };

      const expectedResult = {
        code: 1,
        message: 'Category language updated successfully',
        data: {
          id: 1,
          category_id: 1,
          language_id: 'en',
          name: 'Updated Category',
          category: { id: 1, create_by: 1, isenabled: true },
        },
      };

      mockTicketCategoriesLanguageService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(categoryId, updateDto);

      expect(service.update).toHaveBeenCalledWith(1, updateDto);
      expect(result).toEqual(expectedResult);
    });

    it('should return error when updating non-existent record', async () => {
      const categoryId = '999';
      const updateDto: UpdateTicketCategoriesLanguageDto = {
        name: 'Updated Category',
      };

      const expectedResult = {
        code: 0,
        message: 'Category language not found or no changes made',
      };

      mockTicketCategoriesLanguageService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(categoryId, updateDto);

      expect(service.update).toHaveBeenCalledWith(999, updateDto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle partial updates', async () => {
      const categoryId = '1';
      const updateDto: UpdateTicketCategoriesLanguageDto = {
        language_id: 'th',
      };

      const expectedResult = {
        code: 1,
        message: 'Category language updated successfully',
        data: {
          id: 1,
          category_id: 1,
          language_id: 'th',
          name: 'Original Name',
          category: { id: 1, create_by: 1, isenabled: true },
        },
      };

      mockTicketCategoriesLanguageService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(categoryId, updateDto);

      expect(service.update).toHaveBeenCalledWith(1, updateDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('remove', () => {
    it('should delete category language successfully', async () => {
      const categoryId = '1';
      const expectedResult = {
        code: 1,
        message: 'Category language deleted successfully',
      };

      mockTicketCategoriesLanguageService.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(categoryId);

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual(expectedResult);
    });

    it('should return error when deleting non-existent record', async () => {
      const categoryId = '999';
      const expectedResult = {
        code: 0,
        message: 'Category language not found',
      };

      mockTicketCategoriesLanguageService.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(categoryId);

      expect(service.remove).toHaveBeenCalledWith(999);
      expect(result).toEqual(expectedResult);
    });

    it('should handle invalid ID format in remove', async () => {
      const categoryId = 'invalid';
      const expectedResult = {
        code: 0,
        message: 'Category language not found',
      };

      mockTicketCategoriesLanguageService.remove.mockResolvedValue(expectedResult);

      const result = await controller.remove(categoryId);

      expect(service.remove).toHaveBeenCalledWith(NaN);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('error handling', () => {
    it('should handle service errors in create', async () => {
      const createDto: CreateTicketCategoriesLanguageDto = {
        language_id: 'en',
        name: 'Test Category',
      };

      const errorMessage = 'Database connection error';
      mockTicketCategoriesLanguageService.create.mockRejectedValue(new Error(errorMessage));

      await expect(controller.create(createDto)).rejects.toThrow(errorMessage);
    });

    it('should handle service errors in findAll', async () => {
      const errorMessage = 'Database connection error';
      mockTicketCategoriesLanguageService.findAll.mockRejectedValue(new Error(errorMessage));

      await expect(controller.findAll()).rejects.toThrow(errorMessage);
    });

    it('should handle service errors in update', async () => {
      const updateDto: UpdateTicketCategoriesLanguageDto = {
        name: 'Updated Category',
      };

      const errorMessage = 'Database connection error';
      mockTicketCategoriesLanguageService.update.mockRejectedValue(new Error(errorMessage));

      await expect(controller.update('1', updateDto)).rejects.toThrow(errorMessage);
    });
  });
});