import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

// เพิ่ม imports ที่จำเป็น
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';

// Project interface - อัปเดตให้ตรงกับ backend response
export interface ProjectItem {
  id: number;
  name: string;
  description?: string;
  company?: string;
  company_id?: number;
  status: boolean; // เปลี่ยนเป็น boolean ตาม backend
  created_date?: string;
  created_by?: number;
  create_by?: number; // รองรับทั้งสอง field name
  updated_date?: string;
  updated_by?: number;
  start_date?: string;
  end_date?: string;
}

// Create Project DTO interface - ตรงกับ backend
export interface CreateProjectDto {
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status: boolean; // เปลี่ยนเป็น boolean
  create_by?: number; // จะถูกเพิ่มใน backend
}

// Update Project DTO interface
export interface UpdateProjectDto {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: boolean; // เปลี่ยนเป็น boolean
}

@Component({
  selector: 'app-project-add',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './project.component.html',
  styleUrls: ['./project.component.css']
})
export class ProjectComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // Loading and error states
  isLoading = false;
  hasError = false;
  errorMessage = '';

  // Search and filter properties
  searchTerm: string = '';
  selectedCompany: string = 'all';

  // Company options for filter
  companies = [
    { value: 'all', label: 'All Companies' },
    { value: 'tech-solutions', label: 'Tech Solutions Co., Ltd.' },
    { value: 'digital-marketing', label: 'Digital Marketing Inc.' },
    { value: 'innovation-hub', label: 'Innovation Hub Ltd.' },
    { value: 'creative-agency', label: 'Creative Agency Co.' },
    { value: 'startup-ventures', label: 'Startup Ventures Co.' }
  ];

  // Project data
  projects: ProjectItem[] = [];
  filteredProjects: ProjectItem[] = [];

  // Project stats
  projectStats = {
    total: 0,
    active: 0,
    inactive: 0,
    newThisMonth: 0
  };

  // Modal-related properties
  isCreateModalVisible = false;
  isSubmitting = false;
  projectForm!: FormGroup;

  // Properties สำหรับ edit mode
  editingProjectId: number | null = null;
  isEditMode: boolean = false;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private fb: FormBuilder
  ) { 
    this.initForm();
  }

  ngOnInit(): void {
    this.loadProjectData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Get current language setting (can be extended to use translation service)
   */
  private getCurrentLanguage(): string {
    // ตรวจสอบจาก localStorage, user settings, หรือ browser language
    return localStorage.getItem('language') || 
           document.documentElement.lang || 
           'th'; // default to Thai
  }

  /**
   * Get status display text based on language
   */
  getStatusText(status: boolean): string {
    const language = this.getCurrentLanguage();
    
    if (language === 'en') {
      return status ? 'Active' : 'Inactive';
    } else {
      // Thai language
      return status ? 'ใช้งาน' : 'ไม่ใช้งาน';
    }
  }

  /**
   * Convert boolean status to string for internal use (if needed)
   */
  private booleanToStatusString(status: boolean): 'active' | 'inactive' {
    return status ? 'active' : 'inactive';
  }

  /**
   * Convert string status to boolean for API calls
   */
  private statusStringToBoolean(status: string): boolean {
    return status === 'active';
  }

  /**
   * Initialize form for modal
   */
  private initForm(): void {
    this.projectForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: [''],
      start_date: [''],
      end_date: [''],
      status: [true, [Validators.required]] // เปลี่ยนเป็น boolean และ default เป็น true (active)
    });

    console.log('Form initialized:', this.projectForm);
  }

  /**
   * Check if field is invalid
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.projectForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get description length
   */
  getDescriptionLength(): number {
    const descValue = this.projectForm.get('description')?.value;
    return descValue ? descValue.length : 0;
  }

  /**
   * โหลดข้อมูล Project จาก API
   */
  loadProjectData(forceRefresh: boolean = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    console.log('Loading project data from API...');

    // เรียก API endpoint /api/get_all_project
    this.apiService.get('get_all_project')
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading project data:', error);
          this.handleApiError(error);
          return of([]);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          
          if (Array.isArray(response)) {
            // กรณีที่ API ส่ง array โดยตรง
            this.projects = response as ProjectItem[];
            console.log('Projects loaded (direct array):', this.projects);
            this.filterProjects();
            this.loadProjectStats();
          } else if (response && response.data && Array.isArray(response.data)) {
            // กรณีที่ API ส่ง response ใน format { success?, data: ProjectItem[] }
            this.projects = response.data as ProjectItem[];
            console.log('Projects loaded (wrapped response):', this.projects);
            this.filterProjects();
            this.loadProjectStats();
          } else {
            this.handleEmptyResponse();
          }
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.isLoading = false;
          this.handleApiError(error);
        }
      });
  }

  /**
   * จัดการ API Error
   */
  private handleApiError(error: HttpErrorResponse): void {
    this.hasError = true;
    this.isLoading = false;

    if (error.status === 401) {
      this.errorMessage = 'Authentication required. Please log in again.';
      // อาจจะ redirect ไป login page
      this.authService.logout();
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      this.errorMessage = 'You do not have permission to view projects.';
    } else if (error.status === 0) {
      this.errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.status >= 500) {
      this.errorMessage = 'Server error occurred. Please try again later.';
    } else {
      this.errorMessage = error.error?.message || error.message || 'Failed to load project data. Please try again.';
    }

    // Load fallback data ในกรณี development
    if (this.isDevelopmentMode()) {
      console.warn('Loading fallback data due to API error in development mode');
      this.loadFallbackData();
    }
  }

  /**
   * จัดการกรณีที่ได้ response ว่าง
   */
  private handleEmptyResponse(): void {
    this.projects = [];
    this.filteredProjects = [];
    this.loadProjectStats();
    console.log('Empty response received from API');
  }

  /**
   * ตรวจสอบว่าอยู่ใน development mode หรือไม่
   */
  private isDevelopmentMode(): boolean {
    return true; // สามารถปรับเป็น false หรือใช้ environment variable
  }

  /**
   * โหลดสถิติโปรเจค
   */
  loadProjectStats(): void {
    // คำนวณจากข้อมูลที่มีอยู่ โดยใช้ boolean status
    this.projectStats = {
      total: this.projects.length,
      active: this.projects.filter(p => p.status === true).length,
      inactive: this.projects.filter(p => p.status === false).length,
      newThisMonth: this.calculateNewThisMonth()
    };
    console.log('Project stats calculated:', this.projectStats);
  }

  /**
   * คำนวณจำนวนโปรเจคใหม่ในเดือนนี้
   */
  private calculateNewThisMonth(): number {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    return this.projects.filter(project => {
      if (!project.created_date) return false;
      
      const createdDate = new Date(project.created_date);
      return createdDate.getMonth() === currentMonth && 
             createdDate.getFullYear() === currentYear;
    }).length;
  }

  /**
   * Mock data สำหรับทดสอب - เอาออกได้ในโปรดักชัน
   */
  private getMockProjectData(): ProjectItem[] {
    return [
      {
        id: 1,
        name: 'Support Ticket System',
        description: 'Customer support ticketing system',
        status: true,
        created_date: '2024-01-15T00:00:00Z',
        create_by: 1,
        updated_date: '2025-08-27T14:30:00Z',
        updated_by: 1,
        start_date: '2024-01-15',
        end_date: '2025-12-31'
      },
      {
        id: 2,
        name: 'Digital Marketing Platform',
        description: 'Comprehensive marketing automation platform',
        status: true,
        created_date: '2024-03-10T00:00:00Z',
        create_by: 1,
        updated_date: '2025-08-27T09:15:00Z',
        updated_by: 1,
        start_date: '2024-03-10',
        end_date: '2025-06-30'
      }
    ];
  }

  /**
   * โหลดข้อมูล fallback เมื่อ API ล้มเหลว
   */
  private loadFallbackData(): void {
    this.projects = this.getMockProjectData();
    this.filterProjects();
    this.hasError = false; // ซ่อน error state เมื่อใช้ fallback
    console.log('Fallback data loaded');
  }

  /**
   * Filter projects based on search term and company
   */
  filterProjects(): void {
    this.filteredProjects = this.projects.filter(project => {
      const matchesSearch = this.searchTerm === '' ||
        this.matchesSearchTerm(project, this.searchTerm.toLowerCase());

      const matchesCompany = this.selectedCompany === 'all' ||
        this.matchesCompanyFilter(project, this.selectedCompany);

      return matchesSearch && matchesCompany;
    });

    console.log('Filtered projects:', this.filteredProjects.length, 'of', this.projects.length);
  }

  /**
   * ตรวจสอบว่าตรงกับคำค้นหาหรือไม่
   */
  private matchesSearchTerm(project: ProjectItem, searchTerm: string): boolean {
    const searchableFields = [
      project.name || '',
      project.description || '',
      this.getStatusText(project.status) || '' // แปลง boolean เป็น string
    ];

    return searchableFields.some(field =>
      field.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * ตรวจสอบว่าตรงกับ filter บริษัทหรือไม่
   */
  private matchesCompanyFilter(project: ProjectItem, companyValue: string): boolean {
    // เนื่องจากไม่มี company field แล้ว ให้ return true เสมอ
    return true;
  }

  /**
   * Get company name from value
   */
  getCompanyName(value: string): string {
    const company = this.companies.find(c => c.value === value);
    return company ? company.label : '';
  }

  /**
   * Handle search input change
   */
  onSearchChange(): void {
    this.filterProjects();
  }

  /**
   * Handle company filter change
   */
  onCompanyChange(): void {
    this.filterProjects();
  }

  // ============ MODAL METHODS ============

  /**
   * เปิด Modal สำหรับสร้างโปรเจคใหม่
   */
  createNewProject(): void {
    console.log('Opening create new project modal');
    this.isCreateModalVisible = true;
    this.resetForm();
  }

  /**
   * ปิด Modal
   */
  onModalClose(): void {
    console.log('Create project modal closed');
    if (!this.isSubmitting) {
      this.resetForm();
      this.isCreateModalVisible = false;
    }
  }

  /**
   * Handle backdrop click
   */
  onBackdropClick(): void {
    if (!this.isSubmitting) { // เพิ่มการตรวจสอบว่าไม่อยู่ระหว่าง submit
      this.onFormModalClose();
    }
  }

  /**
   * Reset form
   */
  private resetForm(): void {
    this.projectForm.reset({
      status: 'active'
    });
    this.isSubmitting = false;
    console.log('Form reset');
  }

  /**
   * Handle form submission - เชื่อมต่อกับ API
   */
  onSubmit(): void {
    console.log('Form submitted');
    console.log('Form valid:', this.projectForm.valid);
    console.log('Form value:', this.projectForm.value);

    if (this.projectForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      console.log('Creating project via API...');
      
      const formData: CreateProjectDto = {
        name: this.projectForm.get('name')?.value.trim(),
        description: this.projectForm.get('description')?.value?.trim() || undefined,
        start_date: this.projectForm.get('start_date')?.value || undefined,
        end_date: this.projectForm.get('end_date')?.value || undefined,
        status: this.projectForm.get('status')?.value // ค่าจะเป็น boolean แล้ว
      };

      // เรียก API endpoint /api/projects
      this.apiService.post('projects', formData)
        .pipe(
          takeUntil(this.destroy$),
          catchError((error: HttpErrorResponse) => {
            console.error('Error creating project:', error);
            this.handleCreateProjectError(error);
            return of(null);
          })
        )
        .subscribe({
          next: (response: any) => {
            this.isSubmitting = false;
            
            if (response === null) {
              // Error already handled in catchError
              return;
            }

            let createdProject: ProjectItem | null = null;

            // ตรวจสอบว่า response มี structure แบบไหน
            if (response && response.data && typeof response.data === 'object' && response.data.id) {
              // กรณี API ส่ง response ใน format { success?, data: ProjectItem }
              createdProject = response.data as ProjectItem;
              console.log('Project created (wrapped response):', createdProject);
            } else if (response && typeof response === 'object' && response.id) {
              // กรณี API ส่ง ProjectItem โดยตรง
              createdProject = response as ProjectItem;
              console.log('Project created (direct response):', createdProject);
            }

            if (createdProject) {
              this.onProjectCreated(createdProject);
            } else {
              this.showErrorMessage('Failed to create project. Please try again.');
            }
          },
          error: (error) => {
            console.error('Subscription error:', error);
            this.isSubmitting = false;
            this.handleCreateProjectError(error);
          }
        });
    } else {
      console.log('Form invalid, marking all fields as touched');
      Object.keys(this.projectForm.controls).forEach(key => {
        const control = this.projectForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  /**
   * จัดการ error ในการสร้างโปรเจค
   */
  private handleCreateProjectError(error: HttpErrorResponse): void {
    this.isSubmitting = false;
    
    let errorMessage = 'Failed to create project. Please try again.';
    
    if (error.status === 401) {
      errorMessage = 'Authentication required. Please log in again.';
      this.authService.logout();
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to create projects.';
    } else if (error.status === 400) {
      // Validation errors
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.error?.errors) {
        // Handle validation errors array
        const errors = error.error.errors;
        errorMessage = Array.isArray(errors) ? errors.join(', ') : errors;
      }
    } else if (error.status >= 500) {
      errorMessage = 'Server error occurred. Please try again later.';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    this.showErrorMessage(errorMessage);
  }

  /**
   * จัดการการสร้างโปรเจคใหม่จาก Modal สำเร็จ
   */
  onProjectCreated(newProject: ProjectItem): void {
    console.log('New project created:', newProject);
    
    // เพิ่มเข้า projects array
    this.projects.unshift(newProject);
    this.filterProjects();
    this.loadProjectStats();

    // ปิด modal
    this.isCreateModalVisible = false;

    // แสดงข้อความสำเร็จ
    this.showSuccessMessage(`Project "${newProject.name}" has been created successfully!`);
  }

  /**
   * แสดงข้อความสำเร็จ
   */
  private showSuccessMessage(message: string): void {
    // คุณสามารถแทนที่ด้วย toast notification service
    alert(message);
    console.log('Success:', message);
  }

  /**
   * แสดงข้อความ error
   */
  private showErrorMessage(message: string): void {
    alert(message);
    console.error('Error:', message);
  }

  /**
   * Edit project - Navigate to edit page หรือเปิด modal แก้ไข
   */
  editProject(projectId: number): void {
    console.log('Navigating to edit project:', projectId);
    // ตัวเลือก 1: Navigate ไป edit page
    this.router.navigate(['/settings/project-edit', projectId]);
    
    // ตัวเลือก 2: เปิด modal แก้ไข (ถ้าต้องการ)
    // this.openEditModal(projectId);
  }

  /**
   * Delete project with confirmation - เชื่อมต่อกับ API
   */
  deleteProject(projectId: number): void {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) {
      console.error('Project not found:', projectId);
      return;
    }

    const confirmMessage = `Are you sure you want to delete project "${project.name}"?\n\nThis action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.performDeleteProject(projectId, project.name);
    }
  }

  /**
   * ลบ project จริงผ่าน API - ใช้ API endpoint ที่ถูกต้อง
   */
  private performDeleteProject(projectId: number, projectName: string): void {
    console.log('Deleting project via API:', { projectId, projectName });

    this.isLoading = true;

    // เรียก API endpoint /api/project/delete/{id}
    this.apiService.delete(`project/delete/${projectId}`)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error deleting project:', error);
          this.handleDeleteProjectError(error, projectName);
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          
          if (response === null) {
            // Error already handled in catchError
            return;
          }

          // ลบออกจาก local array
          this.projects = this.projects.filter(p => p.id !== projectId);
          this.filterProjects();
          this.loadProjectStats();

          // แสดงข้อความสำเร็จ
          this.showSuccessMessage(`Project "${projectName}" has been deleted successfully.`);
          console.log('Project deleted successfully:', projectId);
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.isLoading = false;
          this.handleDeleteProjectError(error, projectName);
        }
      });
  }

  /**
   * จัดการ error ในการลบโปรเจค
   */
  private handleDeleteProjectError(error: HttpErrorResponse, projectName: string): void {
    this.isLoading = false;
    
    let errorMessage = `Failed to delete project "${projectName}". Please try again.`;
    
    if (error.status === 401) {
      errorMessage = 'Authentication required. Please log in again.';
      this.authService.logout();
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to delete this project.';
    } else if (error.status === 404) {
      errorMessage = 'Project not found. It may have been already deleted.';
      // ลบออกจาก local array เนื่องจากไม่มีแล้ว
      this.projects = this.projects.filter(p => p.name !== projectName);
      this.filterProjects();
      this.loadProjectStats();
    } else if (error.status >= 500) {
      errorMessage = 'Server error occurred. Please try again later.';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    this.showErrorMessage(errorMessage);
  }

  /**
   * รีเฟรชข้อมูล
   */
  refreshData(): void {
    console.log('Refreshing project data...');
    this.loadProjectData(true);
  }

  /**
   * ตรวจสอบสิทธิ์ในการจัดการโปรเจค
   */
  canManageProjects(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.isAdmin();
  }

  /**
   * ตรวจสอบสิทธิ์ในการแก้ไข
   */
  canEditProject(project: ProjectItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }

    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  /**
   * ตรวจสอบสิทธิ์ในการลบ
   */
  canDeleteProject(project: ProjectItem): boolean {
    if (this.authService.isAdmin()) {
      return true;
    }

    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  /**
   * ตรวจสอบสิทธิ์ในการสร้าง project ใหม่
   */
  canCreateProject(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.isAdmin();
  }

  /**
   * ตรวจสอบสิทธิ์ในการดู project ทั้งหมด
   */
  canViewAllProjects(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) ||
      this.authService.hasPermission(permissionEnum.VIEW_ALL_TICKETS) ||
      this.authService.isAdmin() ||
      this.authService.isSupporter();
  }

  /**
   * ตรวจสอบว่าเป็น project owner หรือไม่
   */
  isProjectOwner(project: ProjectItem): boolean {
    const currentUser = this.authService.getCurrentUser();
    const projectCreator = project.created_by || project.create_by;
    return currentUser !== null && projectCreator === currentUser.id;
  }

  /**
   * ตรวจสอบสิทธิ์แบบละเอียด
   */
  canPerformAction(action: 'create' | 'edit' | 'delete' | 'view', project?: ProjectItem): boolean {
    switch (action) {
      case 'create':
        return this.canCreateProject();
      
      case 'view':
        return this.canViewAllProjects();
      
      case 'edit':
        if (!project) return false;
        return this.canEditProject(project);
      
      case 'delete':
        if (!project) return false;
        return this.canDeleteProject(project);
      
      default:
        return false;
    }
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByProjectId(index: number, project: ProjectItem): number {
    return project.id;
  }

  /**
   * Format date for display
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
   * Get project status display
   */
  getProjectStatus(project: ProjectItem): string {
    if (project.end_date) {
      const endDate = new Date(project.end_date);
      const now = new Date();
      if (endDate < now) {
        const language = this.getCurrentLanguage();
        return language === 'en' ? 'Completed' : 'เสร็จสิ้น';
      }
    }

    return this.getStatusText(project.status);
  }

  /**
   * ตรวจสอบว่าควรแสดงสถานะเป็น warning หรือไม่
   */
  isProjectStatusWarning(project: ProjectItem): boolean {
    return project.status === false || this.getProjectStatus(project).includes('Completed') || this.getProjectStatus(project).includes('เสร็จสิ้น');
  }

  /**
   * แสดงข้อมูลสถิติ
   */
  getStatsDisplay(): {
    total: string;
    active: string;
    inactive: string;
    newThisMonth: string;
  } {
    return {
      total: this.projectStats.total.toLocaleString(),
      active: this.projectStats.active.toLocaleString(),
      inactive: this.projectStats.inactive.toLocaleString(),
      newThisMonth: this.projectStats.newThisMonth.toLocaleString()
    };
  }

  /**
   * ได้รับ permission description สำหรับแสดงผล
   */
  getPermissionRequiredMessage(): string {
    return 'ต้องมีสิทธิ์ "จัดการ project" เพื่อดำเนินการนี้';
  }

  /**
   * แสดงข้อความเมื่อไม่มีสิทธิ์
   */
  showPermissionDeniedMessage(action: string): void {
    this.showErrorMessage(`คุณไม่มีสิทธิ์ในการ${action}\n\n${this.getPermissionRequiredMessage()}`);
  }

  /**
   * Wrapper methods ที่มีการตรวจสอบสิทธิ์
   */
  onCreateNewProject(): void {
    if (!this.canCreateProject()) {
      this.showPermissionDeniedMessage('สร้าง project ใหม่');
      return;
    }
    this.createNewProject();
  }

  onEditProject(projectId: number): void {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    if (!this.canEditProject(project)) {
      this.showPermissionDeniedMessage('แก้ไข project');
      return;
    }
    this.editProject(projectId);
  }

  onDeleteProject(projectId: number): void {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    if (!this.canDeleteProject(project)) {
      this.showPermissionDeniedMessage('ลบ project');
      return;
    }
    this.deleteProject(projectId);
  }

  /**
   * อัปเดตโปรเจค - เชื่อมต่อกับ API
   */
  updateProject(projectId: number, updateData: UpdateProjectDto): void {
    console.log('Updating project via API:', { projectId, updateData });

    this.isSubmitting = true; // เปลี่ยนจาก isLoading เป็น isSubmitting

    // เรียก API endpoint /api/project/update/{id}
    this.apiService.patch(`project/update/${projectId}`, updateData)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error updating project:', error);
          this.handleUpdateProjectError(error);
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false; // Reset loading state
          
          if (response === null) {
            // Error already handled in catchError
            return;
          }

          let updatedProject: ProjectItem | null = null;

          // ตรวจสอบว่า response มี structure แบบไหน
          if (response && response.data && typeof response.data === 'object' && response.data.id) {
            // กรณี API ส่ง response ใน format { success?, data: ProjectItem }
            updatedProject = response.data as ProjectItem;
            console.log('Project updated (wrapped response):', updatedProject);
          } else if (response && typeof response === 'object' && response.id) {
            // กรณี API ส่ง ProjectItem โดยตรง
            updatedProject = response as ProjectItem;
            console.log('Project updated (direct response):', updatedProject);
          }

          if (updatedProject) {
            this.onProjectUpdatedWithModalClose(updatedProject); // ใช้ฟังก์ชันที่ปิด modal
          } else {
            this.showErrorMessage('Failed to update project. Please try again.');
          }
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.isSubmitting = false; // Reset loading state
          this.handleUpdateProjectError(error);
        }
      });
  }

  /**
   * จัดการ error ในการอัปเดตโปรเจค
   */
  private handleUpdateProjectError(error: HttpErrorResponse): void {
    this.isSubmitting = false; // เปลี่ยนจาก isLoading เป็น isSubmitting
    
    let errorMessage = 'Failed to update project. Please try again.';
    
    if (error.status === 401) {
      errorMessage = 'Authentication required. Please log in again.';
      this.authService.logout();
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to update this project.';
    } else if (error.status === 404) {
      errorMessage = 'Project not found. It may have been deleted.';
      // รีเฟรชข้อมูลเพื่อซิงค์กับ server
      this.loadProjectData();
    } else if (error.status === 400) {
      // Validation errors
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.error?.errors) {
        // Handle validation errors array
        const errors = error.error.errors;
        errorMessage = Array.isArray(errors) ? errors.join(', ') : errors;
      }
    } else if (error.status >= 500) {
      errorMessage = 'Server error occurred. Please try again later.';
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }

    this.showErrorMessage(errorMessage);
  }

  /**
   * จัดการการอัปเดตโปรเจคสำเร็จ
   */
  onProjectUpdated(updatedProject: ProjectItem): void {
    console.log('Project updated:', updatedProject);
    
    // อัปเดตใน projects array
    const index = this.projects.findIndex(p => p.id === updatedProject.id);
    if (index !== -1) {
      this.projects[index] = updatedProject;
      this.filterProjects();
      this.loadProjectStats();
    }

    // แสดงข้อความสำเร็จ
    this.showSuccessMessage(`Project "${updatedProject.name}" has been updated successfully!`);
  }

  /**
   * เปิด modal แก้ไขโปรเจค (ถ้าต้องการใช้ modal แทน navigate)
   */
  openEditModal(projectId: number): void {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) {
      console.error('Project not found:', projectId);
      return;
    }

    if (!this.canEditProject(project)) {
      this.showPermissionDeniedMessage('แก้ไข project');
      return;
    }

    // ตั้งค่า form ด้วยข้อมูลปัจจุบัน
    this.projectForm.patchValue({
      name: project.name,
      description: project.description || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      status: project.status // เป็น boolean แล้ว
    });

    // เก็บ ID ของโปรเจคที่กำลังแก้ไข
    this.editingProjectId = projectId;
    this.isCreateModalVisible = true;
    this.isEditMode = true;
  }

  /**
   * แก้ไข onSubmit เพื่อรองรับ edit mode
   */
  onSubmitWithEditSupport(): void {
    console.log('Form submitted');
    console.log('Form valid:', this.projectForm.valid);
    console.log('Form value:', this.projectForm.value);
    console.log('Is edit mode:', this.isEditMode);

    if (this.projectForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      if (this.isEditMode && this.editingProjectId) {
        // โหมดแก้ไข
        const updateData: UpdateProjectDto = {
          name: this.projectForm.get('name')?.value.trim(),
          description: this.projectForm.get('description')?.value?.trim() || undefined,
          start_date: this.projectForm.get('start_date')?.value || undefined,
          end_date: this.projectForm.get('end_date')?.value || undefined,
          status: this.projectForm.get('status')?.value // ค่าจะเป็น boolean แล้ว
        };

        this.updateProject(this.editingProjectId, updateData);
      } else {
        // โหมดสร้างใหม่
        const formData: CreateProjectDto = {
          name: this.projectForm.get('name')?.value.trim(),
          description: this.projectForm.get('description')?.value?.trim() || undefined,
          start_date: this.projectForm.get('start_date')?.value || undefined,
          end_date: this.projectForm.get('end_date')?.value || undefined,
          status: this.projectForm.get('status')?.value
        };

        this.createProjectViaApi(formData);
      }
    } else {
      console.log('Form invalid, marking all fields as touched');
      Object.keys(this.projectForm.controls).forEach(key => {
        const control = this.projectForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  /**
   * แยก logic การสร้างโปรเจคใหม่ออกมา
   */
  private createProjectViaApi(formData: CreateProjectDto): void {
    console.log('Creating project via API...');

    // เรียก API endpoint /api/projects
    this.apiService.post('projects', formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error creating project:', error);
          this.handleCreateProjectError(error);
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          
          if (response === null) {
            // Error already handled in catchError
            return;
          }

          let createdProject: ProjectItem | null = null;

          // ตรวจสอบว่า response มี structure แบบไหน
          if (response && response.data && typeof response.data === 'object' && response.data.id) {
            // กรณี API ส่ง response ใน format { success?, data: ProjectItem }
            createdProject = response.data as ProjectItem;
            console.log('Project created (wrapped response):', createdProject);
          } else if (response && typeof response === 'object' && response.id) {
            // กรณี API ส่ง ProjectItem โดยตรง
            createdProject = response as ProjectItem;
            console.log('Project created (direct response):', createdProject);
          }

          if (createdProject) {
            this.onProjectCreatedWithModalClose(createdProject);
          } else {
            this.showErrorMessage('Failed to create project. Please try again.');
          }
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.isSubmitting = false;
          this.handleCreateProjectError(error);
        }
      });
  }

  /**
   * Reset form
   */
  private resetFormWithEditSupport(): void {
    this.projectForm.reset({
      status: true // เปลี่ยน default เป็น true (active)
    });
    this.isSubmitting = false;
    this.isEditMode = false;
    this.editingProjectId = null;
    console.log('Form reset');
  }

  /**
   * แก้ไข onModalClose เพื่อรองรับ edit mode
   */
  onModalCloseWithEditSupport(): void {
    console.log('Modal closed');
    if (!this.isSubmitting) {
      this.resetFormWithEditSupport();
      this.isCreateModalVisible = false;
    }
  }

  /**
   * แก้ไข onProjectCreated เพื่อปิด modal
   */
  onProjectCreatedWithModalClose(newProject: ProjectItem): void {
    console.log('New project created:', newProject);
    
    // เพิ่มเข้า projects array
    this.projects.unshift(newProject);
    this.filterProjects();
    this.loadProjectStats();

    // ปิด modal และ reset form
    this.isCreateModalVisible = false;
    this.resetFormWithEditSupport();

    // แสดงข้อความสำเร็จ
    this.showSuccessMessage(`Project "${newProject.name}" has been created successfully!`);
  }

  /**
   * แก้ไข onProjectUpdated เพื่อปิด modal
   */
  onProjectUpdatedWithModalClose(updatedProject: ProjectItem): void {
    console.log('Project updated:', updatedProject);
    
    // อัปเดตใน projects array
    const index = this.projects.findIndex(p => p.id === updatedProject.id);
    if (index !== -1) {
      this.projects[index] = updatedProject;
      this.filterProjects();
      this.loadProjectStats();
    }

    // ปิด modal และ reset form
    this.isCreateModalVisible = false;
    this.resetFormWithEditSupport();

    // แสดงข้อความสำเร็จ
    this.showSuccessMessage(`Project "${updatedProject.name}" has been updated successfully!`);
  }

  /**
   * ใช้แทน onSubmit ใน template
   */
  onFormSubmit(): void {
    this.onSubmitWithEditSupport();
  }

  /**
   * ใช้แทน onModalClose ใน template
   */
  onFormModalClose(): void {
    this.onModalCloseWithEditSupport();
  }

  /**
   * ใช้แทน resetForm
   */
  resetProjectForm(): void {
    this.resetFormWithEditSupport();
  }

  /**
   * Get modal title based on mode
   */
  getModalTitle(): string {
    return this.isEditMode ? 'Edit Project' : 'Create New Project';
  }

  /**
   * Get submit button text based on mode
   */
  getSubmitButtonText(): string {
    if (this.isSubmitting) {
      return this.isEditMode ? 'Updating...' : 'Creating...';
    }
    return this.isEditMode ? 'Update Project' : 'Create Project';
  }
}