import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

// Services & Models
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';
import { LanguageService } from '../../../shared/services/language.service';

// Interfaces matching backend
export interface ProjectItem {
  id: number;
  name: string;
  description?: string;
  company?: string;
  company_id?: number;
  status: boolean;
  created_date?: string;
  created_by?: number;
  create_by?: number;
  updated_date?: string;
  updated_by?: number;
  start_date?: string;
  end_date?: string;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status: boolean;
  create_by?: number;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  status?: boolean;
}

// [NEW] Interface สำหรับ Notification
export interface NotificationMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
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

  // UI States
  isLoading = false;
  hasError = false;
  errorMessage = '';

  // Filter States
  searchTerm: string = '';
  selectedCompany: string = 'all';
  
  // Companies list to be dynamic for translation
  companies: { value: string, label: string }[] = [];

  // Data
  projects: ProjectItem[] = [];
  filteredProjects: ProjectItem[] = [];

  // Stats
  projectStats = {
    total: 0,
    active: 0,
    inactive: 0,
    newThisMonth: 0
  };

  // Modal & Form States
  isCreateModalVisible = false;
  isSubmitting = false;
  projectForm!: FormGroup;
  editingProjectId: number | null = null;
  isEditMode: boolean = false;

  // [NEW] ตัวแปรสำหรับเก็บสถานะ Notification
  notification: NotificationMessage | null = null;

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
    this.loadProjectData();

    // Subscribe to language changes to update local translations (like dropdowns)
    this.languageService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateLocalTranslations();
      });

    // Initial translation load
    this.updateLocalTranslations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Helper for template translation
   */
  t(key: string, params?: any): string {
    return this.languageService.translate(key, params);
  }

  /**
   * Update data that resides in TS code (Dropdowns, etc.)
   */
  private updateLocalTranslations(): void {
    this.companies = [
      { value: 'all', label: this.t('common.all') },
      { value: 'tech-solutions', label: 'Tech Solutions Co., Ltd.' },
      { value: 'digital-marketing', label: 'Digital Marketing Inc.' },
      { value: 'innovation-hub', label: 'Innovation Hub Ltd.' },
      { value: 'creative-agency', label: 'Creative Agency Co.' },
      { value: 'startup-ventures', label: 'Startup Ventures Co.' }
    ];
  }

  // --- Form & Validation ---

  private initForm(): void {
    this.projectForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: [''],
      start_date: [''],
      end_date: [''],
      status: [true, [Validators.required]]
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.projectForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getDescriptionLength(): number {
    const descValue = this.projectForm.get('description')?.value;
    return descValue ? descValue.length : 0;
  }

  private resetForm(): void {
    this.projectForm.reset({
      status: true
    });
    this.isSubmitting = false;
  }

  // --- Data Loading & Processing ---

  loadProjectData(forceRefresh: boolean = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

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
            this.projects = response as ProjectItem[];
            this.filterProjects();
            this.loadProjectStats();
          } else if (response && response.data && Array.isArray(response.data)) {
            this.projects = response.data as ProjectItem[];
            this.filterProjects();
            this.loadProjectStats();
          } else {
            this.handleEmptyResponse();
          }
        },
        error: (error) => {
          this.isLoading = false;
          this.handleApiError(error);
        }
      });
  }

  private handleApiError(error: HttpErrorResponse): void {
    this.hasError = true;
    this.isLoading = false;

    if (error.status === 401) {
      this.errorMessage = this.t('errors.unauthorized');
      this.authService.logout();
      this.router.navigate(['/login']);
    } else if (error.status === 403) {
      this.errorMessage = this.t('errors.forbidden');
    } else if (error.status === 0) {
      this.errorMessage = this.t('errors.networkError');
    } else if (error.status >= 500) {
      this.errorMessage = this.t('errors.serverError');
    } else {
      this.errorMessage = error.error?.message || error.message || this.t('errors.unknownError');
    }

    if (this.isDevelopmentMode()) {
      this.loadFallbackData();
    }
  }

  private handleEmptyResponse(): void {
    this.projects = [];
    this.filteredProjects = [];
    this.loadProjectStats();
  }

  private isDevelopmentMode(): boolean {
    return true;
  }

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
      }
    ];
  }

  private loadFallbackData(): void {
    this.projects = this.getMockProjectData();
    this.filterProjects();
    this.hasError = false;
  }

  // --- Filtering & Stats ---

  filterProjects(): void {
    this.filteredProjects = this.projects.filter(project => {
      const matchesSearch = this.searchTerm === '' ||
        this.matchesSearchTerm(project, this.searchTerm.toLowerCase());

      const matchesCompany = this.selectedCompany === 'all' ||
        this.matchesCompanyFilter(project, this.selectedCompany);

      return matchesSearch && matchesCompany;
    });
  }

  private matchesSearchTerm(project: ProjectItem, searchTerm: string): boolean {
    const searchableFields = [
      project.name || '',
      project.description || '',
      this.getStatusText(project.status) || ''
    ];

    return searchableFields.some(field =>
      field.toLowerCase().includes(searchTerm)
    );
  }

  private matchesCompanyFilter(project: ProjectItem, companyValue: string): boolean {
    return true;
  }

  loadProjectStats(): void {
    this.projectStats = {
      total: this.projects.length,
      active: this.projects.filter(p => p.status === true).length,
      inactive: this.projects.filter(p => p.status === false).length,
      newThisMonth: this.calculateNewThisMonth()
    };
  }

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

  // --- Display Helpers ---

  getStatusText(status: boolean): string {
    return status 
      ? this.t('projectDetail.header.active') 
      : this.t('projectDetail.header.inactive');
  }

  getProjectStatus(project: ProjectItem): string {
    if (project.end_date) {
      const endDate = new Date(project.end_date);
      const now = new Date();
      if (endDate < now) {
        return this.t('tickets.complete');
      }
    }
    return this.getStatusText(project.status);
  }

  getStatsDisplay(): { total: string; active: string; inactive: string; newThisMonth: string; } {
    return {
      total: this.languageService.formatNumber(this.projectStats.total),
      active: this.languageService.formatNumber(this.projectStats.active),
      inactive: this.languageService.formatNumber(this.projectStats.inactive),
      newThisMonth: this.languageService.formatNumber(this.projectStats.newThisMonth)
    };
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    return this.languageService.formatDate(dateString);
  }

  trackByProjectId(index: number, project: ProjectItem): number {
    return project.id;
  }

  // --- CRUD Operations ---

  onCreateNewProject(): void {
    this.isCreateModalVisible = true;
    this.resetForm();
  }

  onFormSubmit(): void {
    this.onSubmitWithEditSupport();
  }

  onSubmitWithEditSupport(): void {
    if (this.projectForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      
      const formData: any = {
        name: this.projectForm.get('name')?.value.trim(),
        description: this.projectForm.get('description')?.value?.trim() || undefined,
        start_date: this.projectForm.get('start_date')?.value || undefined,
        end_date: this.projectForm.get('end_date')?.value || undefined,
        status: this.projectForm.get('status')?.value
      };

      if (this.isEditMode && this.editingProjectId) {
        this.updateProject(this.editingProjectId, formData);
      } else {
        this.createProjectViaApi(formData);
      }
    } else {
      this.projectForm.markAllAsTouched();
    }
  }

  private createProjectViaApi(formData: CreateProjectDto): void {
    this.apiService.post('projects', formData)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.handleCreateProjectError(error);
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response === null) return;

          let createdProject: ProjectItem | null = null;
          if (response && response.data && typeof response.data === 'object') {
            createdProject = response.data;
          } else {
            createdProject = response;
          }

          if (createdProject) {
            this.onProjectCreatedWithModalClose(createdProject);
          } else {
            this.showErrorMessage(this.t('projectDetail.messages.createUserFail'));
          }
        },
        error: (error) => {
          this.isSubmitting = false;
          this.handleCreateProjectError(error);
        }
      });
  }

  updateProject(projectId: number, updateData: UpdateProjectDto): void {
    this.isSubmitting = true;
    this.apiService.patch(`project/update/${projectId}`, updateData)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.handleUpdateProjectError(error);
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response === null) return;

          let updatedProject: ProjectItem | null = null;
          if (response && response.data) {
            updatedProject = response.data;
          } else {
            updatedProject = response;
          }

          if (updatedProject) {
            this.onProjectUpdatedWithModalClose(updatedProject);
          } else {
            this.showErrorMessage(this.t('projectDetail.messages.updateUserFail'));
          }
        },
        error: (error) => {
          this.isSubmitting = false;
          this.handleUpdateProjectError(error);
        }
      });
  }

  // [Fix] Changed from deleteProject to onDeleteProject to match HTML template
  onDeleteProject(projectId: number): void {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    const confirmMessage = `${this.t('common.confirm')} ${this.t('common.delete')} "${project.name}"?`;

    if (confirm(confirmMessage)) {
      this.performDeleteProject(projectId, project.name);
    }
  }

  private performDeleteProject(projectId: number, projectName: string): void {
    this.isLoading = true;
    this.apiService.delete(`project/delete/${projectId}`)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.handleDeleteProjectError(error, projectName);
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isLoading = false;
          if (response === null) return;

          this.projects = this.projects.filter(p => p.id !== projectId);
          this.filterProjects();
          this.loadProjectStats();

          this.showSuccessMessage(`${this.t('common.success')} ${this.t('common.delete')}`);
        },
        error: (error) => {
          this.isLoading = false;
          this.handleDeleteProjectError(error, projectName);
        }
      });
  }

  // --- Modal & UI Actions ---

  openEditModal(projectId: number): void {
    const project = this.projects.find(p => p.id === projectId);
    if (!project || !this.canEditProject(project)) return;

    this.projectForm.patchValue({
      name: project.name,
      description: project.description || '',
      start_date: project.start_date ? project.start_date.split('T')[0] : '',
      end_date: project.end_date ? project.end_date.split('T')[0] : '',
      status: project.status
    });

    this.editingProjectId = projectId;
    this.isCreateModalVisible = true;
    this.isEditMode = true;
  }

  onFormModalClose(): void {
    this.onModalCloseWithEditSupport();
  }

  onBackdropClick(): void {
    if (!this.isSubmitting) {
      this.onFormModalClose();
    }
  }

  private resetFormWithEditSupport(): void {
    this.projectForm.reset({ status: true });
    this.isSubmitting = false;
    this.isEditMode = false;
    this.editingProjectId = null;
  }

  onModalCloseWithEditSupport(): void {
    if (!this.isSubmitting) {
      this.resetFormWithEditSupport();
      this.isCreateModalVisible = false;
    }
  }

  onProjectCreatedWithModalClose(newProject: ProjectItem): void {
    this.projects.unshift(newProject);
    this.filterProjects();
    this.loadProjectStats();
    this.isCreateModalVisible = false;
    this.resetFormWithEditSupport();
    this.showSuccessMessage(this.t('common.success'));
  }

  onProjectUpdatedWithModalClose(updatedProject: ProjectItem): void {
    const index = this.projects.findIndex(p => p.id === updatedProject.id);
    if (index !== -1) {
      this.projects[index] = updatedProject;
      this.filterProjects();
      this.loadProjectStats();
    }
    this.isCreateModalVisible = false;
    this.resetFormWithEditSupport();
    this.showSuccessMessage(this.t('common.success'));
  }

  refreshData(): void {
    this.loadProjectData(true);
  }

  // --- Permissions & Utils ---

  canCreateProject(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canEditProject(project: ProjectItem): boolean {
    return this.authService.isAdmin() || this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  canDeleteProject(project: ProjectItem): boolean {
    return this.authService.isAdmin() || this.authService.hasPermission(permissionEnum.MANAGE_PROJECT);
  }

  // --- Messages & Errors (Translated) ---

  private handleCreateProjectError(error: HttpErrorResponse): void {
    this.isSubmitting = false;
    let errorMessage = this.t('projectDetail.messages.createUserFail');
    
    if (error.status === 401) {
      errorMessage = this.t('errors.unauthorized');
      this.authService.logout();
      this.router.navigate(['/login']);
    } else if (error.error?.message) {
      errorMessage = error.error.message;
    }
    this.showErrorMessage(errorMessage);
  }

  private handleUpdateProjectError(error: HttpErrorResponse): void {
    this.isSubmitting = false;
    let errorMessage = this.t('projectDetail.messages.updateUserFail');
    if (error.error?.message) errorMessage = error.error.message;
    this.showErrorMessage(errorMessage);
  }

  private handleDeleteProjectError(error: HttpErrorResponse, projectName: string): void {
    this.isLoading = false;
    this.showErrorMessage(this.t('errors.unknownError'));
  }

  // [NEW] ฟังก์ชันจัดการ Notification
  showNotification(type: 'success' | 'error' | 'info' | 'warning', message: string, duration: number = 5000): void {
    this.notification = { type, message, duration };
    setTimeout(() => {
      this.clearNotification();
    }, duration);
  }

  clearNotification(): void {
    this.notification = null;
  }

  // [UPDATED] ใช้ showNotification แทน alert
  showSuccessMessage(message: string): void {
    this.showNotification('success', message);
  }

  // [UPDATED] ใช้ showNotification แทน alert
  showErrorMessage(message: string): void {
    this.showNotification('error', message);
  }

  getPermissionRequiredMessage(): string {
    return this.t('userAccount.messages.permissionRequired');
  }

  getModalTitle(): string {
    return this.isEditMode 
      ? `${this.t('common.edit')} ${this.t('menu.project')}` 
      : `${this.t('common.add')} ${this.t('menu.project')}`;
  }

  getSubmitButtonText(): string {
    if (this.isSubmitting) {
      return this.t('common.loading');
    }
    return this.isEditMode ? this.t('common.save') : this.t('common.add');
  }

  // Template Handlers
  onSearchChange(): void { this.filterProjects(); }
  onCompanyChange(): void { this.filterProjects(); }
}