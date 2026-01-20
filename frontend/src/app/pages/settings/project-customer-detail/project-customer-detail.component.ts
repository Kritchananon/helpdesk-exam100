import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';
import { LanguageService } from '../../../shared/services/language.service'; // [เพิ่ม] Import LanguageService

// ... (Interfaces เหมือนเดิม ไม่ต้องแก้)
export interface AssignedUser {
  name: string;
  user_id: number;
  cfp_id?: number;
}

export interface CFPCustomerData {
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  assigned_users: AssignedUser[];
  customer_count: number;
  user_count: number;
  open_ticket_count: number;
}

export interface ProjectItem {
  id: number;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  created_date: string;
  created_by: number;
  updated_date?: string;
  updated_by?: number;
  total_customers?: number;
  total_users?: number;
  total_open_tickets?: number;
}

export interface ProjectCustomerItem {
  id: number;
  cfp_id?: number;
  project_id: number;
  customer_id: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  assigned_users?: ProjectUserItem[];
  assigned_user_names?: string[];
  assigned_user_data?: AssignedUser[];
  user_count?: number;
  open_tickets_count?: number;
  created_date: string;
  created_by: number;
}

export interface ProjectUserItem {
  id: number;
  project_id: number;
  customer_id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  department?: string;
  is_primary_contact: boolean;
  status: 'active' | 'inactive';
  created_date: string;
  created_by: number;
}

export interface ProjectStats {
  total_customers: number;
  active_customers: number;
  total_users: number;
  open_tickets: number;
}

export interface CustomerDDLItem {
  id: number;
  company: string;
  email: string;
  phone?: string;
  tier?: string;
  status?: string;
}

export interface SystemUser {
  id: number;
  name?: string;
  username?: string;
  email: string;
  role?: string;
  department?: string;
  is_available?: boolean;
  current_projects_count?: number;
  first_name?: string;
  last_name?: string;
  position?: string;
  phone?: string;
}

export interface CreateCustomerForProjectDto {
  project_id: number;
  customer_id: number;
  assigned_users: { user_id: number }[];
}

export interface UpdateCustomerForProjectDto {
  project_id?: number;
  customer_id?: number;
  assigned_users?: { user_id: number; cfp_id?: number }[];
}

@Component({
  selector: 'app-project-customer-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './project-customer-detail.component.html',
  styleUrls: ['./project-customer-detail.component.css']
})
export class ProjectCustomerDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Component state
  isCustomersLoading = false;
  isSubmitting = false;
  customerSearchTerm = '';

  // Data
  selectedProject: ProjectItem | null = null;
  projectCustomers: ProjectCustomerItem[] = [];
  filteredCustomers: ProjectCustomerItem[] = [];
  projectUsers: ProjectUserItem[] = [];
  projectStats: ProjectStats | null = null;

  // Modal states
  isAssignCustomerModalVisible = false;
  isManageUsersModalVisible = false;
  isCreateUserModalVisible = false;

  // Manage Users Modal
  selectedCustomerForEdit: ProjectCustomerItem | null = null;
  currentCustomerUsers: SystemUser[] = [];
  availableUsersForEdit: SystemUser[] = [];
  filteredAvailableUsers: SystemUser[] = [];
  editUserSearchTerm = '';
  isLoadingCurrentUsers = false;
  isLoadingAvailableUsers = false;
  usersToAdd: SystemUser[] = [];
  usersToRemove: SystemUser[] = [];

  // Assign customer data
  availableCustomers: CustomerDDLItem[] = [];
  systemUsers: SystemUser[] = [];
  selectedCustomer: CustomerDDLItem | null = null;
  selectedUsers: SystemUser[] = [];
  filteredUsers: SystemUser[] = [];
  isLoadingCustomers = false;
  isLoadingUsers = false;
  userSearchTerm = '';

  // Forms
  assignCustomerForm!: FormGroup;
  userForm!: FormGroup;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    private authService: AuthService,
    private fb: FormBuilder,
    public languageService: LanguageService // [เพิ่ม] Inject LanguageService
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const projectId = parseInt(params['id']);
      if (projectId) {
        this.loadProjectDetail(projectId);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForms(): void {
    this.assignCustomerForm = this.fb.group({
      customer_id: ['', [Validators.required]],
      assigned_users: [[], [Validators.required, Validators.minLength(1)]]
    });

    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern(/^[\d\s\-\+\(\)]+$/)]],
      role: ['End User', [Validators.required]],
      department: [''],
      is_primary_contact: [false]
    });
  }

  private loadProjectDetail(projectId: number): void {
    this.isCustomersLoading = true;

    this.apiService.get(`customer-for-project/cfp-data`)
      .pipe(
        takeUntil(this.destroy$),
        catchError(this.handleError.bind(this))
      )
      .subscribe({
        next: (response: any) => {
          if (response?.status === 1 && response.data) {
            const cfpProject = response.data.find((p: any) => p.project_id === projectId);
            
            if (cfpProject) {
              this.selectedProject = {
                id: cfpProject.project_id,
                name: cfpProject.project_name,
                // [แก้ไข] เอาข้อความ Hardcode ออก ใช้ค่า description จริงหรือว่างไว้
                description: cfpProject.description || '', 
                status: cfpProject.project_status ? 'active' : 'inactive',
                created_date: new Date().toISOString(),
                created_by: 1,
                total_customers: cfpProject.customers.length,
                total_users: cfpProject.customers.reduce((sum: number, c: any) => sum + c.user_count, 0),
                total_open_tickets: cfpProject.customers.reduce((sum: number, c: any) => sum + c.open_ticket_count, 0)
              };

              this.projectCustomers = cfpProject.customers.map((c: CFPCustomerData) => ({
                id: c.customer_id,
                cfp_id: c.assigned_users[0]?.cfp_id,
                project_id: projectId,
                customer_id: c.customer_id,
                customer_name: c.customer_name,
                customer_email: c.customer_email,
                customer_phone: c.customer_phone,
                assigned_user_names: c.assigned_users.map(u => u.name),
                assigned_user_data: c.assigned_users,
                user_count: c.user_count,
                open_tickets_count: c.open_ticket_count,
                created_date: new Date().toISOString(),
                created_by: 1,
                assigned_users: []
              }));

              this.projectStats = {
                total_customers: cfpProject.customers.length,
                active_customers: cfpProject.customers.length,
                total_users: cfpProject.customers.reduce((sum: number, c: any) => sum + c.user_count, 0),
                open_tickets: cfpProject.customers.reduce((sum: number, c: any) => sum + c.open_ticket_count, 0)
              };

              this.projectUsers = this.generateUsersFromCustomers(projectId, cfpProject.customers);
              this.filterCustomers();
            }
          }
          this.isCustomersLoading = false;
        },
        error: () => {
          this.isCustomersLoading = false;
        }
      });
  }

  // ... (Methods อื่นๆ เหมือนเดิม ไม่ต้องแก้)

  private generateUsersFromCustomers(projectId: number, customers: CFPCustomerData[]): ProjectUserItem[] {
    const users: ProjectUserItem[] = [];
    customers.forEach(customer => {
      customer.assigned_users.forEach((assignedUser, index) => {
        users.push({
          id: assignedUser.user_id,
          project_id: projectId,
          customer_id: customer.customer_id,
          name: assignedUser.name,
          email: `${assignedUser.name.toLowerCase().replace(/\s+/g, '.')}@${customer.customer_name.toLowerCase().replace(/\s+/g, '')}.com`,
          phone: `+66-${Math.floor(Math.random() * 90) + 10}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
          role: index === 0 ? 'Project Manager' : 'End User',
          department: index === 0 ? 'IT' : 'Operations',
          is_primary_contact: index === 0,
          status: 'active',
          created_date: new Date().toISOString(),
          created_by: 1
        });
      });
    });
    return users;
  }

  openManageUsersModal(customer: ProjectCustomerItem): void {
    this.selectedCustomerForEdit = customer;
    this.isManageUsersModalVisible = true;
    this.resetManageUsersState();
    this.loadCurrentCustomerUsers();
    this.loadAvailableUsersForEdit();
  }

  closeManageUsersModal(): void {
    if (!this.isSubmitting) {
      this.resetManageUsersState();
      this.isManageUsersModalVisible = false;
    }
  }

  private resetManageUsersState(): void {
    this.currentCustomerUsers = [];
    this.availableUsersForEdit = [];
    this.filteredAvailableUsers = [];
    this.editUserSearchTerm = '';
    this.usersToAdd = [];
    this.usersToRemove = [];
  }

  private loadCurrentCustomerUsers(): void {
    if (!this.selectedCustomerForEdit) return;
    this.isLoadingCurrentUsers = true;
    if (this.selectedCustomerForEdit.assigned_user_data?.length) {
      this.currentCustomerUsers = this.selectedCustomerForEdit.assigned_user_data.map(assignedUser => {
        const fullUserData = this.systemUsers.find(u => u.id === assignedUser.user_id);
        return fullUserData || {
          id: assignedUser.user_id,
          name: assignedUser.name,
          email: '',
          role: 'User',
          is_available: true,
          current_projects_count: 1
        };
      });
    }
    this.isLoadingCurrentUsers = false;
  }

  private loadAvailableUsersForEdit(): void {
    this.isLoadingAvailableUsers = true;
    if (this.systemUsers.length > 0) {
      this.updateCurrentUsersWithFullData();
      this.filterAvailableUsersForEdit();
      this.isLoadingAvailableUsers = false;
      return;
    }
    this.apiService.get('users/Allusers')
      .pipe(takeUntil(this.destroy$), catchError(() => of([])))
      .subscribe({
        next: (response: any) => {
          const userData = Array.isArray(response) ? response : response?.data ? response.data : [];
          this.systemUsers = this.transformUsersResponse(userData);
          this.updateCurrentUsersWithFullData();
          this.filterAvailableUsersForEdit();
          this.isLoadingAvailableUsers = false;
        },
        error: () => { this.isLoadingAvailableUsers = false; }
      });
  }

  private updateCurrentUsersWithFullData(): void {
    this.currentCustomerUsers = this.currentCustomerUsers.map(currentUser => {
      const fullUserData = this.systemUsers.find(u => u.id === currentUser.id);
      return fullUserData || currentUser;
    });
  }

  private filterAvailableUsersForEdit(): void {
    const searchTerm = this.editUserSearchTerm.toLowerCase();
    const currentUserIds = this.currentCustomerUsers.map(u => u.id);
    const usersToAddIds = this.usersToAdd.map(u => u.id);
    this.filteredAvailableUsers = this.systemUsers.filter(user => {
      const displayName = this.getUserDisplayName(user);
      const matchSearch = !searchTerm || displayName.toLowerCase().includes(searchTerm) || user.email.toLowerCase().includes(searchTerm);
      const notCurrentlyAssigned = !currentUserIds.includes(user.id) && !usersToAddIds.includes(user.id);
      return matchSearch && notCurrentlyAssigned;
    });
  }

  addUserToCustomer(user: SystemUser): void {
    if (!this.usersToAdd.some(u => u.id === user.id)) {
      this.usersToAdd.push(user);
      this.filterAvailableUsersForEdit();
    }
  }

  removeUserFromCustomer(user: SystemUser): void {
    if (this.currentCustomerUsers.some(u => u.id === user.id)) {
      if (!this.usersToRemove.some(u => u.id === user.id)) {
        this.usersToRemove.push(user);
      }
    }
    const addIndex = this.usersToAdd.findIndex(u => u.id === user.id);
    if (addIndex >= 0) {
      this.usersToAdd.splice(addIndex, 1);
      this.filterAvailableUsersForEdit();
    }
  }

  undoRemoveUser(user: SystemUser): void {
    const removeIndex = this.usersToRemove.findIndex(u => u.id === user.id);
    if (removeIndex >= 0) {
      this.usersToRemove.splice(removeIndex, 1);
    }
  }

  onEditUserSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editUserSearchTerm = input.value;
    this.filterAvailableUsersForEdit();
  }

  hasUserChanges(): boolean {
    return this.usersToAdd.length > 0 || this.usersToRemove.length > 0;
  }

  onSubmitManageUsers(): void {
    if (!this.selectedCustomerForEdit || !this.hasUserChanges() || this.isSubmitting) return;
    this.isSubmitting = true;
    const originalUsers = this.selectedCustomerForEdit.assigned_user_data || [];
    const assignedUsers = this.currentCustomerUsers
      .filter(user => !this.usersToRemove.some(ru => ru.id === user.id))
      .map(user => {
        const originalUser = originalUsers.find(ou => ou.user_id === user.id);
        return { user_id: user.id, cfp_id: originalUser?.cfp_id };
      })
      .concat(this.usersToAdd.map(user => ({ user_id: user.id, cfp_id: undefined })));

    const updateDto: UpdateCustomerForProjectDto = {
      project_id: this.selectedProject?.id,
      customer_id: this.selectedCustomerForEdit.customer_id,
      assigned_users: assignedUsers
    };
    const cfpId = this.selectedCustomerForEdit.cfp_id || this.selectedCustomerForEdit.id;

    this.apiService.patch(`customer-for-project/cfp/update/${cfpId}`, updateDto)
      .pipe(takeUntil(this.destroy$), catchError(this.handleError.bind(this)))
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response && (response.status === 1 || response.code === 1)) {
            this.closeManageUsersModal();
            this.showSuccess(this.languageService.translate('projectDetail.messages.updateUserSuccess'));
            if (this.selectedProject) { this.loadProjectDetail(this.selectedProject.id); }
          } else {
            this.showError(this.languageService.translate('projectDetail.messages.updateUserFail'));
          }
        },
        error: () => {
          this.isSubmitting = false;
          this.showError(this.languageService.translate('projectDetail.messages.updateUserFail'));
        }
      });
  }

  openAssignCustomerModal(): void {
    if (!this.selectedProject) return;
    this.isAssignCustomerModalVisible = true;
    this.resetAssignCustomerForm();
    this.loadCustomerDDL();
    this.loadAllUsers();
  }

  closeAssignCustomerModal(): void {
    if (!this.isSubmitting) {
      this.resetAssignCustomerForm();
      this.isAssignCustomerModalVisible = false;
    }
  }

  private resetAssignCustomerForm(): void {
    this.assignCustomerForm.reset();
    this.selectedCustomer = null;
    this.selectedUsers = [];
    this.filteredUsers = [];
    this.userSearchTerm = '';
  }

  private loadCustomerDDL(): void {
    this.isLoadingCustomers = true;
    this.apiService.get('get_all_customer')
      .pipe(takeUntil(this.destroy$), catchError(() => of({ code: 0, data: [] })))
      .subscribe({
        next: (response: any) => {
          this.isLoadingCustomers = false;
          if (response?.code === 1 && Array.isArray(response.data)) {
            this.availableCustomers = response.data.map((c: any) => ({
              id: c.id, company: c.name, email: c.email || '', phone: c.phone || '', tier: c.tier || 'Standard'
            }));
          }
        }
      });
  }

  private loadAllUsers(): void {
    this.isLoadingUsers = true;
    this.apiService.get('users/Allusers')
      .pipe(takeUntil(this.destroy$), catchError(() => of([])))
      .subscribe({
        next: (response: any) => {
          this.isLoadingUsers = false;
          const userData = Array.isArray(response) ? response : response?.data || [];
          this.systemUsers = this.transformUsersResponse(userData);
          this.filteredUsers = [...this.systemUsers];
        }
      });
  }

  private transformUsersResponse(users: any[]): SystemUser[] {
    if (!Array.isArray(users)) return [];
    return users.map(user => ({
      id: user.id,
      name: user.name || user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      username: user.username,
      email: user.email,
      role: user.role || user.position || 'User',
      department: user.department,
      is_available: true,
      current_projects_count: 0
    }));
  }

  onCustomerSelect(): void {
    const customerId = this.assignCustomerForm.get('customer_id')?.value;
    this.selectedCustomer = this.availableCustomers.find(c => c.id === parseInt(customerId)) || null;
  }

  toggleUserSelection(user: SystemUser): void {
    if (!this.selectedUsers.some(u => u.id === user.id)) {
      this.selectedUsers.push(user);
      this.assignCustomerForm.patchValue({ assigned_users: this.selectedUsers.map(u => ({ user_id: u.id })) });
      this.filterUsers();
    }
  }

  removeSelectedUser(user: SystemUser): void {
    const index = this.selectedUsers.findIndex(u => u.id === user.id);
    if (index >= 0) {
      this.selectedUsers.splice(index, 1);
      this.assignCustomerForm.patchValue({ assigned_users: this.selectedUsers.map(u => ({ user_id: u.id })) });
      this.filterUsers();
    }
  }

  onUserSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.userSearchTerm = input.value;
    this.filterUsers();
  }

  filterUsers(): void {
    const searchTerm = this.userSearchTerm.toLowerCase();
    this.filteredUsers = this.systemUsers.filter(user => {
      const displayName = this.getUserDisplayName(user);
      const matchSearch = !searchTerm || displayName.toLowerCase().includes(searchTerm) || user.email.toLowerCase().includes(searchTerm);
      const notSelected = !this.selectedUsers.some(u => u.id === user.id);
      return matchSearch && notSelected;
    });
  }

  onSubmitAssignCustomer(): void {
    if (!this.selectedProject || !this.assignCustomerForm.valid || this.isSubmitting) return;
    this.isSubmitting = true;
    const formData: CreateCustomerForProjectDto = {
      project_id: this.selectedProject.id,
      customer_id: parseInt(this.assignCustomerForm.get('customer_id')?.value),
      assigned_users: this.selectedUsers.map(user => ({ user_id: user.id }))
    };
    this.apiService.post('customer-for-project', formData)
      .pipe(takeUntil(this.destroy$), catchError(this.handleError.bind(this)))
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response && (response.status === 1 || response.code === 1)) {
            this.closeAssignCustomerModal();
            this.showSuccess(this.languageService.translate('projectDetail.messages.assignSuccess'));
            if (this.selectedProject) { this.loadProjectDetail(this.selectedProject.id); }
          } else {
            this.showError(this.languageService.translate('projectDetail.messages.assignFail'));
          }
        },
        error: () => {
          this.isSubmitting = false;
          this.showError(this.languageService.translate('projectDetail.messages.assignFail'));
        }
      });
  }

  viewCustomer(customerId: number): void {
    this.router.navigate(['/customers', customerId]);
  }

  deleteCustomer(customerId: number): void {
    const customer = this.projectCustomers.find(c => c.customer_id === customerId);
    if (!customer) return;
    const confirmMsg = this.languageService.translate('projectDetail.messages.deleteConfirm', { name: customer.customer_name });
    if (confirm(confirmMsg)) {
      const cfpIds = customer.assigned_user_data?.map(u => u.cfp_id) || [];
      if (cfpIds.length === 0) return;
      this.isCustomersLoading = true;
      let deletedCount = 0;
      cfpIds.forEach(cfpId => {
        this.apiService.delete(`customer-for-project/cfp/delete/${cfpId}`)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              deletedCount++;
              if (deletedCount === cfpIds.length) {
                this.isCustomersLoading = false;
                this.showSuccess(this.languageService.translate('projectDetail.messages.deleteSuccess'));
                if (this.selectedProject) { this.loadProjectDetail(this.selectedProject.id); }
              }
            }
          });
      });
    }
  }

  openCreateUserModal(): void {
    if (!this.selectedProject) return;
    this.isCreateUserModalVisible = true;
    this.resetUserForm();
  }

  closeCreateUserModal(): void {
    if (!this.isSubmitting) {
      this.resetUserForm();
      this.isCreateUserModalVisible = false;
    }
  }

  private resetUserForm(): void {
    this.userForm.reset({ role: 'End User', is_primary_contact: false });
  }

  onSubmitUser(): void {
    if (!this.selectedProject || !this.userForm.valid || this.isSubmitting) return;
    this.isSubmitting = true;
    const formData = {
      project_id: this.selectedProject.id,
      name: this.userForm.get('name')?.value?.trim(),
      email: this.userForm.get('email')?.value?.trim(),
      phone: this.userForm.get('phone')?.value?.trim() || undefined,
      role: this.userForm.get('role')?.value,
      department: this.userForm.get('department')?.value?.trim() || undefined,
      is_primary_contact: this.userForm.get('is_primary_contact')?.value || false
    };
    this.apiService.post('project-users', formData)
      .pipe(takeUntil(this.destroy$), catchError(this.handleError.bind(this)))
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (response && (response.data?.id || response.id)) {
            this.closeCreateUserModal();
            this.showSuccess(this.languageService.translate('projectDetail.messages.createUserSuccess'));
            if (this.selectedProject) { this.loadProjectDetail(this.selectedProject.id); }
          } else {
            this.showError(this.languageService.translate('projectDetail.messages.createUserFail'));
          }
        },
        error: () => {
          this.isSubmitting = false;
          this.showError(this.languageService.translate('projectDetail.messages.createUserFail'));
        }
      });
  }

  filterCustomers(): void {
    const searchTerm = this.customerSearchTerm.toLowerCase();
    this.filteredCustomers = this.projectCustomers.filter(customer =>
      !searchTerm ||
      customer.customer_name.toLowerCase().includes(searchTerm) ||
      customer.customer_email.toLowerCase().includes(searchTerm)
    );
  }

  onCustomerSearchChange(): void {
    this.filterCustomers();
  }

  exportProjectData(): void {
    this.showSuccess(this.languageService.translate('projectDetail.messages.exportComingSoon'));
  }

  refreshProjectData(): void {
    if (this.selectedProject) {
      this.loadProjectDetail(this.selectedProject.id);
    }
  }

  goBack(): void {
    this.router.navigate(['/settings/customer-for-project']);
  }

  isFieldInvalid(formName: 'assign' | 'user', fieldName: string): boolean {
    const form = formName === 'assign' ? this.assignCustomerForm : this.userForm;
    const field = form?.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getProjectAvatarLetter(projectName: string): string {
    return projectName ? projectName.charAt(0).toUpperCase() : '?';
  }

  getCustomerAvatarLetter(customerName: string): string {
    return customerName ? customerName.charAt(0).toUpperCase() : '?';
  }

  getUserAvatarLetter(user: string | SystemUser | undefined): string {
    if (!user) return '?';
    if (typeof user === 'string') { return user ? user.charAt(0).toUpperCase() : '?'; }
    const displayName = this.getUserDisplayName(user);
    return displayName ? displayName.charAt(0).toUpperCase() : '?';
  }

  getUserDisplayName(user: SystemUser): string {
    return user.name || user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  }

  getUserAvatarLetterByName(userName: string): string {
    return userName ? userName.charAt(0).toUpperCase() : '?';
  }

  getTicketsCountClass(count: number): string {
    if (count === 0) return 'tickets-zero';
    if (count > 5) return 'tickets-high';
    return 'tickets-medium';
  }

  getUserNamesString(users: SystemUser[]): string {
    return users.map(u => this.getUserDisplayName(u)).join(', ');
  }

  isUserNotInRemoveList(user: SystemUser): boolean {
    return !this.usersToRemove.some(u => u.id === user.id);
  }

  isUserInRemoveList(user: SystemUser): boolean {
    return this.usersToRemove.some(u => u.id === user.id);
  }

  canCreateCustomers(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canEditCustomer(customer: ProjectCustomerItem): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canDeleteCustomer(customer: ProjectCustomerItem): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  canCreateUsers(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_PROJECT) || this.authService.isAdmin();
  }

  trackByCustomerId(index: number, customer: ProjectCustomerItem): number {
    return customer.customer_id;
  }

  trackByUserId(index: number, user: ProjectUserItem): number {
    return user.id;
  }

  private handleError(error: HttpErrorResponse) {
    console.error('API Error:', error);
    if (error.status === 401) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
    return of(null);
  }

  private showSuccess(message: string): void {
    alert(message);
  }

  private showError(message: string): void {
    alert(message);
  }
}