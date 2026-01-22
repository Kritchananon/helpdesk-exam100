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
// ✅ Import LanguageService
import { LanguageService } from '../../../shared/services/language.service';

export interface CustomerItem {
  id?: number;
  name: string;
  address: string;
  email: string;
  telephone: string;
  status: boolean;
  created_date?: string;
  created_by?: number;
  updated_date?: string;
  updated_by?: number;
}

export interface CreateCustomerDto {
  name: string;
  address: string;
  email: string;
  telephone: string;
  status: boolean;
}

export interface CustomerStats {
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
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './customers.component.html',
  styleUrls: ['./customers.component.css']
})
export class CustomersComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  isLoading = false;
  hasError = false;
  errorMessage = '';

  searchTerm: string = '';
  private searchSubject = new Subject<string>();

  customers: CustomerItem[] = [];
  filteredCustomers: CustomerItem[] = [];

  customerStats: CustomerStats = {
    total: 0,
    active: 0,
    inactive: 0,
    newThisMonth: 0
  };

  isCreateModalVisible = false;
  isSubmitting = false;
  customerForm!: FormGroup;

  isEditModalVisible = false;
  editingCustomer: CustomerItem | null = null;
  editForm!: FormGroup;

  notification: NotificationMessage | null = null;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private fb: FormBuilder,
    public languageService: LanguageService // ✅ Inject as public
  ) { 
    this.initForm();
    this.initEditForm();
    this.initSearchDebounce();
  }

  ngOnInit(): void {
    this.loadCustomerData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ✅ 1. เพิ่มฟังก์ชันตรวจสอบชื่อซ้ำ (Custom Validator)
  duplicateNameValidator(): any {
    return (control: any) => {
      if (!control.value || !this.customers) return null;
      
      const value = control.value.toString().trim().toLowerCase();
      
      const isDuplicate = this.customers.some(customer => {
        // กรณีแก้ไข: ให้ข้ามชื่อของตัวเองไป (ไม่นับว่าซ้ำ)
        if (this.isEditModalVisible && this.editingCustomer && customer.id === this.editingCustomer.id) {
          return false;
        }
        return customer.name.trim().toLowerCase() === value;
      });

      return isDuplicate ? { duplicateName: true } : null;
    };
  }

  private initForm(): void {
    this.customerForm = this.fb.group({
      name: ['', [
        Validators.required, 
        Validators.minLength(2), 
        Validators.maxLength(100),
        Validators.pattern(/^[a-zA-Zก-๙\s\-\.]+$/),
        this.duplicateNameValidator() // ✅ เรียกใช้ validator เช็คชื่อซ้ำ
      ]],
      address: ['', [
        Validators.required, 
        Validators.minLength(10), 
        Validators.maxLength(300)
      ]],
      email: ['', [
        Validators.required, 
        Validators.email,
        Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      ]],
      telephone: ['', [
        Validators.required, 
        Validators.pattern(/^[\d\s\-\+\(\)]{8,15}$/)
      ]],
      status: [true, [Validators.required]]
    });
  }

  private initEditForm(): void {
    this.editForm = this.fb.group({
      name: ['', [
        Validators.required, 
        Validators.minLength(2), 
        Validators.maxLength(100),
        Validators.pattern(/^[a-zA-Zก-๙\s\-\.]+$/),
        this.duplicateNameValidator() // ✅ เรียกใช้ validator เช็คชื่อซ้ำ (รองรับการแก้ไข)
      ]],
      address: ['', [
        Validators.required, 
        Validators.minLength(10), 
        Validators.maxLength(300)
      ]],
      email: ['', [
        Validators.required, 
        Validators.email,
        Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      ]],
      telephone: ['', [
        Validators.required, 
        Validators.pattern(/^[\d\s\-\+\(\)]{8,15}$/)
      ]],
      status: [true, [Validators.required]]
    });
  }

  private initSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.searchTerm = searchTerm;
      this.filterCustomers();
    });
  }

  isFieldInvalid(fieldName: string, formGroup?: FormGroup): boolean {
    const form = formGroup || this.customerForm;
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  // ✅ Updated to return translated error messages
  getFieldError(fieldName: string, formGroup?: FormGroup): string {
    const form = formGroup || this.customerForm;
    const field = form.get(fieldName);
    if (!field || !field.errors) return '';

    const errors = field.errors;
    
    if (errors['required']) return this.languageService.translate('validation.required');
    
    if (errors['minlength']) {
      return this.languageService.translate('validation.minLength', { min: errors['minlength'].requiredLength });
    }
    
    if (errors['maxlength']) {
      return this.languageService.translate('validation.maxLength', { max: errors['maxlength'].requiredLength });
    }
    
    if (errors['email']) return this.languageService.translate('validation.email');
    
    // ✅ 2. เพิ่มเงื่อนไขแสดงข้อความเมื่อชื่อซ้ำ
    if (errors['duplicateName']) {
       // คุณสามารถเพิ่ม key 'validation.duplicateName' ใน language json หรือใช้ข้อความตรงๆ แบบนี้ก็ได้ครับ
       return 'ชื่อบริษัทนี้มีอยู่ในระบบแล้ว'; 
    }
    
    if (errors['pattern']) {
      if (fieldName === 'telephone') return this.languageService.translate('validation.phone');
      return this.languageService.translate('validation.errorsFound'); 
    }

    return this.languageService.translate('validation.errorsFound');
  }

  getAddressLength(formGroup?: FormGroup): number {
    const form = formGroup || this.customerForm;
    const addressValue = form.get('address')?.value;
    return addressValue ? addressValue.length : 0;
  }

  loadCustomerData(forceRefresh: boolean = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    this.apiService.get('get_customer_data')
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
            const customerData = this.extractCustomerData(response);
            const normalizedData = this.normalizeCustomerData(customerData);
            
            this.customers = normalizedData;
            this.filterCustomers();
            this.calculateCustomerStats();
            
            if (forceRefresh) {
              this.showNotification('success', this.languageService.translate('common.success'));
            }
          } else {
            this.handleApiError(new Error('Invalid response format') as any);
          }
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        }
      });
  }

  private isValidApiResponse(response: any): boolean {
    if (!response) return false;
    if (response.status === true && Array.isArray(response.data)) return true;
    if (response.success && Array.isArray(response.data)) return true;
    if (Array.isArray(response)) return true;
    return false;
  }

  private extractCustomerData(response: any): any[] {
    if (response.status === true && Array.isArray(response.data)) return response.data;
    if (response.success && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  }

  private handleApiError(error: HttpErrorResponse | Error): void {
    this.hasError = true;
    this.isLoading = false;

    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 401:
          this.errorMessage = this.languageService.translate('errors.unauthorized');
          this.showNotification('error', this.languageService.translate('common.sessionExpired'));
          break;
        case 403:
          this.errorMessage = this.languageService.translate('errors.forbidden');
          break;
        case 404:
          this.errorMessage = this.languageService.translate('errors.notFound');
          break;
        case 500:
          this.errorMessage = this.languageService.translate('errors.serverError');
          break;
        case 0:
          this.errorMessage = this.languageService.translate('errors.networkError');
          break;
        default:
          this.errorMessage = error.error?.message || this.languageService.translate('errors.unknownError');
      }
    } else {
      this.errorMessage = error.message || this.languageService.translate('errors.unknownError');
    }
  }

  private normalizeCustomerData(customers: any[]): CustomerItem[] {
    return customers.map((customer, index) => {
      const customerId = customer.id || customer.customer_id || customer.customerId;
      
      const normalized: CustomerItem = {
        id: customerId || (index + 1000),
        name: this.sanitizeString(customer.name || customer.company || ''),
        address: this.sanitizeString(customer.address || ''),
        email: this.sanitizeString(customer.email || '').toLowerCase(),
        telephone: this.sanitizeString(customer.telephone || customer.phone || ''),
        status: this.normalizeStatus(customer.status),
        created_date: customer.created_date || new Date().toISOString(),
        created_by: customer.created_by || 1,
        updated_date: customer.updated_date,
        updated_by: customer.updated_by
      };
      return normalized;
    });
  }

  private sanitizeString(input: any): string {
    if (typeof input !== 'string') return '';
    return input.trim();
  }

  private normalizeStatus(status: any): boolean {
    if (typeof status === 'boolean') return status;
    if (typeof status === 'string') {
      return status.toLowerCase() === 'active' || status.toLowerCase() === 'true';
    }
    return true; 
  }

  private calculateCustomerStats(): void {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    this.customerStats = {
      total: this.customers.length,
      active: this.customers.filter(c => c.status === true).length,
      inactive: this.customers.filter(c => c.status === false).length,
      newThisMonth: this.customers.filter(c => {
        if (!c.created_date) return false;
        try {
          const createdDate = new Date(c.created_date);
          return createdDate.getMonth() === currentMonth && 
                 createdDate.getFullYear() === currentYear;
        } catch {
          return false;
        }
      }).length
    };
  }

  filterCustomers(): void {
    if (!this.searchTerm.trim()) {
      this.filteredCustomers = [...this.customers];
    } else {
      const searchTerm = this.searchTerm.toLowerCase().trim();
      this.filteredCustomers = this.customers.filter(customer => 
        this.matchesSearchTerm(customer, searchTerm)
      );
    }
  }

  private matchesSearchTerm(customer: CustomerItem, searchTerm: string): boolean {
    const searchableFields = [
      customer.name,
      customer.address,
      customer.email,
      customer.telephone,
      customer.status ? 'active' : 'inactive', 
      customer.status ? 'ใช้งาน' : 'ไม่ใช้งาน'
    ];

    return searchableFields.some(field =>
      field.toLowerCase().includes(searchTerm)
    );
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  // ============ MODAL METHODS ============

  createNewCustomer(): void {
    this.isCreateModalVisible = true;
    this.resetForm();
  }

  onModalClose(): void {
    if (this.isSubmitting) return;

    if (this.customerForm.dirty) {
      const confirmClose = confirm(this.languageService.translate('common.unsavedChanges'));
      if (!confirmClose) return;
    }

    this.resetForm();
    this.isCreateModalVisible = false;
  }

  onEditModalClose(): void {
    if (this.isSubmitting) return;

    if (this.editForm.dirty) {
      const confirmClose = confirm(this.languageService.translate('common.unsavedChanges'));
      if (!confirmClose) return;
    }

    this.resetEditForm();
    this.isEditModalVisible = false;
    this.editingCustomer = null;
  }

  onBackdropClick(): void {
    this.onModalClose();
  }

  onEditBackdropClick(): void {
    this.onEditModalClose();
  }

  private resetForm(): void {
    this.customerForm.reset({
      status: true
    });
    this.isSubmitting = false;
    this.clearNotification();
  }

  private resetEditForm(): void {
    this.editForm.reset();
    this.isSubmitting = false;
    this.clearNotification();
  }

  onSubmit(): void {
    this.markFormGroupTouched(this.customerForm);

    if (this.customerForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      
      const formData: CreateCustomerDto = {
        name: this.customerForm.value.name.trim(),
        address: this.customerForm.value.address.trim(),
        email: this.customerForm.value.email.trim().toLowerCase(),
        telephone: this.customerForm.value.telephone.trim(),
        status: this.customerForm.value.status === true
      };
      
      this.createCustomerViaApi(formData);
    } else {
      this.showNotification('error', this.languageService.translate('validation.errorsFound'));
    }
  }

  onEditSubmit(): void {
    if (!this.editingCustomer?.id) {
      this.showNotification('error', this.languageService.translate('errors.notFound'));
      return;
    }

    this.markFormGroupTouched(this.editForm);

    if (this.editForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      
      const formData = {
        id: this.editingCustomer.id,
        name: this.editForm.value.name.trim(),
        address: this.editForm.value.address.trim(),
        email: this.editForm.value.email.trim().toLowerCase(),
        telephone: this.editForm.value.telephone.trim(),
        status: this.editForm.value.status === true
      };
      
      this.updateCustomerViaApi(this.editingCustomer.id, formData);
    } else {
      this.showNotification('error', this.languageService.translate('validation.errorsFound'));
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  private createCustomerViaApi(customerData: CreateCustomerDto): void {
    this.apiService.post('customer', customerData)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.handleCreateCustomerError(error);
          this.isSubmitting = false;
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          
          if (this.isValidCreateResponse(response)) {
            const newCustomer = this.extractCreatedCustomer(response);
            this.onCustomerCreated(newCustomer);
          } else {
            this.showNotification('error', this.languageService.translate('errors.unknownError'));
          }
        },
        error: () => {
          this.showNotification('error', this.languageService.translate('errors.networkError'));
          this.isSubmitting = false;
        }
      });
  }

  private updateCustomerViaApi(customerId: number, customerData: any): void {
    const endpoint = `customer/update/${customerId}`;
    
    this.apiService.patch(endpoint, customerData)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.handleUpdateCustomerError(error);
          this.isSubmitting = false;
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          
          if (this.isValidUpdateResponse(response)) {
            const updatedCustomer = this.extractUpdatedCustomer(response);
            this.onCustomerUpdated(customerId, updatedCustomer);
          } else {
            this.showNotification('error', this.languageService.translate('errors.unknownError'));
          }
        },
        error: () => {
          this.showNotification('error', this.languageService.translate('errors.networkError'));
          this.isSubmitting = false;
        }
      });
  }

  private isValidCreateResponse(response: any): boolean {
    if (!response) return false;
    // ✅ 3. เช็ค status === true เพื่อแก้ปัญหา Unknown error
    if (response.status === true && response.data) return true;
    if (response.success && response.data) return true;
    if (response.id && response.name) return true;
    return false;
  }
  private isValidUpdateResponse(response: any): boolean {
    if (!response) return false;
    if (response.success || response.status === true) return true;
    if (response.id && response.name) return true;
    return false;
  }
  private extractCreatedCustomer(response: any): CustomerItem {
    // ✅ 4. ดึงข้อมูลเมื่อ status === true
    if (response.status === true && response.data) return response.data;
    return (response.success && response.data) ? response.data : response;
  }
  private extractUpdatedCustomer(response: any): CustomerItem {
    if (response.success && response.data) return response.data;
    if (response.status === true && response.data) return response.data;
    return response;
  }

  private handleCreateCustomerError(error: HttpErrorResponse): void {
    let errorMessage = this.languageService.translate('projectDetail.messages.createUserFail');

    switch (error.status) {
      case 400:
        errorMessage = error.error?.message || this.languageService.translate('validation.errorsFound');
        break;
      case 401:
        errorMessage = this.languageService.translate('errors.unauthorized');
        break;
      case 403:
        errorMessage = this.languageService.translate('errors.forbidden');
        break;
      case 422:
        errorMessage = this.languageService.translate('validation.errorsFound');
        break;
    }

    this.showNotification('error', errorMessage);
  }

  private handleUpdateCustomerError(error: HttpErrorResponse): void {
    let errorMessage = this.languageService.translate('projectDetail.messages.updateUserFail'); 

    switch (error.status) {
      case 400:
        errorMessage = error.error?.message || this.languageService.translate('validation.errorsFound');
        break;
      case 401:
        errorMessage = this.languageService.translate('errors.unauthorized');
        break;
      case 403:
        errorMessage = this.languageService.translate('errors.forbidden');
        break;
      case 404:
        errorMessage = this.languageService.translate('errors.notFound');
        break;
      case 422:
        errorMessage = this.languageService.translate('validation.errorsFound');
        break;
    }

    this.showNotification('error', errorMessage);
  }

  private onCustomerCreated(newCustomer: any): void {
    const normalizedCustomer = this.normalizeCustomerData([newCustomer])[0];
    
    this.customers.unshift(normalizedCustomer);
    this.filterCustomers();
    this.calculateCustomerStats();

    this.isCreateModalVisible = false;
    
    this.showNotification('success', this.languageService.translate('common.success'));
    
    setTimeout(() => {
      this.refreshData();
    }, 1000);
  }

  private onCustomerUpdated(customerId: number, updatedCustomer: any): void {
    const normalizedCustomer = this.normalizeCustomerData([updatedCustomer])[0];
    
    const customerIndex = this.customers.findIndex(c => c.id === customerId);
    if (customerIndex !== -1) {
      this.customers[customerIndex] = normalizedCustomer;
    }
    
    this.filterCustomers();
    this.calculateCustomerStats();

    this.isEditModalVisible = false;
    this.editingCustomer = null;
    this.showNotification('success', this.languageService.translate('common.success'));
    
    setTimeout(() => {
      this.refreshData();
    }, 1000);
  }

  editCustomer(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) {
      this.showNotification('error', this.languageService.translate('errors.notFound'));
      return;
    }
    
    this.editingCustomer = customer;
    this.editForm.patchValue({
      name: customer.name,
      address: customer.address,
      email: customer.email,
      telephone: customer.telephone,
      status: customer.status
    });
    
    this.isEditModalVisible = true;
  }

  deleteCustomer(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) {
      this.showNotification('error', this.languageService.translate('errors.notFound'));
      return;
    }

    const template = this.languageService.translate('projectDetail.messages.deleteConfirm');
    const confirmMessage = template.replace('{{name}}', customer.name);

    if (confirm(confirmMessage)) {
      this.performDeleteCustomer(customerId, customer.name);
    }
  }

  private performDeleteCustomer(customerId: number, customerName: string): void {
    this.isLoading = true;

    this.apiService.delete(`customer/delete/${customerId}`)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          this.handleDeleteCustomerError(error, customerName);
          this.isLoading = false;
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          this.customers = this.customers.filter(c => c.id !== customerId);
          this.filterCustomers();
          this.calculateCustomerStats();
          
          this.showNotification('success', this.languageService.translate('projectDetail.messages.deleteSuccess'));
          this.isLoading = false;
        },
        error: () => {
          this.showNotification('error', this.languageService.translate('errors.unknownError'));
          this.isLoading = false;
        }
      });
  }

  private handleDeleteCustomerError(error: HttpErrorResponse, customerName: string): void {
    let errorMessage = this.languageService.translate('errors.unknownError');

    switch (error.status) {
      case 401:
        errorMessage = this.languageService.translate('errors.unauthorized');
        break;
      case 403:
        errorMessage = this.languageService.translate('errors.forbidden');
        break;
      case 404:
        errorMessage = this.languageService.translate('errors.notFound');
        break;
    }

    this.showNotification('error', errorMessage);
  }

  refreshData(): void {
    this.loadCustomerData(true);
  }

  // ============ PERMISSION METHODS ============

  canManageCustomers(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_CUSTOMER) ||
           this.authService.isAdmin();
  }

  canEditCustomer(customer: CustomerItem): boolean {
    return this.authService.isAdmin() || 
           this.authService.hasPermission(permissionEnum.MANAGE_CUSTOMER);
  }

  canDeleteCustomer(customer: CustomerItem): boolean {
    return this.authService.isAdmin() || 
           this.authService.hasPermission(permissionEnum.MANAGE_CUSTOMER);
  }

  canCreateCustomer(): boolean {
    return this.authService.hasPermission(permissionEnum.MANAGE_CUSTOMER) ||
           this.authService.isAdmin();
  }

  onCreateNewCustomer(): void {
    if (!this.canCreateCustomer()) {
      this.showPermissionDeniedMessage('create');
      return;
    }
    this.createNewCustomer();
  }

  onEditCustomer(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return;

    if (!this.isRealDatabaseId(customer)) {
      this.showNotification('warning', this.languageService.translate('common.error'));
      return;
    }

    if (!this.canEditCustomer(customer)) {
      this.showPermissionDeniedMessage('edit');
      return;
    }
    this.editCustomer(customerId);
  }

  onDeleteCustomer(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return;

    if (!this.isRealDatabaseId(customer)) {
      this.showNotification('warning', this.languageService.translate('common.error'));
      return;
    }

    if (!this.canDeleteCustomer(customer)) {
      this.showPermissionDeniedMessage('delete');
      return;
    }
    this.deleteCustomer(customerId);
  }

  // ============ UTILITY METHODS ============

  getCompanyDisplayName(customer: CustomerItem): string {
    return customer.name || this.languageService.translate('common.unknown');
  }

  getCompanyInitial(customer: CustomerItem): string {
    const name = this.getCompanyDisplayName(customer);
    return name.charAt(0).toUpperCase();
  }

  getCustomerId(customer: CustomerItem): number {
    return customer.id || 0;
  }

  hasValidId(customer: CustomerItem): boolean {
    return customer.id !== undefined && customer.id !== null && customer.id > 0 && Number.isInteger(customer.id);
  }

  isRealDatabaseId(customer: CustomerItem): boolean {
    return customer.id !== undefined && customer.id !== null && customer.id > 0 && customer.id < 1000;
  }

  trackByCustomerId(index: number, customer: CustomerItem): number {
    return customer.id || index;
  }

  getCustomerStatus(customer: CustomerItem): string {
    return customer.status ? 
      this.languageService.translate('common.connected') :
      this.languageService.translate('common.disconnected');
  }

  getStatsDisplay(): {
    total: string;
    active: string;
    inactive: string;
    newThisMonth: string;
  } {
    return {
      total: this.languageService.formatNumber(this.customerStats.total),
      active: this.languageService.formatNumber(this.customerStats.active),
      inactive: this.languageService.formatNumber(this.customerStats.inactive),
      newThisMonth: this.languageService.formatNumber(this.customerStats.newThisMonth)
    };
  }

  getPermissionRequiredMessage(): string {
    return this.languageService.translate('userAccount.messages.permissionDeniedAction', { action: 'Manage Customers' });
  }

  private showPermissionDeniedMessage(action: string): void {
    const message = this.languageService.translate('userAccount.messages.permissionDeniedAction', { action: action });
    this.showNotification('error', message);
  }

  private showNotification(type: NotificationMessage['type'], message: string, duration: number = 5000): void {
    this.notification = { type, message, duration };
    setTimeout(() => {
      this.clearNotification();
    }, duration);
  }

  clearNotification(): void {
    this.notification = null;
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    return this.languageService.formatDate(dateString, { year: 'numeric', month: 'short', day: 'numeric' });
  }
}