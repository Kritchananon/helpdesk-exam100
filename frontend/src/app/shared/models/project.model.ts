// ===== Base Project Interface =====
export interface Project {
  id: number;
  name: string;
  description?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  create_date?: string;
  create_by?: number;
  update_date?: string;
  update_by?: number;
  isenabled?: boolean;
}

// ===== Project DDL (Dropdown List) Interface =====
export interface ProjectDDL {
  id: number;
  projectName?: string; // API ใหม่
  name?: string;        // API เก่า - fallback
  status?: string;
  isenabled?: boolean;
  start_date?: string;
  end_date?: string;
}

// ===== API Request/Response Interfaces =====
export interface ProjectDDLRequest {
  status?: 'active' | 'inactive' | 'all';
  include_dates?: boolean;
}

export interface ProjectDDLResponse {
  code: number;
  message: string;
  data: ProjectDDL[];
  status?: boolean;
  total?: number;
}

// ===== Extended Project with Additional Info =====
export interface ProjectWithDetails extends ProjectDDL {
  customer_id?: number;
  customer_name?: string;
  project_manager?: string;
  team_members?: string[];
  progress_percentage?: number;
  total_tickets?: number;
  completed_tickets?: number;
}

// ===== Project Form Data =====
export interface ProjectFormData {
  id?: number;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  start_date?: string;
  end_date?: string;
  customer_id?: number;
}

// ===== Project Filter Options =====
export interface ProjectFilterOptions {
  status?: 'active' | 'inactive' | 'all';
  search?: string;
  customer_id?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

// ===== Project Selection Event =====
export interface ProjectSelectionEvent {
  project: ProjectDDL | null;
  projectId: number | string;
}

// ===== Project Validation =====
export interface ProjectValidation {
  isValid: boolean;
  errors: {
    name?: string;
    status?: string;
    start_date?: string;
    end_date?: string;
    general?: string;
  };
}

// ===== Project Statistics =====
export interface ProjectStatistics {
  project_id: number;
  project_name: string;
  total_tickets: number;
  pending_tickets: number;
  in_progress_tickets: number;
  completed_tickets: number;
  cancelled_tickets: number;
  completion_rate: number;
}

// ===== Helper Types =====
export type ProjectStatus = 'active' | 'inactive' | 'all';
export type ProjectDisplayFormat = 'name-only' | 'with-code' | 'with-status' | 'with-dates';

// ===== Type Guards =====
export function isProjectStatus(value: string): value is ProjectStatus {
  return ['active', 'inactive', 'all'].includes(value);
}

// ===== Default Values =====
export const DEFAULT_PROJECT_DDL_REQUEST: ProjectDDLRequest = {
  status: 'active',
  include_dates: false
};

export const PROJECT_STATUS_OPTIONS = [
  { value: 'active', label: 'ใช้งาน', labelEn: 'Active' },
  { value: 'inactive', label: 'ไม่ใช้งาน', labelEn: 'Inactive' },
  { value: 'all', label: 'ทั้งหมด', labelEn: 'All' }
] as const;

// ===== Helper Functions =====
export function getProjectDisplayName(project: ProjectDDL): string {
  return project.projectName || project.name || 'Unknown Project';
}

export function isProjectActive(project: ProjectDDL): boolean {
  return project.status === 'active' && project.isenabled !== false;
}

export function isProjectExpired(project: ProjectDDL): boolean {
  if (!project.end_date) return false;
  const endDate = new Date(project.end_date);
  const today = new Date();
  return endDate < today;
}

export function formatProjectForDisplay(
  project: ProjectDDL, 
  format: ProjectDisplayFormat = 'name-only'
): string {
  const name = getProjectDisplayName(project);
  
  switch (format) {
    case 'with-code':
      return `[${project.id}] ${name}`;
    case 'with-status':
      return `${name} (${project.status || 'unknown'})`;
    case 'with-dates':
      if (project.start_date && project.end_date) {
        const startDate = new Date(project.start_date).toLocaleDateString('th-TH');
        const endDate = new Date(project.end_date).toLocaleDateString('th-TH');
        return `${name} (${startDate} - ${endDate})`;
      }
      return name;
    case 'name-only':
    default:
      return name;
  }
}

export function getProjectStatusBadgeClass(status: string): string {
  switch (status) {
    case 'active':
      return 'badge bg-success';
    case 'inactive':
      return 'badge bg-secondary';
    default:
      return 'badge bg-light text-dark';
  }
}

export function calculateProjectProgress(project: ProjectWithDetails): number {
  if (!project.total_tickets || project.total_tickets === 0) return 0;
  return Math.round(((project.completed_tickets || 0) / project.total_tickets) * 100);
}

// ===== Project Validation Functions =====
export function validateProjectForm(data: ProjectFormData): ProjectValidation {
  const errors: ProjectValidation['errors'] = {};
  
  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'กรุณาระบุชื่อโปรเจค';
  } else if (data.name.trim().length < 3) {
    errors.name = 'ชื่อโปรเจคต้องมีอย่างน้อย 3 ตัวอักษร';
  }
  
  if (!data.status) {
    errors.status = 'กรุณาเลือกสถานะ';
  }
  
  if (data.start_date && data.end_date) {
    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    
    if (endDate <= startDate) {
      errors.end_date = 'วันที่สิ้นสุดต้องมากกว่าวันที่เริ่มต้น';
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}