import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';

// เพิ่ม imports ที่จำเป็น
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';

// Category interface - ปรับให้ตรงกับ backend
export interface CategoryItem {
  id: number;
  name: string;
  description?: string;
  ticketCount?: number; // เพิ่ม field สำหรับจำนวน tickets
  create_date?: string; // เปลี่ยนจาก created_date
  create_by?: number;   // เปลี่ยนจาก created_by
  update_date?: string; // เปลี่ยนจาก updated_date
  update_by?: number;   // เปลี่ยนจาก updated_by
  
  // Additional fields from backend
  isenabled?: boolean;  // Backend field
  languages?: any[];    // Backend field
}

// Create Category Form Interface - ปรับให้ตรงกับ DTO (ลบ status ออก)
export interface CreateCategoryDto {
  languages: {
    language_id: string;
    name: string;
  }[];
  create_by?: number; // จะถูกเซ็ตใน backend
}

@Component({
  selector: 'app-ticket-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './ticket-categories.component.html',
  styleUrls: ['./ticket-categories.component.css']
})
export class TicketCategoriesComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // Loading and error states
  isLoading = false;
  hasError = false;
  errorMessage = '';

  // Search properties
  searchTerm: string = '';

  // Category data
  categories: CategoryItem[] = [];
  filteredCategories: CategoryItem[] = [];

  // Category stats - ปรับให้เหมาะกับการใช้ count
  categoryStats = {
    total: 0,
    totalTickets: 0,
    newThisMonth: 0,
    avgTicketsPerCategory: 0
  };

  // Modal-related properties
  isCreateModalVisible = false;
  isSubmitting = false;
  categoryForm!: FormGroup;
  isEditMode = false; // เพิ่มสำหรับแยก mode
  editingCategoryId: number | null = null; // เก็บ ID ที่กำลังแก้ไข

  // Add language property for current locale
  currentLanguage: string = 'th'; // Default to Thai, can be changed based on user settings

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private fb: FormBuilder
  ) { 
    this.initForm();
    // Set language based on current locale or user preference
    this.setCurrentLanguage();
  }

  /**
   * Get current language setting from navbar/global state
   */
  private getCurrentLanguage(): string {
    // ใช้ key เดียวกับ header component
    return localStorage.getItem('language') || 
           document.documentElement.lang || 
           'th'; // default to Thai
  }

  /**
   * Set current language from locale or user settings
   */
  private setCurrentLanguage(): void {
    this.currentLanguage = this.getCurrentLanguage();
    console.log('Current language set to:', this.currentLanguage);
  }

  /**
   * Get category name by language from languages array
   */
  getCategoryNameByLanguage(languages: any[], languageCode: string): string {
    if (!languages || languages.length === 0) {
      return 'Unnamed Category';
    }

    // Find the language entry for the specified language code
    const languageEntry = languages.find(lang => lang.language_id === languageCode);
    
    if (languageEntry && languageEntry.language_name) {
      return languageEntry.language_name;
    }

    // Fallback to Thai if current language not found
    if (languageCode !== 'th') {
      const thaiEntry = languages.find(lang => lang.language_id === 'th');
      if (thaiEntry && thaiEntry.language_name) {
        console.log(`Fallback to Thai for missing ${languageCode} translation`);
        return thaiEntry.language_name;
      }
    }

    // Fallback to English if Thai not found
    if (languageCode !== 'en') {
      const englishEntry = languages.find(lang => lang.language_id === 'en');
      if (englishEntry && englishEntry.language_name) {
        console.log(`Fallback to English for missing translation`);
        return englishEntry.language_name;
      }
    }

    // Final fallback - use first available language
    if (languages.length > 0 && languages[0].language_name) {
      console.log(`Using first available language: ${languages[0].language_id}`);
      return languages[0].language_name;
    }

    return 'Unnamed Category';
  }

  /**
   * Get localized category name for display
   */
  getLocalizedCategoryName(category: CategoryItem): string {
    if (category.languages && category.languages.length > 0) {
      return this.getCategoryNameByLanguage(category.languages, this.currentLanguage);
    }
    return category.name || 'Unnamed Category';
  }

  /**
   * Get current language display name
   */
  getCurrentLanguageDisplay(): string {
    return this.currentLanguage === 'th' ? 'ไทย' : 'English';
  }

  ngOnInit(): void {
    this.loadCategoryData();
    // Listen for language changes from navbar or global language service
    this.listenForLanguageChanges();
  }

  /**
   * Listen for language changes from external sources (navbar)
   */
  private listenForLanguageChanges(): void {
    // Option 1: Listen to localStorage changes (works for cross-tab changes)
    window.addEventListener('storage', this.handleStorageChange);

    // Option 2: Listen to custom language change event (works for same-tab changes)
    window.addEventListener('language-changed', this.handleLanguageChangeEvent);

    // Option 3: Check for changes periodically as fallback
    setInterval(() => {
      const currentStoredLanguage = this.getCurrentLanguage();
      if (this.currentLanguage !== currentStoredLanguage) {
        console.log('Language change detected via polling:', currentStoredLanguage);
        this.currentLanguage = currentStoredLanguage;
        this.updateCategoryNamesForLanguage();
      }
    }, 500); // Check every 500ms for better responsiveness
  }

  /**
   * Update category names when language changes
   */
  private updateCategoryNamesForLanguage(): void {
    console.log('Updating categories for language:', this.currentLanguage);
    
    // Re-map category names with new language
    this.categories = this.categories.map(category => ({
      ...category,
      name: this.getCategoryNameByLanguage(category.languages || [], this.currentLanguage)
    }));
    
    this.filterCategories();
    
    // Force change detection if needed
    setTimeout(() => {
      console.log('Categories updated for language:', this.currentLanguage);
    }, 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    // Remove event listeners for language changes
    window.removeEventListener('storage', this.handleStorageChange);
    window.removeEventListener('language-changed', this.handleLanguageChangeEvent);
  }

  /**
   * Handle custom language change event (bound method for proper cleanup)
   */
  private handleLanguageChangeEvent = (event: any) => {
    const newLanguage = event.detail?.language;
    if (newLanguage && this.currentLanguage !== newLanguage) {
      console.log('Language change detected via custom event:', newLanguage);
      this.currentLanguage = newLanguage;
      this.updateCategoryNamesForLanguage();
    }
  }

  /**
   * Handle storage changes (bound method for proper cleanup)
   */
  private handleStorageChange = (event: StorageEvent) => {
    if (event.key === 'language' && event.newValue) {
      const newLanguage = event.newValue;
      if (this.currentLanguage !== newLanguage) {
        console.log('Language change detected via storage event:', newLanguage);
        this.currentLanguage = newLanguage;
        this.updateCategoryNamesForLanguage();
      }
    }
  }

  /**
   * Initialize form for modal - ลบ status field ออก
   */
  private initForm(): void {
    this.categoryForm = this.fb.group({
      // ชื่อภาษาไทย
      nameTh: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      // ชื่อภาษาอังกฤษ  
      nameEn: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]]
      // ลบ status field ออก
    });

    console.log('Category form initialized:', this.categoryForm);
  }

  /**
   * Check if field is invalid
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.categoryForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get description length - ปรับเป็น nameEn length
   */
  getNameEnLength(): number {
    const nameEnValue = this.categoryForm.get('nameEn')?.value;
    return nameEnValue ? nameEnValue.length : 0;
  }

  /**
   * Get Thai name length
   */
  getNameThLength(): number {
    const nameThValue = this.categoryForm.get('nameTh')?.value;
    return nameThValue ? nameThValue.length : 0;
  }

  /**
   * โหลดข้อมูล Category จาก API
   */
  loadCategoryData(forceRefresh: boolean = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    console.log('Loading category data from API...');

    // เรียก API /api/categories
    this.apiService.get('categories')
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading category data:', error);
          this.hasError = true;
          this.errorMessage = 'Failed to load category data. Please try again.';
          this.isLoading = false;
          
          // Fallback to mock data if API fails
          this.loadFallbackData();
          return of([]);
        })
      )
      .subscribe({
        next: (response: any) => {
          console.log('API Response:', response);
          console.log('Response type:', typeof response);
          console.log('Response keys:', Object.keys(response || {}));
          
          // Handle different response formats based on your API structure
          let categoryData: any[] = [];
          
          if (response && response.code === 1 && response.data && Array.isArray(response.data)) {
            // Format: {code: 1, message: 'Success', data: Array(10)}
            categoryData = response.data;
            console.log('Using response.data format');
          } else if (response && Array.isArray(response)) {
            // Direct array format
            categoryData = response;
            console.log('Using direct array format');
          } else if (response && response.categories && Array.isArray(response.categories)) {
            // Format: {categories: []}
            categoryData = response.categories;
            console.log('Using response.categories format');
          } else {
            console.warn('Unexpected response format:', response);
            console.warn('Available properties:', Object.keys(response || {}));
            categoryData = [];
          }

          // Map the data to match our interface
          this.categories = categoryData.map((item: any, index: number) => {
            console.log(`Category ${index}:`, item);
            console.log(`Available fields:`, Object.keys(item));
            
            // Get category name based on current language from languages array
            const categoryName = this.getCategoryNameByLanguage(item.languages || [], this.currentLanguage);
            console.log(`Category ${item.category_id} name in ${this.currentLanguage}:`, categoryName);
            
            return {
              id: item.category_id, // ใช้ category_id แทน id
              name: categoryName,
              description: item.description || '',
              ticketCount: item.usage_count || 0, // ใช้ usage_count แทน ticketCount
              create_date: item.create_date,
              create_by: item.create_by,
              update_date: item.update_date,
              update_by: item.update_by,
              // Additional fields from API
              languages: item.languages || [],
              isenabled: item.isenabled
            };
          });

          console.log('Mapped categories:', this.categories);
          console.log('Categories count:', this.categories.length);

          this.filterCategories();
          this.loadCategoryStats();
          this.isLoading = false;
          console.log('Category data loaded successfully:', this.categories);
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.hasError = true;
          this.errorMessage = this.getErrorMessage(error);
          this.isLoading = false;
          this.loadFallbackData();
        }
      });
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: any): string {
    if (error.status === 401) {
      return 'You are not authorized to view categories. Please log in again.';
    } else if (error.status === 403) {
      return 'You do not have permission to view categories.';
    } else if (error.status === 404) {
      return 'Categories endpoint not found.';
    } else if (error.status === 500) {
      return 'Server error occurred. Please try again later.';
    } else if (!error.status && error.message) {
      return `Network error: ${error.message}`;
    } else {
      return 'Failed to load category data. Please try again.';
    }
  }

  /**
   * โหลดสถิติ Category - ปรับให้เหมาะกับการใช้ count
   */
  loadCategoryStats(): void {
    if (this.categories.length === 0) {
      this.categoryStats = {
        total: 0,
        totalTickets: 0,
        newThisMonth: 0,
        avgTicketsPerCategory: 0
      };
      return;
    }

    // คำนวณสถิติจากข้อมูลที่โหลดมา
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalTickets = this.categories.reduce((sum, c) => sum + (c.ticketCount || 0), 0);
    const avgTickets = this.categories.length > 0 ? Math.round(totalTickets / this.categories.length) : 0;

    this.categoryStats = {
      total: this.categories.length,
      totalTickets: totalTickets,
      newThisMonth: this.categories.filter(c => {
        if (!c.create_date) return false;
        try {
          const createDate = new Date(c.create_date);
          return createDate.getMonth() === currentMonth && createDate.getFullYear() === currentYear;
        } catch (error) {
          console.warn('Invalid date format:', c.create_date);
          return false;
        }
      }).length,
      avgTicketsPerCategory: avgTickets
    };

    console.log('Category stats calculated:', this.categoryStats);
  }

  /**
   * Mock data สำหรับทดสอบ (fallback) - เพิ่ม ticketCount
   */
  private getMockCategoryData(): CategoryItem[] {
    return [
      {
        id: 1,
        name: 'Technical Issue',
        description: 'Issues related to technical problems',
        ticketCount: 25,
        create_date: '2024-01-10T00:00:00Z',
        create_by: 1,
        update_date: '2025-08-20T10:00:00Z',
        update_by: 1
      },
      {
        id: 2,
        name: 'Account & Billing',
        description: 'Account management and billing inquiries',
        ticketCount: 18,
        create_date: '2024-01-10T00:00:00Z',
        create_by: 1,
        update_date: '2025-08-18T14:30:00Z',
        update_by: 1
      },
      {
        id: 3,
        name: 'Feature Request',
        description: 'Requests for new features or improvements',
        ticketCount: 12,
        create_date: '2024-02-15T00:00:00Z',
        create_by: 2,
        update_date: '2025-08-15T09:00:00Z',
        update_by: 2
      },
      {
        id: 4,
        name: 'Bug Report',
        description: 'Reports of software bugs and issues',
        ticketCount: 30,
        create_date: '2024-02-20T00:00:00Z',
        create_by: 1,
        update_date: '2025-08-10T16:45:00Z',
        update_by: 1
      },
      {
        id: 5,
        name: 'General Inquiry',
        description: 'General questions and information requests',
        ticketCount: 8,
        create_date: '2024-03-01T00:00:00Z',
        create_by: 2,
        update_date: '2025-07-30T11:20:00Z',
        update_by: 3
      }
    ];
  }

  /**
   * โหลดข้อมูล fallback เมื่อ API ล้มเหลว
   */
  private loadFallbackData(): void {
    console.log('Loading fallback data...');
    this.categories = this.getMockCategoryData();
    this.filterCategories();
    this.loadCategoryStats();
  }

  /**
   * Filter categories based on search term
   */
  filterCategories(): void {
    console.log('Filtering categories. Total categories:', this.categories.length);
    console.log('Search term:', this.searchTerm);
    
    this.filteredCategories = this.categories.filter(category => {
      const matchesSearch = this.searchTerm === '' ||
        this.matchesSearchTerm(category, this.searchTerm.toLowerCase());

      if (!matchesSearch) {
        console.log('Category filtered out:', category.name);
      }

      return matchesSearch;
    });

    console.log('Filtered categories result:', this.filteredCategories.length, 'of', this.categories.length);
    console.log('Filtered categories list:', this.filteredCategories.map(c => ({ id: c.id, name: c.name, ticketCount: c.ticketCount })));
  }

  /**
   * ตรวจสอบว่าตรงกับคำค้นหาหรือไม่
   */
  private matchesSearchTerm(category: CategoryItem, searchTerm: string): boolean {
    const searchableFields = [
      category.name || '',
      category.description || '',
      (category.ticketCount || 0).toString()
    ];

    return searchableFields.some(field =>
      field.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Handle search input change
   */
  onSearchChange(): void {
    this.filterCategories();
  }

  // ============ MODAL METHODS ============

  /**
   * เปิด Modal สำหรับสร้าง Category ใหม่
   */
  createNewCategory(): void {
    console.log('Opening create new category modal');
    this.isCreateModalVisible = true;
    this.resetForm();
  }

  /**
   * ปิด Modal
   */
  onModalClose(): void {
    console.log('Create category modal closed');
    if (!this.isSubmitting) {
      this.resetForm();
      this.isCreateModalVisible = false;
    }
  }

  /**
   * Handle backdrop click
   */
  onBackdropClick(): void {
    this.onModalClose();
  }

  /**
   * Reset form - ปรับให้รองรับ edit mode
   */
  private resetForm(): void {
    this.categoryForm.reset();
    this.isSubmitting = false;
    this.isEditMode = false;
    this.editingCategoryId = null;
    console.log('Category form reset');
  }

  /**
   * Handle form submission - เรียก API สร้าง/แก้ไข category
   */
  onSubmit(): void {
    console.log('Category form submitted');
    console.log('Form valid:', this.categoryForm.valid);
    console.log('Form value:', this.categoryForm.value);
    console.log('Edit mode:', this.isEditMode);
    
    if (this.categoryForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      
      const formData = {
        languages: [
          {
            language_id: 'th',
            name: this.categoryForm.value.nameTh.trim()
          },
          {
            language_id: 'en', 
            name: this.categoryForm.value.nameEn.trim()
          }
        ]
      };

      if (this.isEditMode && this.editingCategoryId) {
        // แก้ไข category
        console.log('Updating category via API...');
        this.updateCategory(this.editingCategoryId, formData);
      } else {
        // สร้าง category ใหม่
        console.log('Creating category via API...');
        this.createCategory(formData);
      }
    } else {
      console.log('Form invalid, marking all fields as touched');
      Object.keys(this.categoryForm.controls).forEach(key => {
        const control = this.categoryForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  /**
   * Create new category via API
   */
  private createCategory(formData: any): void {
    // เรียก API /api/categories (POST)
    this.apiService.post('categories', formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error creating category:', error);
          this.isSubmitting = false;
          this.showErrorMessage(this.getCreateErrorMessage(error));
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response) {
            console.log('Category created successfully:', response);
            this.onCategoryCreated(response);
          }
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.isSubmitting = false;
          this.showErrorMessage('Failed to create category. Please try again.');
        }
      });
  }

  /**
   * Get error message for create operation
   */
  private getCreateErrorMessage(error: any): string {
    if (error.status === 401) {
      return 'You are not authorized. Please log in again.';
    } else if (error.status === 403) {
      return 'You do not have permission to create categories.';
    } else if (error.status === 400) {
      return error.error?.message || 'Invalid category data. Please check your input.';
    } else if (error.status === 409) {
      return 'A category with this name already exists.';
    } else {
      return 'Failed to create category. Please try again.';
    }
  }

  /**
   * จัดการการสร้าง Category ใหม่จาก API Response
   */
  onCategoryCreated(apiResponse: any): void {
    console.log('New category created via API:', apiResponse);
    
    // ปิด modal
    this.isCreateModalVisible = false;
    
    // แสดงข้อความสำเร็จ
    const categoryName = apiResponse.name || apiResponse.data?.name || 'New Category';
    this.showSuccessMessage(`Category "${categoryName}" has been created successfully!`);
    
    // รีเฟรชข้อมูล
    this.loadCategoryData(true);
  }

  /**
   * แสดงข้อความสำเร็จ
   */
  private showSuccessMessage(message: string): void {
    alert(message);
    console.log('Success:', message);
  }

  /**
   * แสดงข้อความ error
   */
  private showErrorMessage(message: string): void {
    alert(message);
    console.log('Error:', message);
  }

  /**
   * Edit category
   */
  editCategory(categoryId: number): void {
    console.log('Opening edit category modal for ID:', categoryId);
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) {
      console.error('Category not found:', categoryId);
      return;
    }

    // เปิด modal แก้ไข (ใช้ modal เดียวกันกับการสร้าง)
    this.isCreateModalVisible = true;
    this.isEditMode = true;
    this.editingCategoryId = categoryId;
    
    // กรอกข้อมูลเดิมลงในฟอร์ม
    this.categoryForm.patchValue({
      nameTh: this.getCategoryNameByLanguage(category.languages || [], 'th'),
      nameEn: this.getCategoryNameByLanguage(category.languages || [], 'en')
    });
  }

  /**
   * Update category via API
   */
  private updateCategory(categoryId: number, formData: any): void {
    console.log('Updating category via API:', { categoryId, formData });

    this.apiService.patch(`category/update/${categoryId}`, formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error updating category:', error);
          this.isSubmitting = false;
          this.showErrorMessage(this.getUpdateErrorMessage(error));
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response) {
            console.log('Category updated successfully:', response);
            this.onCategoryUpdated(response);
          }
          this.isSubmitting = false;
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.isSubmitting = false;
          this.showErrorMessage('Failed to update category. Please try again.');
        }
      });
  }

  /**
   * Get error message for update operation
   */
  private getUpdateErrorMessage(error: any): string {
    if (error.status === 401) {
      return 'You are not authorized. Please log in again.';
    } else if (error.status === 403) {
      return 'You do not have permission to update categories.';
    } else if (error.status === 400) {
      return error.error?.message || 'Invalid category data. Please check your input.';
    } else if (error.status === 404) {
      return 'Category not found.';
    } else if (error.status === 409) {
      return 'A category with this name already exists.';
    } else {
      return 'Failed to update category. Please try again.';
    }
  }

  /**
   * จัดการการอัปเดต Category จาก API Response
   */
  onCategoryUpdated(apiResponse: any): void {
    console.log('Category updated via API:', apiResponse);
    
    // ปิด modal
    this.isCreateModalVisible = false;
    this.isEditMode = false;
    this.editingCategoryId = null;
    
    // แสดงข้อความสำเร็จ
    const categoryName = apiResponse.name || apiResponse.data?.name || 'Category';
    this.showSuccessMessage(`Category "${categoryName}" has been updated successfully!`);
    
    // รีเฟรชข้อมูล
    this.loadCategoryData(true);
  }

  /**
   * Delete category with confirmation
   */
  deleteCategory(categoryId: number): void {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) {
      console.error('Category not found:', categoryId);
      return;
    }

    const confirmMessage = `Are you sure you want to delete category "${category.name}"?\n\nThis action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.performDeleteCategory(categoryId, category.name);
    }
  }

  /**
   * ลบ category จริงผ่าน API
   */
  private performDeleteCategory(categoryId: number, categoryName: string): void {
    console.log('Deleting category via API:', { categoryId, categoryName });

    this.isLoading = true;

    // เรียก API DELETE /api/category/delete/:id
    this.apiService.delete(`category/delete/${categoryId}`)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error deleting category:', error);
          this.isLoading = false;
          this.showErrorMessage(this.getDeleteErrorMessage(error, categoryName));
          return of(null);
        })
      )
      .subscribe({
        next: (response) => {
          if (response !== null) {
            console.log('Category deleted successfully:', response);
            this.showSuccessMessage(`Category "${categoryName}" has been deleted successfully.`);
            this.loadCategoryData(true); // Refresh data
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.showErrorMessage(`Failed to delete category "${categoryName}". Please try again.`);
          this.isLoading = false;
        }
      });
  }

  /**
   * Get error message for delete operation
   */
  private getDeleteErrorMessage(error: any, categoryName: string): string {
    if (error.status === 401) {
      return 'You are not authorized. Please log in again.';
    } else if (error.status === 403) {
      return 'You do not have permission to delete categories.';
    } else if (error.status === 404) {
      return `Category "${categoryName}" not found.`;
    } else if (error.status === 409) {
      return `Cannot delete category "${categoryName}" because it is being used by existing tickets.`;
    } else if (error.status === 500) {
      return 'Server error occurred. Please try again later.';
    } else {
      return `Failed to delete category "${categoryName}". Please try again.`;
    }
  }

  /**
   * รีเฟรชข้อมูล
   */
  refreshData(): void {
    console.log('Refreshing category data...');
    this.loadCategoryData(true);
  }

  /**
   * Permission methods - ปรับให้ตรงกับ backend permission
   */
  canManageCategories(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_CATEGORY || 'manage_category' as any) ||
      this.authService.isAdmin();
  }

  canEditCategory(category: CategoryItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }
    return this.authService.hasPermission(permissionEnum.MANAGE_CATEGORY || 'manage_category' as any);
  }

  canDeleteCategory(category: CategoryItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }
    return this.authService.hasPermission(permissionEnum.MANAGE_CATEGORY || 'manage_category' as any);
  }

  canCreateCategory(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_CATEGORY || 'manage_category' as any) ||
      this.authService.isAdmin();
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByCategoryId(index: number, category: CategoryItem): number {
    return category.id;
  }

  /**
   * Format date for display - ปรับให้ใช้ field names ใหม่
   */
  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';

      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return 'N/A';
    }
  }

  /**
   * Format datetime for display
   */
  formatDateTime(dateTimeString: string | undefined): string {
    if (!dateTimeString) return 'N/A';

    try {
      const date = new Date(dateTimeString);
      if (isNaN(date.getTime())) return 'N/A';

      return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.warn('Error formatting datetime:', dateTimeString, error);
      return 'N/A';
    }
  }

  /**
   * แสดงข้อมูลสถิติ - ปรับให้แสดง count-related stats
   */
  getStatsDisplay(): {
    total: string;
    totalTickets: string;
    newThisMonth: string;
    avgTicketsPerCategory: string;
  } {
    return {
      total: this.categoryStats.total.toLocaleString(),
      totalTickets: this.categoryStats.totalTickets.toLocaleString(),
      newThisMonth: this.categoryStats.newThisMonth.toLocaleString(),
      avgTicketsPerCategory: this.categoryStats.avgTicketsPerCategory.toLocaleString()
    };
  }

  /**
   * ได้รับ permission description สำหรับแสดงผล
   */
  getPermissionRequiredMessage(): string {
    return 'ต้องมีสิทธิ์ "จัดการ category" เพื่อดำเนินการนี้';
  }

  /**
   * แสดงข้อความเมื่อไม่มีสิทธิ์
   */
  showPermissionDeniedMessage(action: string): void {
    alert(`คุณไม่มีสิทธิ์ในการ${action}\n\n${this.getPermissionRequiredMessage()}`);
  }

  /**
   * Wrapper methods ที่มีการตรวจสอบสิทธิ์
   */
  onCreateNewCategory(): void {
    if (!this.canCreateCategory()) {
      this.showPermissionDeniedMessage('สร้าง category ใหม่');
      return;
    }
    this.createNewCategory();
  }

  onEditCategory(categoryId: number): void {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    if (!this.canEditCategory(category)) {
      this.showPermissionDeniedMessage('แก้ไข category');
      return;
    }
    this.editCategory(categoryId);
  }

  onDeleteCategory(categoryId: number): void {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    if (!this.canDeleteCategory(category)) {
      this.showPermissionDeniedMessage('ลบ category');
      return;
    }
    this.deleteCategory(categoryId);
  }
}