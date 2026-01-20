import { Test, TestingModule } from '@nestjs/testing';
import { TicketCategoryController } from './ticket_categories.controller';
import { TicketCategoryService } from './ticket_categories.service';
import { CreateCategoryDto } from './dto/create-ticket_category.dto';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';
import { PermissionGuard } from '../permission/permission.guard'; // <--- Import เพิ่ม

describe('TicketCategoryController', () => {
  let controller: TicketCategoryController;
  let service: TicketCategoryService;

  const mockTicketCategoryService = {
    getCategoriesDDL: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategories: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketCategoryController],
      providers: [
        {
          provide: TicketCategoryService,
          useValue: mockTicketCategoryService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(PermissionGuard) // <--- แก้ไข: เพิ่มบรรทัดนี้
      .useValue({ canActivate: jest.fn(() => true) }) // <--- แก้ไข: และเพิ่มบรรทัดนี้
      .compile();

    controller = module.get<TicketCategoryController>(TicketCategoryController);
    service = module.get<TicketCategoryService>(TicketCategoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCategoriesDDL', () => {
    it('should call service with language_id when provided', async () => {
      const body = { language_id: 'en' };
      const expectedResult = {
        code: 1,
        message: 'Success',
        data: [
          { id: 1, name: 'Category 1', language_id: 'en' },
          { id: 2, name: 'Category 2', language_id: 'en' },
        ],
      };

      mockTicketCategoryService.getCategoriesDDL.mockResolvedValue(expectedResult);

      const result = await controller.getCategoriesDDL(body);

      expect(service.getCategoriesDDL).toHaveBeenCalledWith('en');
      expect(result).toEqual(expectedResult);
    });

    it('should call service with undefined when language_id is not provided', async () => {
      const body = {};
      const expectedResult = {
        code: 1,
        message: 'Success',
        data: [],
      };

      mockTicketCategoryService.getCategoriesDDL.mockResolvedValue(expectedResult);

      const result = await controller.getCategoriesDDL(body);

      expect(service.getCategoriesDDL).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty language_id', async () => {
      const body = { language_id: '' };
      const expectedResult = {
        code: 1,
        message: 'Success',
        data: [],
      };

      mockTicketCategoryService.getCategoriesDDL.mockResolvedValue(expectedResult);

      const result = await controller.getCategoriesDDL(body);

      expect(service.getCategoriesDDL).toHaveBeenCalledWith('');
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors', async () => {
      const body = { language_id: 'en' };
      const expectedResult = {
        code: 0,
        message: 'Failed to fetch categories',
        error: 'Database connection error',
      };

      mockTicketCategoryService.getCategoriesDDL.mockResolvedValue(expectedResult);

      const result = await controller.getCategoriesDDL(body);

      expect(service.getCategoriesDDL).toHaveBeenCalledWith('en');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getCategories', () => {
    it('should return all categories', async () => {
      const expectedResult = {
        code: 1,
        message: 'Success',
        data: [
          {
            id: 1,
            create_by: 1,
            create_date: new Date(),
            isenabled: true,
            languages: [
              { id: 1, language_id: 'en', name: 'Category 1' },
            ],
          },
        ],
      };

      mockTicketCategoryService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.getCategories();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    it('should handle empty results', async () => {
      const expectedResult = {
        code: 1,
        message: 'Success',
        data: [],
      };

      mockTicketCategoryService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.getCategories();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getCategory', () => {
    it('should return a specific category', async () => {
      const categoryId = 1;
      const expectedResult = {
        code: 1,
        message: 'Success',
        data: {
          id: 1,
          create_by: 1,
          create_date: new Date(),
          isenabled: true,
          languages: [
            { id: 1, language_id: 'en', name: 'Category 1' },
          ],
        },
      };

      mockTicketCategoryService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.getCategory(categoryId);

      expect(service.findOne).toHaveBeenCalledWith(categoryId);
      expect(result).toEqual(expectedResult);
    });

    it('should return error when category not found', async () => {
      const categoryId = 999;
      const expectedResult = {
        code: 0,
        message: 'Category not found',
      };

      mockTicketCategoryService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.getCategory(categoryId);

      expect(service.findOne).toHaveBeenCalledWith(categoryId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('createCategory', () => {
    it('should create a category successfully', async () => {
      const createCategoryDto: CreateCategoryDto = {
        create_by: 1,
        languages: [
          { language_id: 'en', name: 'New Category' },
          { language_id: 'th', name: 'หมวดหมู่ใหม่' },
        ],
      };

      const req = {
        user: { id: 1 },
      };

      const expectedResult = {
        code: 1,
        message: 'Category created successfully',
        data: {
          id: 1,
          create_by: 1,
          create_date: new Date(),
          isenabled: true,
          languages: [
            { id: 1, language_id: 'en', name: 'New Category' },
            { id: 1, language_id: 'th', name: 'หมวดหมู่ใหม่' },
          ],
        },
      };

      mockTicketCategoryService.createCategory.mockResolvedValue(expectedResult);

      const result = await controller.createCategory(createCategoryDto, req);

      expect(createCategoryDto.create_by).toBe(1);
      expect(service.createCategory).toHaveBeenCalledWith(createCategoryDto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle user ID from req.user.sub', async () => {
      const createCategoryDto: CreateCategoryDto = {
        create_by: 1,
        languages: [
          { language_id: 'en', name: 'New Category' },
        ],
      };

      const reqWithSub = {
        user: { sub: 2 },
      };

      const expectedResult = {
        code: 1,
        message: 'Category created successfully',
        data: { id: 1, create_by: 2 },
      };

      mockTicketCategoryService.createCategory.mockResolvedValue(expectedResult);

      await controller.createCategory(createCategoryDto, reqWithSub);
      
      expect(createCategoryDto.create_by).toBe(2);
      expect(service.createCategory).toHaveBeenCalledWith(createCategoryDto);
    });

    it('should handle user ID from req.user.userId', async () => {
      const createCategoryDto: CreateCategoryDto = {
        create_by: 1,
        languages: [
          { language_id: 'en', name: 'New Category' },
        ],
      };

      const reqWithUserId = {
        user: { userId: 3 },
      };

      const expectedResult = {
        code: 1,
        message: 'Category created successfully',
        data: { id: 1, create_by: 3 },
      };

      mockTicketCategoryService.createCategory.mockResolvedValue(expectedResult);

      await controller.createCategory(createCategoryDto, reqWithUserId);
      
      expect(createCategoryDto.create_by).toBe(3);
      expect(service.createCategory).toHaveBeenCalledWith(createCategoryDto);
    });

    it('should return error when category name already exists', async () => {
      const createCategoryDto: CreateCategoryDto = {
        create_by: 1,
        languages: [
          { language_id: 'en', name: 'Existing Category' },
        ],
      };

      const req = {
        user: { id: 1 },
      };

      const expectedResult = {
        code: 0,
        message: 'Category name "Existing Category" already exists for language "en"',
        data: {
          existing_category: {
            id: 1,
            name: 'Existing Category',
            language_id: 'en',
          },
        },
      };

      mockTicketCategoryService.createCategory.mockResolvedValue(expectedResult);

      const result = await controller.createCategory(createCategoryDto, req);

      expect(service.createCategory).toHaveBeenCalledWith(createCategoryDto);
      expect(result).toEqual(expectedResult);
    });

    it('should return error for duplicate language_id', async () => {
      const createCategoryDto: CreateCategoryDto = {
        create_by: 1,
        languages: [
          { language_id: 'en', name: 'Category 1' },
          { language_id: 'en', name: 'Category 2' },
        ],
      };

      const req = {
        user: { id: 1 },
      };

      const expectedResult = {
        code: 0,
        message: 'Duplicate language_id found in the request',
      };

      mockTicketCategoryService.createCategory.mockResolvedValue(expectedResult);

      const result = await controller.createCategory(createCategoryDto, req);

      expect(service.createCategory).toHaveBeenCalledWith(createCategoryDto);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors', async () => {
      const createCategoryDto: CreateCategoryDto = {
        create_by: 1,
        languages: [
          { language_id: 'en', name: 'New Category' },
        ],
      };

      const req = {
        user: { id: 1 },
      };

      const expectedResult = {
        code: 0,
        message: 'Failed to create category',
        error: 'Database connection error',
      };

      mockTicketCategoryService.createCategory.mockResolvedValue(expectedResult);

      const result = await controller.createCategory(createCategoryDto, req);

      expect(service.createCategory).toHaveBeenCalledWith(createCategoryDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('updateCategory', () => {
    it('should update a category successfully (with req.user.id)', async () => {
      const categoryId = '1';
      const updateDto = { name: 'Updated Name' };
      const req = { user: { id: 1 } };
      const expectedResult = {
        code: 1,
        status: true,
        message: 'อัพเดตหมวดหมู่สำเร็จ',
        data: { id: 1, name: 'Updated Name' },
      };

      mockTicketCategoryService.updateCategory.mockResolvedValue(expectedResult);

      const result = await controller.updateCategory(categoryId, updateDto, req);

      expect(service.updateCategory).toHaveBeenCalledWith(+categoryId, updateDto);
      expect(result).toEqual(expectedResult);
    });

    it('should call update service with user ID from req.user.sub', async () => {
      const categoryId = '1';
      const updateDto = { name: 'Updated Name' };
      const req = { user: { sub: 2 } };
      const expectedResult = { code: 1, status: true };

      mockTicketCategoryService.updateCategory.mockResolvedValue(expectedResult);
      
      await controller.updateCategory(categoryId, updateDto, req);
      
      expect(service.updateCategory).toHaveBeenCalledWith(+categoryId, updateDto);
    });

    it('should call update service with user ID from req.user.userId', async () => {
      const categoryId = '1';
      const updateDto = { name: 'Updated Name' };
      const req = { user: { userId: 3 } };
      const expectedResult = { code: 1, status: true };

      mockTicketCategoryService.updateCategory.mockResolvedValue(expectedResult);
      
      await controller.updateCategory(categoryId, updateDto, req);
      
      expect(service.updateCategory).toHaveBeenCalledWith(+categoryId, updateDto);
    });

    it('should return error when category not found', async () => {
      const categoryId = '999';
      const updateDto = { name: 'Updated Name' };
      const req = { user: { id: 1 } };
      const expectedResult = {
        code: 0,
        status: false,
        message: 'ไม่พบหมวดหมู่',
        data: null,
      };

      mockTicketCategoryService.updateCategory.mockResolvedValue(expectedResult);

      const result = await controller.updateCategory(categoryId, updateDto, req);

      expect(service.updateCategory).toHaveBeenCalledWith(+categoryId, updateDto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category successfully (with req.user.id)', async () => {
      const categoryId = '1';
      const req = { user: { id: 1 } };
      const expectedResult = {
        code: 1,
        status: true,
        message: 'ลบหมวดหมู่สำเร็จ',
      };

      mockTicketCategoryService.deleteCategories.mockResolvedValue(expectedResult);

      const result = await controller.deleteCategory(categoryId, req);

      expect(service.deleteCategories).toHaveBeenCalledWith(+categoryId);
      expect(result).toEqual(expectedResult);
    });

    it('should call delete service with user ID from req.user.sub', async () => {
      const categoryId = '1';
      const req = { user: { sub: 2 } }; 
      const expectedResult = { code: 1, status: true };

      mockTicketCategoryService.deleteCategories.mockResolvedValue(expectedResult);

      await controller.deleteCategory(categoryId, req);

      expect(service.deleteCategories).toHaveBeenCalledWith(+categoryId);
    });

    it('should call delete service with user ID from req.user.userId', async () => {
      const categoryId = '1';
      const req = { user: { userId: 3 } };
      const expectedResult = { code: 1, status: true };

      mockTicketCategoryService.deleteCategories.mockResolvedValue(expectedResult);

      await controller.deleteCategory(categoryId, req);

      expect(service.deleteCategories).toHaveBeenCalledWith(+categoryId);
    });

    it('should return error when category not found', async () => {
      const categoryId = '999';
      const req = { user: { id: 1 } };
      const expectedResult = {
        code: 0,
        status: false,
        message: 'ไม่พบหมวดหมู่',
      };

      mockTicketCategoryService.deleteCategories.mockResolvedValue(expectedResult);

      const result = await controller.deleteCategory(categoryId, req);

      expect(service.deleteCategories).toHaveBeenCalledWith(+categoryId);
      expect(result).toEqual(expectedResult);
    });

  });
});