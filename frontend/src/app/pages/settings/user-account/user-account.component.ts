import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, catchError, of, debounceTime, distinctUntilChanged } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

// Services
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { permissionEnum } from '../../../shared/models/permission.model';
// Import LanguageService
import { LanguageService } from '../../../shared/services/language.service';

export interface CompanyItem {
  company: string;
  company_address: string;
  company_phone: string;
}

export interface UserAccountItem {
  id?: number;
  name: string;
  user_email: string;
  user_phone: string;
  username?: string;

  // ✅ backend ส่งเป็น array หรือ string ก็จะถูกแปลงเป็น array เสมอ
  company: CompanyItem[];

  // ✅ backend ส่ง role_ids เป็น array
  role_ids?: number[];

  firstname?: string;
  lastname?: string;
  created_date?: string;
  updated_date?: string;
  roles?: Role[];
}

export interface Role {
  id: number;
  name: string;
  description?: string;
}

export interface CreateUserDto {
  username: string;
  password: string;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  role_id: number[];
}

export interface UpdateUserDto {
  id?: number;
  username?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  role_id?: number[];
  password?: string;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
}

export interface NotificationMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

@Component({
  selector: 'app-user-account',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './user-account.component.html',
  styleUrls: ['./user-account.component.css']
})
export class UserAccountComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();
  isLoading = false;
  hasError = false;
  errorMessage = '';
  searchTerm: string = '';
  private searchSubject = new Subject<string>();
  users: UserAccountItem[] = [];
  filteredUsers: UserAccountItem[] = [];
  availableRoles: Role[] = [];
  userStats: UserStats = { total: 0, active: 0, inactive: 0, newThisMonth: 0 };
  isCreateModalVisible = false;
  isSubmitting = false;
  userForm!: FormGroup;
  isEditModalVisible = false;
  editingUser: UserAccountItem | null = null;
  editForm!: FormGroup;
  notification: NotificationMessage | null = null;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private fb: FormBuilder,
    public languageService: LanguageService
  ) {
    this.initForm();
    this.initEditForm();
    this.initSearchDebounce();
  }

  ngOnInit(): void {
    this.loadRoles();
    this.loadUserData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.userForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50), Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(50)]],
      confirmPassword: ['', [Validators.required]],
      firstname: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(/^[a-zA-ZÀ-ÿ\s\-\.]+$/)]],
      lastname: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(/^[a-zA-ZÀ-ÿ\s\-\.]+$/)]],
      email: ['', [Validators.required, Validators.email, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^[\d\s\-\+\(\)]{8,15}$/)]],
      role_id: [[], [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private initEditForm(): void {
    this.editForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50), Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
      firstname: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(/^[a-zA-ZÀ-ÿ\s\-\.]+$/)]],
      lastname: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50), Validators.pattern(/^[a-zA-ZÀ-ÿ\s\-\.]+$/)]],
      email: ['', [Validators.required, Validators.email, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^[\d\s\-\+\(\)]{8,15}$/)]],
      role_id: [[], [Validators.required]],
      newPassword: ['', [Validators.minLength(8), Validators.maxLength(50)]],
      confirmPassword: ['']
    }, { validators: this.editPasswordMatchValidator });
  }

  private initSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.searchTerm = searchTerm;
      this.filterUsers();
    });
  }

  loadRoles(): void {
    this.apiService.get('master_role/all_roles')
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.showNotification('warning', 'Failed to load available roles');
          return of([]);
        })
      )
      .subscribe({
        next: (response: any) => {
          if (this.isValidRolesResponse(response)) {
            this.availableRoles = this.extractRolesData(response);
          } else {
            this.availableRoles = [];
          }
        }
      });
  }

  private isValidRolesResponse(response: any): boolean {
    if (!response) return false;
    if (response.status === true && Array.isArray(response.data)) return true;
    if (response.success && Array.isArray(response.data)) return true;
    if (Array.isArray(response)) return true;
    return false;
  }

  private extractRolesData(response: any): Role[] {
    let rolesArray: any[] = [];
    if (response.status === true && Array.isArray(response.data)) {
      rolesArray = response.data;
    } else if (response.success && Array.isArray(response.data)) {
      rolesArray = response.data;
    } else if (Array.isArray(response)) {
      rolesArray = response;
    }
    return rolesArray.map(role => ({
      id: role.id || role.role_id,
      name: role.name || role.role_name,
      description: role.description
    }));
  }

  private passwordMatchValidator(formGroup: FormGroup): { [key: string]: any } | null {
    const password = formGroup.get('password');
    const confirmPassword = formGroup.get('confirmPassword');
    if (!password || !confirmPassword) return null;
    if (password.value && confirmPassword.value) {
      if (password.value !== confirmPassword.value) {
        confirmPassword.setErrors({ passwordMismatch: true });
        return { passwordMismatch: true };
      } else {
        if (confirmPassword.hasError('passwordMismatch')) {
          const errors = confirmPassword.errors;
          delete errors?.['passwordMismatch'];
          confirmPassword.setErrors(Object.keys(errors || {}).length > 0 ? errors : null);
        }
      }
    }
    return null;
  }

  private editPasswordMatchValidator(formGroup: FormGroup): { [key: string]: any } | null {
    const newPassword = formGroup.get('newPassword');
    const confirmPassword = formGroup.get('confirmPassword');
    if (!newPassword || !confirmPassword) return null;
    const newPasswordValue = newPassword.value;
    const confirmPasswordValue = confirmPassword.value;

    if (newPasswordValue && !confirmPasswordValue) {
      confirmPassword.setErrors({ required: true });
      return { confirmPasswordRequired: true };
    }
    if (confirmPasswordValue && !newPasswordValue) {
      newPassword.setErrors({ required: true });
      return { newPasswordRequired: true };
    }
    if (newPasswordValue && confirmPasswordValue && newPasswordValue !== confirmPasswordValue) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    if (newPasswordValue && confirmPasswordValue && newPasswordValue === confirmPasswordValue) {
      if (confirmPassword.hasError('passwordMismatch') || confirmPassword.hasError('required')) {
        const errors = { ...confirmPassword.errors };
        delete errors['passwordMismatch'];
        delete errors['required'];
        confirmPassword.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
      if (newPassword.hasError('required')) {
        const errors = { ...newPassword.errors };
        delete errors['required'];
        newPassword.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }
    }
    return null;
  }

  isFieldInvalid(fieldName: string, formGroup?: FormGroup): boolean {
    const form = formGroup || this.userForm;
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string, formGroup?: FormGroup): string {
    const form = formGroup || this.userForm;
    const field = form.get(fieldName);
    if (!field || !field.errors) return '';

    const errors = field.errors;

    if (errors['required']) {
      if (fieldName === 'confirmPassword' && formGroup === this.editForm) {
        return this.languageService.translate('userAccount.messages.confirmPasswordRequired');
      }
      return this.languageService.translate('validation.required');
    }
    if (errors['minlength']) return this.languageService.translate('validation.minLength', { min: errors['minlength'].requiredLength });
    if (errors['maxlength']) return this.languageService.translate('validation.maxLength', { max: errors['maxlength'].requiredLength });
    if (errors['email']) return this.languageService.translate('validation.email');
    if (errors['passwordMismatch']) return this.languageService.translate('userAccount.messages.passwordMismatch');

    if (errors['pattern']) {
      if (fieldName === 'phone') return this.languageService.translate('validation.phone');
      if (fieldName === 'username') return this.languageService.translate('userAccount.validation.usernamePattern');
      if (fieldName === 'firstname' || fieldName === 'lastname') return this.languageService.translate('userAccount.validation.namePattern');
      if (fieldName === 'password' || fieldName === 'newPassword') return this.languageService.translate('userAccount.validation.passwordLength');
      return 'Invalid format';
    }

    return 'Invalid input';
  }

  private getFieldDisplayName(fieldName: string): string {
    return fieldName;
  }

  isChangingPassword(): boolean {
    if (!this.editForm) return false;
    const newPassword = this.editForm.get('newPassword')?.value;
    const confirmPassword = this.editForm.get('confirmPassword')?.value;
    return !!(newPassword || confirmPassword);
  }

  loadUserData(forceRefresh: boolean = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    this.apiService.get('users/account')
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.handleApiError(error);
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          if (this.isValidApiResponse(response)) {
            const userData = this.extractUserData(response);
            if (this.availableRoles.length === 0) {
              setTimeout(() => {
                const normalizedData = this.normalizeUserDataWithRoles(userData);
                this.updateUsersList(normalizedData, forceRefresh);
              }, 1000);
            } else {
              const normalizedData = this.normalizeUserDataWithRoles(userData);
              this.updateUsersList(normalizedData, forceRefresh);
            }
          } else {
            this.handleApiError(new Error('Invalid response format') as any);
          }
          this.isLoading = false;
        },
        error: (error) => {
          this.isLoading = false;
        }
      });
  }

  private updateUsersList(normalizedData: UserAccountItem[], forceRefresh: boolean): void {
    this.users = normalizedData;
    this.filterUsers();
    this.calculateUserStats();
    if (forceRefresh) {
      this.showNotification('success', this.languageService.translate('common.success'));
    }
  }

  private normalizeUserDataWithRoles(users: any[]): UserAccountItem[] {
    return users.map((user, index) => {
      const userId = user.id || user.user_id || user.userId;
      let normalizedRoles: Role[] = [];
      if (user.role_ids && Array.isArray(user.role_ids)) {
        normalizedRoles = user.role_ids.map((roleId: number) => {
          const roleInfo = this.availableRoles.find(r => r.id === roleId);
          return {
            id: roleId,
            name: roleInfo?.name || `Role ${roleId}`,
            description: roleInfo?.description || ''
          };
        }).filter((role: Role) => role.id !== undefined);
      } else if (user.roles && Array.isArray(user.roles)) {
        normalizedRoles = user.roles.map((role: any) => ({
          id: role.id || role.role_id || role.roleId,
          name: role.name || role.role_name || role.roleName || 'Unknown Role',
          description: role.description || role.desc
        }));
      }

      let firstname = user.firstname || user.first_name || '';
      let lastname = user.lastname || user.last_name || '';
      if (!firstname && !lastname && user.name) {
        const nameParts = user.name.trim().split(' ');
        firstname = nameParts[0] || '';
        lastname = nameParts.slice(1).join(' ') || '';
      }
      const displayName = user.name || `${firstname} ${lastname}`.trim() || 'Unknown User';

      // ✅✅✅ แก้ไข: รองรับทั้ง Array และ Flat String fields ✅✅✅
      let companies: CompanyItem[] = [];

      if (Array.isArray(user.company)) {
        // กรณีเป็น Array แบบเดิม
        companies = user.company.map((c: any) => ({
          company: this.sanitizeString(c.company),
          company_address: this.sanitizeString(c.company_address),
          company_phone: this.sanitizeString(c.company_phone),
        }));
      } else if (user.company && typeof user.company === 'string') {
        // กรณีเป็น String (Flat structure ตามที่เห็นในรูป)
        companies = [{
          company: this.sanitizeString(user.company),
          company_address: this.sanitizeString(user.company_address),
          company_phone: this.sanitizeString(user.company_phone)
        }];
      }
      // ✅✅✅ จบการแก้ไข ✅✅✅

      return {
        id: userId || (index + 1000),
        name: this.sanitizeString(displayName),
        user_email: this.sanitizeString(user.user_email || user.email || '').toLowerCase(),
        user_phone: this.sanitizeString(user.user_phone || user.phone || ''),
        username: this.sanitizeString(user.username || ''),
        firstname: this.sanitizeString(firstname),
        lastname: this.sanitizeString(lastname),
        created_date: user.created_date || new Date().toISOString(),
        updated_date: user.updated_date,

        // ใช้ตัวแปร companies ที่เราจัดการแล้ว
        company: companies,

        // ✅ role_ids
        role_ids: Array.isArray(user.role_ids) ? user.role_ids : [],

        roles: normalizedRoles
      };

    });
  }

  private isValidApiResponse(response: any): boolean {
    if (!response) return false;
    if (response.status === true && Array.isArray(response.data)) return true;
    if (response.success && Array.isArray(response.data)) return true;
    if (Array.isArray(response)) return true;
    return false;
  }

  private extractUserData(response: any): any[] {
    if (response.status === true && Array.isArray(response.data)) return response.data;
    if (response.success && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  }

  private handleApiError(error: HttpErrorResponse | Error): void {
    this.hasError = true;
    this.isLoading = false;
    if (error instanceof HttpErrorResponse) {
      this.errorMessage = error.error?.message || this.languageService.translate('errors.serverError');
    } else {
      this.errorMessage = error.message || this.languageService.translate('errors.unknownError');
    }
  }

  private sanitizeString(input: any): string {
    if (typeof input !== 'string') return '';
    return input.trim();
  }

  private calculateUserStats(): void {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    this.userStats = {
      total: this.users.length,
      active: this.users.length,
      inactive: 0,
      newThisMonth: this.users.filter(user => {
        if (!user.created_date) return false;
        try {
          const createdDate = new Date(user.created_date);
          return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
        } catch { return false; }
      }).length
    };
  }

  filterUsers(): void {
    if (!this.searchTerm.trim()) {
      this.filteredUsers = [...this.users];
    } else {
      const searchTerm = this.searchTerm.toLowerCase().trim();
      this.filteredUsers = this.users.filter(user => this.matchesSearchTerm(user, searchTerm));
    }
  }

  private matchesSearchTerm(user: UserAccountItem, searchTerm: string): boolean {
    const companyNames = (user.company || []).map(c => c.company).join(' ');
    const companyAddresses = (user.company || []).map(c => c.company_address).join(' ');
    const companyPhones = (user.company || []).map(c => c.company_phone).join(' ');

    const searchableFields = [
      user.name,
      user.user_email,
      companyNames,
      companyAddresses,
      user.user_phone,
      companyPhones,
      user.username,
      user.firstname,
      user.lastname
    ];

    return searchableFields.some(field => field ? field.toLowerCase().includes(searchTerm) : false);
  }

  getCompanyDisplay(user: UserAccountItem): string {
    if (!user.company || user.company.length === 0) return '-';
    return user.company.map(c => c.company).filter(Boolean).join(', ');
  }

  getCompanyPhoneDisplay(user: UserAccountItem): string {
    if (!user.company || user.company.length === 0) return '-';
    return user.company.map(c => c.company_phone).filter(Boolean).join(', ');
  }

  getCompanyAddressDisplay(user: UserAccountItem): string {
    if (!user.company || user.company.length === 0) return '-';
    return user.company.map(c => c.company_address).filter(Boolean).join(', ');
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  createNewUser(): void {
    this.isCreateModalVisible = true;
    this.resetCreateForm();
  }

  onModalClose(): void {
    if (this.isSubmitting) return;

    if (this.userForm.dirty) {
      const msg = this.languageService.translate('userAccount.messages.unsavedChanges');
      if (!confirm(msg)) return;
    }

    this.resetCreateForm();
    this.isCreateModalVisible = false;
  }

  onEditModalClose(): void {
    if (this.isSubmitting) return;

    if (this.editForm.dirty) {
      const msg = this.languageService.translate('userAccount.messages.unsavedChanges');
      if (!confirm(msg)) return;
    }

    this.resetEditForm();
    this.isEditModalVisible = false;
    this.editingUser = null;
  }

  onBackdropClick(): void { this.onModalClose(); }
  onEditBackdropClick(): void { this.onEditModalClose(); }

  private resetEditForm(): void {
    this.editForm.reset();
    this.isSubmitting = false;
    this.clearNotification();
  }

  onSubmit(): void {
    this.markFormGroupTouched(this.userForm);
    if (this.userForm.valid && !this.isSubmitting) {
      const password = this.userForm.value.password;
      const confirmPassword = this.userForm.value.confirmPassword;
      if (password !== confirmPassword) {
        this.showNotification('error', this.languageService.translate('userAccount.messages.passwordMismatch'));
        return;
      }
      this.isSubmitting = true;
      const formData: CreateUserDto = {
        username: this.userForm.value.username.trim(),
        password: this.userForm.value.password.trim(),
        firstname: this.userForm.value.firstname.trim(),
        lastname: this.userForm.value.lastname.trim(),
        email: this.userForm.value.email.trim().toLowerCase(),
        phone: this.userForm.value.phone.trim(),
        role_id: this.userForm.value.role_id || []
      };
      this.createUserViaApi(formData);
    } else {
      const errors = this.getFormValidationErrors();
      if (errors.length > 0) {
        this.showNotification('error', `${this.languageService.translate('validation.errorsFound')} ${errors.join(', ')}`);
      } else {
        this.showNotification('error', this.languageService.translate('validation.errorsFound'));
      }
    }
  }

  private getFormValidationErrors(formGroup?: FormGroup): string[] {
    const form = formGroup || this.userForm;
    const errors: string[] = [];
    Object.keys(form.controls).forEach(fieldName => {
      const field = form.get(fieldName);
      if (field && field.invalid && (field.dirty || field.touched)) {
        const fieldError = this.getFieldError(fieldName, form);
        if (fieldError && !errors.includes(fieldError)) {
          errors.push(fieldError);
        }
      }
    });
    if (form.hasError('passwordMismatch')) {
      errors.push(this.languageService.translate('userAccount.messages.passwordMismatch'));
    }
    return errors;
  }

  private resetCreateForm(): void {
    this.userForm.reset({ role_id: [] });
    this.userForm.setErrors(null);
    Object.keys(this.userForm.controls).forEach(fieldName => {
      const field = this.userForm.get(fieldName);
      if (field) { field.setErrors(null); field.markAsUntouched(); field.markAsPristine(); }
    });
    this.isSubmitting = false;
    this.clearNotification();
  }

  getPasswordStrength(password: string): { score: number; level: string; feedback: string[]; } {
    if (!password) return { score: 0, level: 'none', feedback: ['Enter a password'] };
    let score = 0;
    const feedback: string[] = [];
    if (password.length >= 8) score += 1; else feedback.push('At least 8 characters');
    if (/[A-Z]/.test(password)) score += 1; else feedback.push('One uppercase letter');
    if (/[a-z]/.test(password)) score += 1; else feedback.push('One lowercase letter');
    if (/\d/.test(password)) score += 1; else feedback.push('One number');
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 1; else feedback.push('One special character');
    let level = 'weak';
    if (score >= 4) level = 'strong'; else if (score >= 3) level = 'good'; else if (score >= 2) level = 'fair';
    return { score, level, feedback };
  }

  doPasswordsMatch(): boolean {
    const password = this.userForm.get('password')?.value;
    const confirmPassword = this.userForm.get('confirmPassword')?.value;
    if (!password || !confirmPassword) return false;
    return password === confirmPassword;
  }

  onPasswordChange(): void {
    const confirmPasswordField = this.userForm.get('confirmPassword');
    if (confirmPasswordField && confirmPasswordField.value) {
      confirmPasswordField.updateValueAndValidity();
    }
  }

  onConfirmPasswordChange(): void {
    const confirmPasswordField = this.userForm.get('confirmPassword');
    if (confirmPasswordField) {
      this.userForm.updateValueAndValidity();
    }
  }

  onEditSubmit(): void {
    if (!this.editingUser?.id) {
      this.showNotification('error', 'No user selected');
      return;
    }
    this.markFormGroupTouched(this.editForm);
    if (this.editForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      const formData: UpdateUserDto = {
        id: this.editingUser.id,
        username: this.editForm.value.username.trim(),
        firstname: this.editForm.value.firstname.trim(),
        lastname: this.editForm.value.lastname.trim(),
        email: this.editForm.value.email.trim().toLowerCase(),
        phone: this.editForm.value.phone.trim(),
        role_id: this.editForm.value.role_id || []
      };

      const newPassword = this.editForm.value.newPassword;
      if (newPassword && newPassword.trim()) {
        formData.password = newPassword.trim();
      }

      this.updateUserViaApi(this.editingUser.id, formData);
    } else {
      const errors = this.getFormValidationErrors(this.editForm);
      if (errors.length > 0) {
        this.showNotification('error', `${this.languageService.translate('validation.errorsFound')} ${errors.join(', ')}`);
      } else {
        this.showNotification('error', this.languageService.translate('validation.errorsFound'));
      }
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  private createUserViaApi(userData: CreateUserDto): void {
    this.apiService.post('users', userData)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.handleCreateUserError(error);
          this.isSubmitting = false;
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (this.isValidCreateResponse(response)) {
            const newUser = this.extractCreatedUser(response);
            this.onUserCreated(newUser);
          } else {
            this.showNotification('error', this.languageService.translate('errors.unknownError'));
          }
        },
        error: (error: any) => {
          this.showNotification('error', this.languageService.translate('errors.networkError'));
          this.isSubmitting = false;
        }
      });
  }

  private updateUserViaApi(userId: number, userData: UpdateUserDto): void {
    const endpoint = `users/update/${userId}`;
    this.apiService.patch(endpoint, userData)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.handleUpdateUserError(error);
          this.isSubmitting = false;
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          if (this.isValidUpdateResponse(response)) {
            const updatedUser = this.extractUpdatedUser(response);
            this.onUserUpdated(userId, updatedUser, !!userData.password);
          } else {
            this.showNotification('error', this.languageService.translate('errors.unknownError'));
          }
        },
        error: (error) => {
          this.showNotification('error', this.languageService.translate('errors.networkError'));
          this.isSubmitting = false;
        }
      });
  }

  private isValidCreateResponse(response: any): boolean {
    if (!response) return false;
    if (response.code === "1" || response.code === 1) return true;
    if (response.status === true) return true;
    if (response.success === true) return true;
    if (response.data && (response.data.id || response.data.user_id)) return true;
    if (response.id || response.user_id) return true;
    return false;
  }

  private extractCreatedUser(response: any): UserAccountItem {
    if (response.data) return response.data;
    return response;
  }

  private isValidUpdateResponse(response: any): boolean {
    if (!response) return false;
    if (response.code === "1" || response.code === 1) return true;
    if (response.success || response.status === true) return true;
    if (response.id && response.name) return true;
    return false;
  }

  private extractUpdatedUser(response: any): UserAccountItem {
    if (response.data) return response.data;
    return response;
  }

  private handleCreateUserError(error: HttpErrorResponse): void {
    let errorMessage = this.languageService.translate('tickets.createTicketFailed');
    if (error.status === 401) errorMessage = this.languageService.translate('errors.unauthorized');
    else if (error.status === 403) errorMessage = this.languageService.translate('errors.forbidden');
    this.showNotification('error', errorMessage);
  }

  private handleUpdateUserError(error: HttpErrorResponse): void {
    let errorMessage = this.languageService.translate('tickets.updateTicketFailed');
    if (error.status === 401) errorMessage = this.languageService.translate('errors.unauthorized');
    else if (error.status === 403) errorMessage = this.languageService.translate('errors.forbidden');
    this.showNotification('error', errorMessage);
  }

  private onUserCreated(newUser: any): void {
    const normalizedUser = this.normalizeUserDataWithRoles([newUser])[0];
    this.users.unshift(normalizedUser);
    this.filterUsers();
    this.calculateUserStats();
    this.isCreateModalVisible = false;

    const msg = this.languageService.translate('userAccount.messages.createSuccess', { name: normalizedUser.name });
    this.showNotification('success', msg);

    setTimeout(() => { this.refreshData(); }, 1000);
  }

  private onUserUpdated(userId: number, updatedUser: any, passwordChanged: boolean = false): void {
    const normalizedUser = this.normalizeUserDataWithRoles([updatedUser])[0];
    const userIndex = this.users.findIndex(u => u.id === userId);
    if (userIndex !== -1) {
      this.users[userIndex] = normalizedUser;
    }
    this.filterUsers();
    this.calculateUserStats();
    this.isEditModalVisible = false;
    this.editingUser = null;

    const msg = this.languageService.translate('userAccount.messages.updateSuccess', { name: normalizedUser.name });
    this.showNotification('success', msg);

    setTimeout(() => { this.refreshData(); }, 1000);
  }

  editUser(userId: number): void {
    const user = this.users.find(u => u.id === userId);
    if (!user) {
      this.showNotification('error', this.languageService.translate('errors.notFound'));
      return;
    }
    let roleIds: number[] = [];
    if (user.roles && Array.isArray(user.roles)) {
      roleIds = user.roles.map(role => {
        const roleId = role.id || (role as any).role_id || (role as any).roleId;
        return roleId;
      }).filter(id => id !== undefined && id !== null);
    }
    this.editingUser = user;
    this.editForm.reset();
    const formData = {
      username: user.username || '',
      firstname: user.firstname || user.name?.split(' ')[0] || '',
      lastname: user.lastname || user.name?.split(' ').slice(1).join(' ') || '',
      email: user.user_email || '',
      phone: user.user_phone || '',
      role_id: roleIds,
      newPassword: '',
      confirmPassword: ''
    };
    this.editForm.patchValue(formData);
    this.editForm.markAsPristine();
    this.isEditModalVisible = true;
  }

  deleteUser(userId: number): void {
    const user = this.users.find(u => u.id === userId);
    if (!user) {
      this.showNotification('error', this.languageService.translate('errors.notFound'));
      return;
    }

    const confirmMessage = this.languageService.translate('userAccount.messages.deleteConfirm', { name: user.name });

    if (confirm(confirmMessage)) {
      this.performDeleteUser(userId, user.name);
    }
  }

  private performDeleteUser(userId: number, userName: string): void {
    this.isLoading = true;
    this.apiService.delete(`users/delete/${userId}`)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.handleDeleteUserError(error, userName);
          this.isLoading = false;
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.users = this.users.filter(u => u.id !== userId);
          this.filterUsers();
          this.calculateUserStats();
          const msg = this.languageService.translate('userAccount.messages.deleteSuccess', { name: userName });
          this.showNotification('success', msg);
          this.isLoading = false;
        },
        error: (error) => {
          const msg = this.languageService.translate('userAccount.messages.deleteError', { name: userName });
          this.showNotification('error', msg);
          this.isLoading = false;
        }
      });
  }

  private handleDeleteUserError(error: HttpErrorResponse, userName: string): void {
    let errorMessage = this.languageService.translate('userAccount.messages.deleteError', { name: userName });
    if (error.status === 401) errorMessage = this.languageService.translate('errors.unauthorized');
    else if (error.status === 403) errorMessage = this.languageService.translate('errors.forbidden');
    this.showNotification('error', errorMessage);
  }

  refreshData(): void {
    this.loadUserData(true);
  }

  canManageUsers(): boolean {
    return this.authService.hasPermission(permissionEnum.ADD_USER) ||
      this.authService.hasPermission(permissionEnum.DEL_USER) ||
      this.authService.isAdmin();
  }

  canEditUser(user: UserAccountItem): boolean {
    return this.authService.isAdmin() ||
      this.authService.hasPermission(permissionEnum.ADD_USER);
  }

  canDeleteUser(user: UserAccountItem): boolean {
    return this.authService.isAdmin() ||
      this.authService.hasPermission(permissionEnum.DEL_USER);
  }

  canCreateUser(): boolean {
    return this.authService.hasPermission(permissionEnum.ADD_USER) ||
      this.authService.isAdmin();
  }

  onCreateNewUser(): void {
    if (!this.canCreateUser()) {
      this.showPermissionDeniedMessage('create new user');
      return;
    }
    this.createNewUser();
  }

  onEditUser(userId: number): void {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;
    if (!this.isRealDatabaseId(user)) {
      this.showNotification('warning', 'Cannot edit user: Invalid database ID');
      return;
    }
    if (!this.canEditUser(user)) {
      this.showPermissionDeniedMessage('edit user');
      return;
    }
    this.editUser(userId);
  }

  onDeleteUser(userId: number): void {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;
    if (!this.isRealDatabaseId(user)) {
      this.showNotification('warning', 'Cannot delete user: Invalid database ID');
      return;
    }
    if (!this.canDeleteUser(user)) {
      this.showPermissionDeniedMessage('delete user');
      return;
    }
    this.deleteUser(userId);
  }

  getUserDisplayName(user: UserAccountItem): string {
    return user.name || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Unknown User';
  }

  getUserInitial(user: UserAccountItem): string {
    const name = this.getUserDisplayName(user);
    return name.charAt(0).toUpperCase();
  }

  getUserId(user: UserAccountItem): number {
    return user.id || 0;
  }

  hasValidId(user: UserAccountItem): boolean {
    return user.id !== undefined && user.id !== null && user.id > 0 && Number.isInteger(user.id);
  }

  isRealDatabaseId(user: UserAccountItem): boolean {
    return user.id !== undefined && user.id !== null && user.id > 0 && user.id < 1000;
  }

  trackByUserId(index: number, user: UserAccountItem): number {
    return user.id || index;
  }

  trackRoleById(index: number, role: Role): number {
    return role.id || index;
  }

  getUserImportantRoles(user: UserAccountItem): Array<{ name: string, type: string }> {
    if (!user.roles || user.roles.length === 0) return [];
    const importantRoles: Array<{ name: string, type: string }> = [];
    user.roles.forEach(role => {
      switch (role.id) {
        case 1: importantRoles.push({ name: 'User', type: 'user' }); break;
        case 8: importantRoles.push({ name: 'Supporter', type: 'supporter' }); break;
        case 15: importantRoles.push({ name: 'Admin', type: 'admin' }); break;
      }
    });
    return importantRoles;
  }

  getRoleName(roleId: number): string {
    const role = this.availableRoles.find(r => r.id === roleId);
    return role ? role.name : `Role ${roleId}`;
  }

  getStatsDisplay(): { total: string; active: string; inactive: string; newThisMonth: string; } {
    return {
      total: this.userStats.total.toLocaleString(),
      active: this.userStats.active.toLocaleString(),
      inactive: this.userStats.inactive.toLocaleString(),
      newThisMonth: this.userStats.newThisMonth.toLocaleString()
    };
  }

  getPermissionRequiredMessage(): string {
    return this.languageService.translate('userAccount.messages.permissionRequired');
  }

  private showPermissionDeniedMessage(action: string): void {
    const message = this.languageService.translate('userAccount.messages.permissionDeniedAction', { action });
    this.showNotification('error', message);
  }

  isRoleSelected(roleId: number, formGroup?: FormGroup): boolean {
    const form = formGroup || this.userForm;
    const selectedRoles = form.get('role_id')?.value || [];
    return selectedRoles.includes(roleId);
  }

  toggleRoleSelection(roleId: number, formGroup?: FormGroup): void {
    const form = formGroup || this.userForm;
    const roleControl = form.get('role_id');
    if (!roleControl) return;
    const currentRoles = roleControl.value || [];
    const isSelected = currentRoles.includes(roleId);
    if (isSelected) {
      const updatedRoles = currentRoles.filter((id: number) => id !== roleId);
      roleControl.setValue(updatedRoles);
    } else {
      const updatedRoles = [...currentRoles, roleId];
      roleControl.setValue(updatedRoles);
    }
    roleControl.markAsTouched();
  }

  getSelectedRoleNames(formGroup?: FormGroup): string {
    const form = formGroup || this.userForm;
    const selectedRoleIds = form.get('role_id')?.value || [];
    if (selectedRoleIds.length === 0) {
      return this.languageService.translate('userAccount.form.noRoles');
    }
    const roleNames = selectedRoleIds.map((id: number) => this.getRoleName(id));
    return roleNames.join(', ');
  }

  private showNotification(type: NotificationMessage['type'], message: string, duration: number = 5000): void {
    this.notification = { type, message, duration };
    setTimeout(() => { this.clearNotification(); }, duration);
  }

  clearNotification(): void {
    this.notification = null;
  }
}