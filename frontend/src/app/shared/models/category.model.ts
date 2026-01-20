// ===== Base Category Interface =====
export interface Category {
  id: number;
  name: string;
  description?: string;
  status?: string;
  create_date?: string;
  create_by?: number;
  update_date?: string;
  update_by?: number;
  isenabled?: boolean;
}

// ===== Category DDL (Dropdown List) Interface =====
export interface CategoryDDL {
  id: number;
  categoryName?: string; // API ใหม่
  name?: string;         // API เก่า - fallback
  language_id: number;
  status?: string;
  isenabled?: boolean;
}

export interface cateDDL {
  id: number;
  name: string;           // ต้องมี
  language_id: number;    // ต้องมี
}

// ===== API Request/Response Interfaces =====
export interface CategoryDDLRequest {
  status?: 'active' | 'inactive' | 'all';
}

export interface CategoryDDLResponse {
  code: number;
  message: string;
  data: CategoryDDL[];
  success?: boolean;
}

// ===== Extended Category with Language Support =====
export interface CategoryWithLang extends CategoryDDL {
  categoryLang?: {
    name: string;
    language: string;
  }[];
}

// ===== Category Form Data =====
export interface CategoryFormData {
  id?: number;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
}

// ===== Category Filter Options =====
export interface CategoryFilterOptions {
  status?: 'active' | 'inactive' | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

// ===== Category Selection Event =====
export interface CategorySelectionEvent {
  category: CategoryDDL | null;
  categoryId: number | string;
}

// ===== Category Validation =====
export interface CategoryValidation {
  isValid: boolean;
  errors: {
    name?: string;
    status?: string;
    general?: string;
  };
}

// ===== Helper Types =====
export type CategoryStatus = 'active' | 'inactive' | 'all';
export type CategoryDisplayFormat = 'name-only' | 'with-code' | 'with-status';

// ===== Type Guards =====
export function isCategoryStatus(value: string): value is CategoryStatus {
  return ['active', 'inactive', 'all'].includes(value);
}

// ===== Default Values =====
export const DEFAULT_CATEGORY_DDL_REQUEST: CategoryDDLRequest = {
  status: 'active'
};

export const CATEGORY_STATUS_OPTIONS = [
  { value: 'active', label: 'ใช้งาน', labelEn: 'Active' },
  { value: 'inactive', label: 'ไม่ใช้งาน', labelEn: 'Inactive' },
  { value: 'all', label: 'ทั้งหมด', labelEn: 'All' }
] as const;

// ===== Helper Functions =====
export function getCategoryDisplayName(category: CategoryDDL): string {
  return `${category.categoryName}` || `${category.name}`;
}

export function isCategoryActive(category: CategoryDDL): boolean {
  return category.status === 'active' && category.isenabled !== false;
}

export function formatCategoryForDisplay(
  category: CategoryDDL, 
  format: CategoryDisplayFormat = 'name-only'
): string {
  const name = getCategoryDisplayName(category);
  
  switch (format) {
    case 'with-code':
      return `[${category.id}] ${name}`;
    case 'with-status':
      return `${name} (${category.status || 'unknown'})`;
    case 'name-only':
    default:
      return name;
  }
}