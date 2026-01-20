import { Component, OnInit, Input, Output, EventEmitter, OnDestroy, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CategoryService } from '../../services/category.service';
import { CategoryDDL, CategoryStatus, isCategoryStatus, cateDDL } from '../../models/category.model';
import { LanguageService } from '../../services/language.service'; // Import LanguageService

@Component({
  selector: 'app-category-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './category-dropdown.component.html',
  styleUrls: ['./category-dropdown.component.css']
})
export class CategoryDropdownComponent implements OnInit, OnDestroy, OnChanges {
  private categoryService = inject(CategoryService);
  private languageService = inject(LanguageService);

  @Input() label: string = 'เลือกหมวดหมู่';
  @Input() placeholder: string = '-- เลือกหมวดหมู่ --';
  @Input() selectedCategoryId: number | string = '';
  @Input() status: string = 'active';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;
  @Input() showCode: boolean = false;
  @Input() errorText: string = '';

  @Output() selectionChange = new EventEmitter<{
    category: CategoryDDL | null,
    categoryId: number | string
  }>();

  categories: CategoryDDL[] = [];         // ข้อมูลดิบทั้งหมด
  filteredCategories: CategoryDDL[] = []; // ข้อมูลที่กรองตามภาษาแล้ว
  
  loading = false;
  error: string = '';
  hasError = false;

  private destroy$ = new Subject<void>();
  private langSubscription?: Subscription;
  private isDataLoaded = false;

  ngOnInit(): void {
    this.setupLanguageSubscription();
    this.loadCategories();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedCategoryId']) {
      const currentValue = changes['selectedCategoryId'].currentValue;
      const previousValue = changes['selectedCategoryId'].previousValue;
      
      if (!changes['selectedCategoryId'].firstChange && currentValue !== previousValue) {
        if (this.isDataLoaded && this.categories.length > 0) {
          this.syncSelection();
        }
      }
    }

    if (changes['status'] && !changes['status'].firstChange) {
      this.loadCategories();
    }
  }

  private setupLanguageSubscription(): void {
    this.langSubscription = this.languageService.currentLanguage$.subscribe(lang => {
      this.filterCategoriesByLanguage(lang);
    });
  }

  // ✅ ฟังก์ชันกรองภาษา (ฉบับแก้ไขสำหรับข้อมูล th/en)
  private filterCategoriesByLanguage(langCode: string): void {
    if (!this.categories || this.categories.length === 0) {
      this.filteredCategories = [];
      return;
    }

    // แปลงภาษาปัจจุบันเป็นพิมพ์เล็ก (เช่น 'th', 'en')
    const currentLang = (langCode || '').toLowerCase();

    // กรองข้อมูลโดยเทียบ String ตรงๆ
    this.filteredCategories = this.categories.filter(cat => {
      // แปลงค่าใน DB เป็น String และพิมพ์เล็ก (เผื่อ DB ส่งมาเป็นตัวพิมพ์ใหญ่ หรือ NULL)
      const catLang = String(cat.language_id || '').toLowerCase();
      
      // เลือกถ้าค่าตรงกัน (th == th, en == en)
      return catLang === currentLang;
    });

    console.log(`✅ Filtered Categories: Found ${this.filteredCategories.length} items for language '${currentLang}'`);

    // ✨ Fallback: ถ้ากรองแล้วไม่เจออะไรเลย ให้แสดงทั้งหมด
    if (this.filteredCategories.length === 0) {
      this.filteredCategories = this.categories;
    }
    
    this.syncSelection();
  }

  loadCategories(): void {
    this.loading = true;
    this.error = '';
    this.hasError = false;
    this.isDataLoaded = false;

    const statusValue: CategoryStatus = isCategoryStatus(this.status) ? this.status : 'active';

    this.categoryService.getCategoriesDDLWithCache({ status: statusValue })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.code === 1) {
            this.categories = response.data;
            this.error = '';
            this.isDataLoaded = true;

            // กรองข้อมูลทันทีเมื่อโหลดเสร็จ
            const currentLang = this.languageService.getCurrentLanguage();
            this.filterCategoriesByLanguage(currentLang);
          } else {
            this.error = response.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
            this.categories = [];
            this.filteredCategories = [];
          }
          this.loading = false;
        },
        error: (err) => {
          this.categoryService.getCachedCategories(statusValue)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (cachedData) => {
                if (cachedData && cachedData.length > 0) {
                  this.categories = cachedData;
                  this.error = '';
                  this.isDataLoaded = true;
                  this.showOfflineIndicator();
                  
                  const currentLang = this.languageService.getCurrentLanguage();
                  this.filterCategoriesByLanguage(currentLang);
                } else {
                  this.error = typeof err === 'string' ? err : 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
                  this.categories = [];
                  this.filteredCategories = [];
                }
                this.loading = false;
              },
              error: () => {
                this.categories = [];
                this.filteredCategories = [];
                this.loading = false;
              }
            });
        }
      });
  }

  private syncSelection(): void {
    if (!this.selectedCategoryId || this.selectedCategoryId === '') {
      return;
    }

    const selectedCategory = this.filteredCategories.find(c => c.id === +this.selectedCategoryId);
    
    if (selectedCategory) {
      setTimeout(() => {
        const selectElement = document.getElementById('categorySelect') as HTMLSelectElement;
        if (selectElement) {
          selectElement.value = String(this.selectedCategoryId);
        }
      }, 0);
    }
  }

  private showOfflineIndicator(): void {
    const offlineMsg = 'ใช้ข้อมูลที่เก็บไว้ (ออฟไลน์)';
    setTimeout(() => {
      const event = new CustomEvent('pwa-offline-data', {
        detail: { component: 'category-dropdown', message: offlineMsg }
      });
      window.dispatchEvent(event);
    }, 100);
  }

  onSelectionChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const categoryId = target.value;
    let selectedCategory: CategoryDDL | null = null;

    if (categoryId) {
      selectedCategory = this.filteredCategories.find(c => c.id === +categoryId) || null;
    }

    if (categoryId && this.hasError) {
      this.hasError = false;
    }

    this.selectedCategoryId = categoryId;
    this.selectionChange.emit({
      category: selectedCategory,
      categoryId: categoryId
    });
  }

  refresh(): void {
    this.loadCategories();
  }

  validate(): boolean {
    if (this.required && !this.selectedCategoryId) {
      this.hasError = true;
      return false;
    }
    this.hasError = false;
    return true;
  }

  getCategoryDisplayName(category: CategoryDDL): string {
    return `${category.categoryName}` || `${category.name}`;
  }

  getCategoryDDL(category: CategoryDDL): string {
    const c: cateDDL = {
      id: category.id,
      name: category.categoryName ?? category.name ?? '',
      language_id: category.language_id
    };
    return c.name;
  }

  reset(): void {
    this.selectedCategoryId = '';
    this.hasError = false;
    this.selectionChange.emit({
      category: null,
      categoryId: ''
    });
  }

  public forceSync(): void {
    if (this.isDataLoaded && this.categories.length > 0) {
      const currentLang = this.languageService.getCurrentLanguage();
      this.filterCategoriesByLanguage(currentLang);
    }
  }

  get isInvalid(): boolean {
    return this.hasError;
  }
}