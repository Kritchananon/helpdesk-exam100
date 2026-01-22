import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';

// เพิ่ม imports ที่จำเป็น
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';
import { LanguageService } from '../../../shared/services/language.service';

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

// Create Category Form Interface
export interface CreateCategoryDto {
  languages: {
    language_id: string;
    name: string;
  }[];
  create_by?: number;
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

  // Category stats
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
  isEditMode = false;
  editingCategoryId: number | null = null;

  // Object สำหรับเก็บคำแปลเพื่อใช้ใน HTML
  i18n: any = {};

  get currentLanguage(): string {
    return this.languageService.getCurrentLanguage();
  }

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private fb: FormBuilder,
    private languageService: LanguageService
  ) { 
    this.initForm();
  }

  ngOnInit(): void {
    // โหลดคำแปลครั้งแรก
    this.updateTranslations();
    this.loadCategoryData();

    // Subscribe เพื่ออัปเดตคำแปลเมื่อเปลี่ยนภาษา
    this.languageService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateTranslations();
        this.updateCategoryNamesForLanguage();
      });

    // Subscribe เมื่อโหลดไฟล์ภาษาเสร็จ (ป้องกัน Race Condition)
    this.languageService.translationsLoaded$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loaded => {
        if (loaded) this.updateTranslations();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * อัปเดตตัวแปร i18n สำหรับใช้ใน HTML
   */
  private updateTranslations(): void {
    const s = this.languageService;
    
    this.i18n = {
      breadcrumb: s.translate('ticketCategories.breadcrumb'),
      title: s.translate('ticketCategories.title'),
      search: s.translate('common.search'),
      searchPlaceholder: s.translate('ticketCategories.searchPlaceholder'),
      createButton: s.translate('ticketCategories.createButton'),
      permissionDenied: s.translate('ticketCategories.permissionDenied'),
      
      stats: {
        total: s.translate('ticketCategories.stats.total'),
        totalTickets: s.translate('ticketCategories.stats.totalTickets'),
        newThisMonth: s.translate('ticketCategories.stats.newThisMonth'),
        avgPerCategory: s.translate('ticketCategories.stats.avgPerCategory'),
      },
      
      table: {
        no: s.translate('ticketCategories.table.no'),
        category: s.translate('ticketCategories.table.category'),
        ticketCount: s.translate('ticketCategories.table.ticketCount'),
        actions: s.translate('ticketCategories.table.actions'),
        tickets: s.translate('ticketCategories.table.tickets'),
        emptyTitle: s.translate('ticketCategories.table.emptyTitle'),
        emptyDesc: s.translate('ticketCategories.table.emptyDesc'),
      },
      
      loading: s.translate('common.loading'),
      error: s.translate('common.error'),
      tryAgain: s.translate('tickets.tryAgain'),
      edit: s.translate('common.edit'),
      delete: s.translate('common.delete'),
      save: s.translate('common.save'),
      cancel: s.translate('common.cancel'),
      refresh: s.translate('common.refresh'),
      
      modal: {
        createTitle: s.translate('ticketCategories.modal.createTitle'),
        editTitle: s.translate('ticketCategories.modal.editTitle'),
        nameTh: s.translate('ticketCategories.modal.nameTh'),
        nameThPlaceholder: s.translate('ticketCategories.modal.nameThPlaceholder'),
        nameEn: s.translate('ticketCategories.modal.nameEn'),
        nameEnPlaceholder: s.translate('ticketCategories.modal.nameEnPlaceholder'),
        required: s.translate('ticketCategories.modal.required'),
        minLength: s.translate('ticketCategories.modal.minLength'),
        maxLength: s.translate('ticketCategories.modal.maxLength'),
      }
    };
  }

  /**
   * Get category name by language from languages array
   */
  getCategoryNameByLanguage(languages: any[], languageCode: string): string {
    if (!languages || languages.length === 0) {
      return 'Unnamed Category';
    }

    const languageEntry = languages.find(lang => lang.language_id === languageCode);
    if (languageEntry && languageEntry.language_name) {
      return languageEntry.language_name;
    }

    if (languageCode !== 'th') {
      const thaiEntry = languages.find(lang => lang.language_id === 'th');
      if (thaiEntry && thaiEntry.language_name) return thaiEntry.language_name;
    }

    if (languageCode !== 'en') {
      const englishEntry = languages.find(lang => lang.language_id === 'en');
      if (englishEntry && englishEntry.language_name) return englishEntry.language_name;
    }

    if (languages.length > 0 && languages[0].language_name) {
      return languages[0].language_name;
    }

    return 'Unnamed Category';
  }

  /**
   * Get localized category name for display
   */
  getLocalizedCategoryName(category: CategoryItem): string {
    return this.getCategoryNameByLanguage(category.languages || [], this.currentLanguage);
  }

  /**
   * Update category names when language changes
   */
  private updateCategoryNamesForLanguage(): void {
    if (!this.categories.length) return;
    
    this.categories = this.categories.map(category => ({
      ...category,
      name: this.getLocalizedCategoryName(category)
    }));
    
    this.filterCategories();
  }

  private initForm(): void {
    this.categoryForm = this.fb.group({
      nameTh: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      nameEn: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]]
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.categoryForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getNameEnLength(): number {
    const nameEnValue = this.categoryForm.get('nameEn')?.value;
    return nameEnValue ? nameEnValue.length : 0;
  }

  getNameThLength(): number {
    const nameThValue = this.categoryForm.get('nameTh')?.value;
    return nameThValue ? nameThValue.length : 0;
  }

  loadCategoryData(forceRefresh: boolean = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    this.apiService.get('categories')
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error loading category data:', error);
          this.hasError = true;
          this.errorMessage = this.languageService.translate('ticketCategories.messages.loadError');
          this.isLoading = false;
          return of([]);
        })
      )
      .subscribe({
        next: (response: any) => {
          let categoryData: any[] = [];
          
          if (response && response.code === 1 && response.data && Array.isArray(response.data)) {
            categoryData = response.data;
          } else if (response && Array.isArray(response)) {
            categoryData = response;
          } else if (response && response.categories && Array.isArray(response.categories)) {
            categoryData = response.categories;
          }

          this.categories = categoryData.map((item: any) => {
            const categoryName = this.getCategoryNameByLanguage(item.languages || [], this.currentLanguage);
            
            return {
              id: item.category_id,
              name: categoryName,
              description: item.description || '',
              ticketCount: item.usage_count || 0,
              create_date: item.create_date,
              create_by: item.create_by,
              update_date: item.update_date,
              update_by: item.update_by,
              languages: item.languages || [],
              isenabled: item.isenabled
            };
          });

          this.filterCategories();
          this.loadCategoryStats();
          this.isLoading = false;
        },
        error: (error) => {
          this.hasError = true;
          this.errorMessage = this.getErrorMessage(error);
          this.isLoading = false;
        }
      });
  }

  private getErrorMessage(error: any): string {
    return error.error?.message || 'Failed to load category data.';
  }

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
          return false;
        }
      }).length,
      avgTicketsPerCategory: avgTickets
    };
  }

  filterCategories(): void {
    this.filteredCategories = this.categories.filter(category => {
      const matchesSearch = this.searchTerm === '' ||
        this.matchesSearchTerm(category, this.searchTerm.toLowerCase());
      return matchesSearch;
    });
  }

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

  onSearchChange(): void {
    this.filterCategories();
  }

  // ============ MODAL METHODS ============

  createNewCategory(): void {
    this.isCreateModalVisible = true;
    this.resetForm();
  }

  onModalClose(): void {
    if (!this.isSubmitting) {
      this.resetForm();
      this.isCreateModalVisible = false;
    }
  }

  onBackdropClick(): void {
    this.onModalClose();
  }

  private resetForm(): void {
    this.categoryForm.reset();
    this.isSubmitting = false;
    this.isEditMode = false;
    this.editingCategoryId = null;
  }

  onSubmit(): void {
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
        this.updateCategory(this.editingCategoryId, formData);
      } else {
        this.createCategory(formData);
      }
    } else {
      Object.keys(this.categoryForm.controls).forEach(key => {
        const control = this.categoryForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  private createCategory(formData: any): void {
    this.apiService.post('categories', formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.isSubmitting = false;
          alert(this.languageService.translate('common.error'));
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response) {
            this.onCategoryCreated(response);
          }
          this.isSubmitting = false;
        },
        error: (error) => {
          this.isSubmitting = false;
          alert(this.languageService.translate('common.error'));
        }
      });
  }

  onCategoryCreated(apiResponse: any): void {
    this.isCreateModalVisible = false;
    const categoryName = apiResponse.name || apiResponse.data?.name || 'New Category';
    const msg = this.languageService.translate('ticketCategories.messages.createSuccess', { name: categoryName });
    alert(msg);
    this.loadCategoryData(true);
  }

  editCategory(categoryId: number): void {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    this.isCreateModalVisible = true;
    this.isEditMode = true;
    this.editingCategoryId = categoryId;
    
    this.categoryForm.patchValue({
      nameTh: this.getCategoryNameByLanguage(category.languages || [], 'th'),
      nameEn: this.getCategoryNameByLanguage(category.languages || [], 'en')
    });
  }

  private updateCategory(categoryId: number, formData: any): void {
    this.apiService.patch(`category/update/${categoryId}`, formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.isSubmitting = false;
          alert(this.languageService.translate('common.error'));
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response) {
            this.onCategoryUpdated(response);
          }
          this.isSubmitting = false;
        },
        error: (error) => {
          this.isSubmitting = false;
          alert(this.languageService.translate('common.error'));
        }
      });
  }

  onCategoryUpdated(apiResponse: any): void {
    this.isCreateModalVisible = false;
    this.isEditMode = false;
    this.editingCategoryId = null;
    
    const categoryName = apiResponse.name || apiResponse.data?.name || 'Category';
    const msg = this.languageService.translate('ticketCategories.messages.updateSuccess', { name: categoryName });
    alert(msg);
    this.loadCategoryData(true);
  }

  deleteCategory(categoryId: number): void {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    const confirmMessage = this.languageService.translate('ticketCategories.messages.deleteConfirm', { name: category.name });

    if (confirm(confirmMessage)) {
      this.performDeleteCategory(categoryId, category.name);
    }
  }

  private performDeleteCategory(categoryId: number, categoryName: string): void {
    this.isLoading = true;

    this.apiService.delete(`category/delete/${categoryId}`)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          this.isLoading = false;
          const msg = this.languageService.translate('ticketCategories.messages.deleteError', { name: categoryName });
          alert(msg);
          return of(null);
        })
      )
      .subscribe({
        next: (response) => {
          if (response !== null) {
            const msg = this.languageService.translate('ticketCategories.messages.deleteSuccess', { name: categoryName });
            alert(msg);
            this.loadCategoryData(true);
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
        }
      });
  }

  refreshData(): void {
    this.loadCategoryData(true);
  }

  canManageCategories(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_CATEGORY as any) ||
      this.authService.isAdmin();
  }

  canEditCategory(category: CategoryItem | null): boolean {
    if (this.authService.isAdmin()) return true;
    return this.authService.hasPermission(permissionEnum.MANAGE_CATEGORY as any);
  }

  canDeleteCategory(category: CategoryItem | null): boolean {
    if (this.authService.isAdmin()) return true;
    return this.authService.hasPermission(permissionEnum.MANAGE_CATEGORY as any);
  }

  canCreateCategory(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_CATEGORY as any) ||
      this.authService.isAdmin();
  }

  trackByCategoryId(index: number, category: CategoryItem): number {
    return category.id;
  }

  getStatsDisplay(): {
    total: string;
    totalTickets: string;
    newThisMonth: string;
    avgTicketsPerCategory: string;
  } {
    return {
      total: this.languageService.formatNumber(this.categoryStats.total),
      totalTickets: this.languageService.formatNumber(this.categoryStats.totalTickets),
      newThisMonth: this.languageService.formatNumber(this.categoryStats.newThisMonth),
      avgTicketsPerCategory: this.languageService.formatNumber(this.categoryStats.avgTicketsPerCategory)
    };
  }

  getPermissionRequiredMessage(): string {
    return this.languageService.translate('ticketCategories.permissionDenied');
  }

  showPermissionDeniedMessage(action: string): void {
    const msg = this.getPermissionRequiredMessage();
    alert(msg);
  }

  onCreateNewCategory(): void {
    if (!this.canCreateCategory()) {
      this.showPermissionDeniedMessage('Create Category');
      return;
    }
    this.createNewCategory();
  }

  onEditCategory(categoryId: number): void {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    if (!this.canEditCategory(category)) {
      this.showPermissionDeniedMessage('Edit Category');
      return;
    }
    this.editCategory(categoryId);
  }

  onDeleteCategory(categoryId: number): void {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) return;

    if (!this.canDeleteCategory(category)) {
      this.showPermissionDeniedMessage('Delete Category');
      return;
    }
    this.deleteCategory(categoryId);
  }
}