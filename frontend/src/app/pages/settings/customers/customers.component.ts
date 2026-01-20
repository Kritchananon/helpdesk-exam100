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

// Customer interface - aligned with backend
export interface CustomerItem {
  id?: number;
  name: string;           // Primary field from backend
  address: string;
  email: string;
  telephone: string;      // Backend uses "telephone"
  status: boolean;        // Backend uses boolean (true/false)
  created_date?: string;
  created_by?: number;
  updated_date?: string;
  updated_by?: number;
}

// Create Customer DTO - matches backend expectations
export interface CreateCustomerDto {
  name: string;
  address: string;
  email: string;
  telephone: string;
  status: boolean;
}

// Update Customer DTO - matches backend expectations (with id)
export interface UpdateCustomerDto {
  id?: number;           // เพิ่ม id field
  name?: string;
  address?: string;
  email?: string;
  telephone?: string;
  status?: boolean;
  // Removed create_by and update_by - backend handles these automatically
}

// Customer stats interface
export interface CustomerStats {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
}

// Notification interface
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

  // Loading and error states
  isLoading = false;
  hasError = false;
  errorMessage = '';

  // Search properties with debouncing
  searchTerm: string = '';
  private searchSubject = new Subject<string>();

  // Customer data
  customers: CustomerItem[] = [];
  filteredCustomers: CustomerItem[] = [];

  // Customer stats
  customerStats: CustomerStats = {
    total: 0,
    active: 0,
    inactive: 0,
    newThisMonth: 0
  };

  // Modal-related properties
  isCreateModalVisible = false;
  isSubmitting = false;
  customerForm!: FormGroup;

  // Edit modal properties
  isEditModalVisible = false;
  editingCustomer: CustomerItem | null = null;
  editForm!: FormGroup;

  // Notification
  notification: NotificationMessage | null = null;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private fb: FormBuilder
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

  /**
   * Initialize form with proper validation
   */
  private initForm(): void {
    this.customerForm = this.fb.group({
      name: ['', [
        Validators.required, 
        Validators.minLength(2), 
        Validators.maxLength(100),
        Validators.pattern(/^[a-zA-Zก-๙\s\-\.]+$/) // Allow Thai, English, spaces, hyphens, dots
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
        Validators.pattern(/^[\d\s\-\+\(\)]{8,15}$/) // More specific phone pattern
      ]],
      status: [true, [Validators.required]]
    });

    console.log('Customer form initialized with validation rules');
  }

  /**
   * Initialize edit form with proper validation
   */
  private initEditForm(): void {
    this.editForm = this.fb.group({
      name: ['', [
        Validators.required, 
        Validators.minLength(2), 
        Validators.maxLength(100),
        Validators.pattern(/^[a-zA-Zก-๙\s\-\.]+$/)
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

    console.log('Edit form initialized with validation rules');
  }

  /**
   * Initialize search with debouncing
   */
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

  /**
   * Check if field is invalid and show errors
   */
  isFieldInvalid(fieldName: string, formGroup?: FormGroup): boolean {
    const form = formGroup || this.customerForm;
    const field = form.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get specific field error message
   */
  getFieldError(fieldName: string, formGroup?: FormGroup): string {
    const form = formGroup || this.customerForm;
    const field = form.get(fieldName);
    if (!field || !field.errors) return '';

    const errors = field.errors;
    
    if (errors['required']) return `${fieldName} is required`;
    if (errors['minlength']) return `${fieldName} must be at least ${errors['minlength'].requiredLength} characters`;
    if (errors['maxlength']) return `${fieldName} cannot exceed ${errors['maxlength'].requiredLength} characters`;
    if (errors['email']) return 'Please enter a valid email address';
    if (errors['pattern']) {
      if (fieldName === 'telephone') return 'Please enter a valid phone number (8-15 digits)';
      if (fieldName === 'name') return 'Name can only contain letters, spaces, hyphens, and dots';
      return 'Invalid format';
    }

    return 'Invalid input';
  }

  /**
   * Get address character count
   */
  getAddressLength(formGroup?: FormGroup): number {
    const form = formGroup || this.customerForm;
    const addressValue = form.get('address')?.value;
    return addressValue ? addressValue.length : 0;
  }

  /**
   * Load customer data from API with improved error handling
   */
  loadCustomerData(forceRefresh: boolean = false): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    console.log('Loading customer data from API...');

    this.apiService.get('get_customer_data')
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading customer data:', error);
          this.handleApiError(error);
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          console.log('API Response received:', response);
          
          if (this.isValidApiResponse(response)) {
            const customerData = this.extractCustomerData(response);
            const normalizedData = this.normalizeCustomerData(customerData);
            
            this.customers = normalizedData;
            this.filterCustomers();
            this.calculateCustomerStats();
            
            console.log(`Successfully loaded ${this.customers.length} customers`);
            
            if (forceRefresh) {
              this.showNotification('success', 'Customer data refreshed successfully');
            }
          } else {
            console.warn('Invalid API response format:', response);
            this.handleApiError(new Error('Invalid response format') as any);
          }
          
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.isLoading = false;
        }
      });
  }

  /**
   * Validate API response format
   */
  private isValidApiResponse(response: any): boolean {
    if (!response) return false;
    
    // Check for backend format: {code, status, message, data}
    if (response.status === true && Array.isArray(response.data)) return true;
    
    // Check for standard format: {success, data}
    if (response.success && Array.isArray(response.data)) return true;
    
    // Check for direct array
    if (Array.isArray(response)) return true;
    
    return false;
  }

  /**
   * Extract customer data from various response formats
   */
  private extractCustomerData(response: any): any[] {
    if (response.status === true && Array.isArray(response.data)) {
      return response.data; // Backend format
    }
    
    if (response.success && Array.isArray(response.data)) {
      return response.data; // Standard format
    }
    
    if (Array.isArray(response)) {
      return response; // Direct array
    }
    
    return [];
  }

  /**
   * Handle API errors with detailed messages
   */
  private handleApiError(error: HttpErrorResponse | Error): void {
    this.hasError = true;
    this.isLoading = false;

    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 401:
          this.errorMessage = 'Authentication required. Please log in again.';
          this.showNotification('error', 'Session expired. Please log in again.');
          break;
        case 403:
          this.errorMessage = 'You do not have permission to view customer data.';
          break;
        case 404:
          this.errorMessage = 'Customer data endpoint not found.';
          break;
        case 500:
          this.errorMessage = 'Server error. Please try again later.';
          break;
        case 0:
          this.errorMessage = 'Unable to connect to server. Please check your internet connection.';
          break;
        default:
          this.errorMessage = error.error?.message || 'Failed to load customer data. Please try again.';
      }
    } else {
      this.errorMessage = error.message || 'An unexpected error occurred.';
    }

    console.error('API Error:', this.errorMessage);
  }

  /**
   * Normalize customer data to match interface
   */
  private normalizeCustomerData(customers: any[]): CustomerItem[] {
    return customers.map((customer, index) => {
      // Try to get ID from various possible field names
      const customerId = customer.id || customer.customer_id || customer.customerId;
      
      // Ensure all required fields exist with proper types
      const normalized: CustomerItem = {
        // ใช้ customer.id จากฐานข้อมูล หากไม่มีให้ใช้ fallback
        id: customerId || (index + 1000), // ใช้ 1000+ เพื่อไม่ซ้ำกับ real ID
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

      // Debug: ตรวจสอบการ mapping ID
      if (!customerId) {
        console.warn('Customer missing database ID, using fallback:', {
          original: customer,
          normalized: normalized.id
        });
      }

      return normalized;
    });
  }

  /**
   * Sanitize string inputs
   */
  private sanitizeString(input: any): string {
    if (typeof input !== 'string') return '';
    return input.trim();
  }

  /**
   * Normalize status to boolean
   */
  private normalizeStatus(status: any): boolean {
    if (typeof status === 'boolean') return status;
    if (typeof status === 'string') {
      return status.toLowerCase() === 'active' || status.toLowerCase() === 'true';
    }
    return true; // Default to active
  }

  /**
   * Calculate customer statistics
   */
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

    console.log('Customer statistics calculated:', this.customerStats);
  }

  /**
   * Filter customers with improved search
   */
  filterCustomers(): void {
    if (!this.searchTerm.trim()) {
      this.filteredCustomers = [...this.customers];
    } else {
      const searchTerm = this.searchTerm.toLowerCase().trim();
      this.filteredCustomers = this.customers.filter(customer => 
        this.matchesSearchTerm(customer, searchTerm)
      );
    }

    console.log(`Filtered: ${this.filteredCustomers.length} of ${this.customers.length} customers`);
  }

  /**
   * Enhanced search matching
   */
  private matchesSearchTerm(customer: CustomerItem, searchTerm: string): boolean {
    const searchableFields = [
      customer.name,
      customer.address,
      customer.email,
      customer.telephone,
      customer.status ? 'active' : 'inactive',
      customer.status ? 'ใช้งาน' : 'ไม่ใช้งาน' // Thai status
    ];

    return searchableFields.some(field =>
      field.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Handle search input with debouncing
   */
  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  // ============ MODAL METHODS ============

  /**
   * Open create customer modal
   */
  createNewCustomer(): void {
    console.log('Opening create customer modal');
    this.isCreateModalVisible = true;
    this.resetForm();
  }

  /**
   * Close create modal with confirmation if form is dirty
   */
  onModalClose(): void {
    if (this.isSubmitting) return;

    if (this.customerForm.dirty) {
      const confirmClose = confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmClose) return;
    }

    this.resetForm();
    this.isCreateModalVisible = false;
    console.log('Create customer modal closed');
  }

  /**
   * Close edit modal with confirmation if form is dirty
   */
  onEditModalClose(): void {
    if (this.isSubmitting) return;

    if (this.editForm.dirty) {
      const confirmClose = confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmClose) return;
    }

    this.resetEditForm();
    this.isEditModalVisible = false;
    this.editingCustomer = null;
    console.log('Edit customer modal closed');
  }

  /**
   * Handle backdrop click
   */
  onBackdropClick(): void {
    this.onModalClose();
  }

  /**
   * Handle edit backdrop click
   */
  onEditBackdropClick(): void {
    this.onEditModalClose();
  }

  /**
   * Reset form to initial state
   */
  private resetForm(): void {
    this.customerForm.reset({
      status: true
    });
    this.isSubmitting = false;
    this.clearNotification();
    console.log('Customer form reset');
  }

  /**
   * Reset edit form to initial state
   */
  private resetEditForm(): void {
    this.editForm.reset();
    this.isSubmitting = false;
    this.clearNotification();
    console.log('Edit form reset');
  }

  /**
   * Handle form submission with validation
   */
  onSubmit(): void {
    console.log('Form submission initiated');
    
    // Mark all fields as touched to show validation errors
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
      
      console.log('Creating customer with data:', formData);
      this.createCustomerViaApi(formData);
    } else {
      console.log('Form is invalid or already submitting');
      this.showNotification('error', 'Please correct the errors before submitting');
    }
  }

  /**
   * Handle edit form submission
   */
  onEditSubmit(): void {
    console.log('Edit form submission initiated');
    
    if (!this.editingCustomer?.id) {
      this.showNotification('error', 'No customer selected for editing');
      return;
    }

    // Mark all fields as touched to show validation errors
    this.markFormGroupTouched(this.editForm);

    if (this.editForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;
      
      // ส่งข้อมูลแบบครบถ้วน รวมถึง id
      const formData = {
        id: this.editingCustomer.id,  // เพิ่ม id ใน payload
        name: this.editForm.value.name.trim(),
        address: this.editForm.value.address.trim(),
        email: this.editForm.value.email.trim().toLowerCase(),
        telephone: this.editForm.value.telephone.trim(),
        status: this.editForm.value.status === true
      };
      
      console.log('Updating customer with complete data:', formData);
      this.updateCustomerViaApi(this.editingCustomer.id, formData);
    } else {
      console.log('Edit form is invalid or already submitting');
      this.showNotification('error', 'Please correct the errors before submitting');
    }
  }

  /**
   * Mark all form fields as touched
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Create customer via API
   */
  private createCustomerViaApi(customerData: CreateCustomerDto): void {
    this.apiService.post('customer', customerData)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error creating customer:', error);
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
            this.showNotification('error', 'Failed to create customer. Invalid response from server.');
          }
        },
        error: (error: any) => {
          console.error('Subscription error:', error);
          this.showNotification('error', 'Network error. Please check your connection and try again.');
          this.isSubmitting = false;
        }
      });
  }

  /**
   * Update customer via API - CORRECTED METHOD to match backend PATCH /api/customer/update/:id
   */
  private updateCustomerViaApi(customerId: number, customerData: any): void {
    console.log('Updating customer with ID:', customerId);
    console.log('Complete update payload:', customerData);
    
    // Use the exact backend endpoint pattern: customer/update/:id
    const endpoint = `customer/update/${customerId}`;
    console.log('API endpoint:', endpoint);
    
    // Use PATCH method to match backend route
    this.apiService.patch(endpoint, customerData)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error updating customer:', error);
          console.error('Request payload was:', customerData);
          console.error('Endpoint was:', endpoint);
          this.handleUpdateCustomerError(error);
          this.isSubmitting = false;
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          console.log('Update response:', response);
          this.isSubmitting = false;
          
          if (this.isValidUpdateResponse(response)) {
            const updatedCustomer = this.extractUpdatedCustomer(response);
            this.onCustomerUpdated(customerId, updatedCustomer);
          } else {
            console.error('Invalid update response:', response);
            this.showNotification('error', 'Failed to update customer. Invalid response from server.');
          }
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.showNotification('error', 'Network error. Please check your connection and try again.');
          this.isSubmitting = false;
        }
      });
  }

  /**
   * Validate create customer response
   */
  private isValidCreateResponse(response: any): boolean {
    if (!response) return false;
    
    // Check for success response with data
    if (response.success && response.data) return true;
    
    // Check for direct customer object with ID
    if (response.id && response.name) return true;
    
    return false;
  }

  /**
   * Validate update customer response
   */
  private isValidUpdateResponse(response: any): boolean {
    if (!response) return false;
    
    // Check for success response
    if (response.success || response.status === true) return true;
    
    // Check for direct customer object with ID
    if (response.id && response.name) return true;
    
    return false;
  }

  /**
   * Extract created customer from response
   */
  private extractCreatedCustomer(response: any): CustomerItem {
    if (response.success && response.data) {
      return response.data;
    }
    
    return response;
  }

  /**
   * Extract updated customer from response
   */
  private extractUpdatedCustomer(response: any): CustomerItem {
    if (response.success && response.data) {
      return response.data;
    }
    
    if (response.status === true && response.data) {
      return response.data;
    }
    
    return response;
  }

  /**
   * Handle create customer API errors
   */
  private handleCreateCustomerError(error: HttpErrorResponse): void {
    let errorMessage = 'Failed to create customer. Please try again.';

    switch (error.status) {
      case 400:
        errorMessage = error.error?.message || 'Invalid input data. Please check your entries.';
        break;
      case 401:
        errorMessage = 'Authentication required. Please log in again.';
        break;
      case 403:
        errorMessage = 'You do not have permission to create customers.';
        break;
      case 409:
        errorMessage = 'A customer with this email already exists.';
        break;
      case 422:
        errorMessage = 'Validation failed. Please check your input data.';
        break;
    }

    this.showNotification('error', errorMessage);
  }

  /**
   * Handle update customer API errors
   */
  private handleUpdateCustomerError(error: HttpErrorResponse): void {
    let errorMessage = 'Failed to update customer. Please try again.';

    switch (error.status) {
      case 400:
        errorMessage = error.error?.message || 'Invalid input data. Please check your entries.';
        break;
      case 401:
        errorMessage = 'Authentication required. Please log in again.';
        break;
      case 403:
        errorMessage = 'You do not have permission to update customers.';
        break;
      case 404:
        errorMessage = 'Customer not found.';
        break;
      case 409:
        errorMessage = 'A customer with this email already exists.';
        break;
      case 422:
        errorMessage = 'Validation failed. Please check your input data.';
        break;
    }

    this.showNotification('error', errorMessage);
  }

  /**
   * Handle successful customer creation
   */
  private onCustomerCreated(newCustomer: any): void {
    console.log('Customer created successfully:', newCustomer);
    
    const normalizedCustomer = this.normalizeCustomerData([newCustomer])[0];
    
    // Add to local array
    this.customers.unshift(normalizedCustomer);
    this.filterCustomers();
    this.calculateCustomerStats();

    // Close modal and show success
    this.isCreateModalVisible = false;
    this.showNotification('success', `Customer "${normalizedCustomer.name}" created successfully!`);
    
    // Refresh data from server after a short delay
    setTimeout(() => {
      this.refreshData();
    }, 1000);
  }

  /**
   * Handle successful customer update
   */
  private onCustomerUpdated(customerId: number, updatedCustomer: any): void {
    console.log('Customer updated successfully:', updatedCustomer);
    
    const normalizedCustomer = this.normalizeCustomerData([updatedCustomer])[0];
    
    // Update in local array
    const customerIndex = this.customers.findIndex(c => c.id === customerId);
    if (customerIndex !== -1) {
      this.customers[customerIndex] = normalizedCustomer;
    }
    
    this.filterCustomers();
    this.calculateCustomerStats();

    // Close modal and show success
    this.isEditModalVisible = false;
    this.editingCustomer = null;
    this.showNotification('success', `Customer "${normalizedCustomer.name}" updated successfully!`);
    
    // Refresh data from server after a short delay
    setTimeout(() => {
      this.refreshData();
    }, 1000);
  }

  // ============ CUSTOMER ACTIONS ============

  /**
   * Edit customer
   */
  editCustomer(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) {
      this.showNotification('error', 'Customer not found');
      return;
    }

    console.log('Opening edit modal for customer:', customerId);
    
    // Set editing customer and populate form
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

  /**
   * Delete customer with confirmation
   */
  deleteCustomer(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) {
      this.showNotification('error', 'Customer not found');
      return;
    }

    const confirmMessage = `Are you sure you want to delete customer "${customer.name}"?\n\nThis action cannot be undone.`;

    if (confirm(confirmMessage)) {
      this.performDeleteCustomer(customerId, customer.name);
    }
  }

  /**
   * Perform customer deletion
   */
  private performDeleteCustomer(customerId: number, customerName: string): void {
    console.log('Deleting customer:', { customerId, customerName });

    this.isLoading = true;

    // Use the backend endpoint pattern: delete/:id
    this.apiService.delete(`customer/delete/${customerId}`)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Error deleting customer:', error);
          this.handleDeleteCustomerError(error, customerName);
          this.isLoading = false;
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          console.log('Customer deleted successfully:', response);
          
          // Remove from local array
          this.customers = this.customers.filter(c => c.id !== customerId);
          this.filterCustomers();
          this.calculateCustomerStats();
          
          this.showNotification('success', `Customer "${customerName}" deleted successfully`);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Subscription error:', error);
          this.showNotification('error', `Failed to delete customer "${customerName}"`);
          this.isLoading = false;
        }
      });
  }

  /**
   * Handle delete customer API errors
   */
  private handleDeleteCustomerError(error: HttpErrorResponse, customerName: string): void {
    let errorMessage = `Failed to delete customer "${customerName}". Please try again.`;

    switch (error.status) {
      case 401:
        errorMessage = 'Authentication required. Please log in again.';
        break;
      case 403:
        errorMessage = 'You do not have permission to delete customers.';
        break;
      case 404:
        errorMessage = 'Customer not found.';
        break;
      case 409:
        errorMessage = 'Cannot delete customer. It may be referenced by other records.';
        break;
    }

    this.showNotification('error', errorMessage);
  }

  /**
   * Refresh customer data
   */
  refreshData(): void {
    console.log('Refreshing customer data...');
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

  // ============ WRAPPER METHODS WITH PERMISSION CHECK ============

  onCreateNewCustomer(): void {
    if (!this.canCreateCustomer()) {
      this.showPermissionDeniedMessage('create new customer');
      return;
    }
    this.createNewCustomer();
  }

  onEditCustomer(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return;

    // ตรวจสอบว่าเป็น real database ID
    if (!this.isRealDatabaseId(customer)) {
      this.showNotification('warning', 'Cannot edit customer: Invalid database ID');
      return;
    }

    if (!this.canEditCustomer(customer)) {
      this.showPermissionDeniedMessage('edit customer');
      return;
    }
    this.editCustomer(customerId);
  }

  onDeleteCustomer(customerId: number): void {
    const customer = this.customers.find(c => c.id === customerId);
    if (!customer) return;

    // ตรวจสอบว่าเป็น real database ID
    if (!this.isRealDatabaseId(customer)) {
      this.showNotification('warning', 'Cannot delete customer: Invalid database ID');
      return;
    }

    if (!this.canDeleteCustomer(customer)) {
      this.showPermissionDeniedMessage('delete customer');
      return;
    }
    this.deleteCustomer(customerId);
  }

  // ============ UTILITY METHODS ============

  /**
   * Get safe customer display name
   */
  getCompanyDisplayName(customer: CustomerItem): string {
    return customer.name || 'Unknown Company';
  }

  /**
   * Get company initial for avatar
   */
  getCompanyInitial(customer: CustomerItem): string {
    const name = this.getCompanyDisplayName(customer);
    return name.charAt(0).toUpperCase();
  }

  /**
   * Get safe customer ID
   */
  getCustomerId(customer: CustomerItem): number {
    return customer.id || 0;
  }

  /**
   * Check if customer has valid ID - สำหรับแสดงปุ่ม UI
   */
  hasValidId(customer: CustomerItem): boolean {
    return customer.id !== undefined && 
           customer.id !== null && 
           customer.id > 0 && 
           Number.isInteger(customer.id);
  }

  /**
   * Check if customer ID is from database - สำหรับเรียก API
   */
  isRealDatabaseId(customer: CustomerItem): boolean {
    // Real database IDs are typically < 1000, fallback IDs are 1000+
    return customer.id !== undefined && 
           customer.id !== null && 
           customer.id > 0 && 
           customer.id < 1000;
  }

  /**
   * Track by function for ngFor optimization
   */
  trackByCustomerId(index: number, customer: CustomerItem): number {
    return customer.id || index;
  }

  /**
   * Get customer status display
   */
  getCustomerStatus(customer: CustomerItem): string {
    return customer.status ? 'Active' : 'Inactive';
  }

  /**
   * Get formatted stats for display
   */
  getStatsDisplay(): {
    total: string;
    active: string;
    inactive: string;
    newThisMonth: string;
  } {
    return {
      total: this.customerStats.total.toLocaleString(),
      active: this.customerStats.active.toLocaleString(),
      inactive: this.customerStats.inactive.toLocaleString(),
      newThisMonth: this.customerStats.newThisMonth.toLocaleString()
    };
  }

  /**
   * Get permission required message
   */
  getPermissionRequiredMessage(): string {
    return 'ต้องมีสิทธิ์ "จัดการลูกค้า" เพื่อดำเนินการนี้';
  }

  /**
   * Show permission denied message
   */
  private showPermissionDeniedMessage(action: string): void {
    const message = `You don't have permission to ${action}.\n\n${this.getPermissionRequiredMessage()}`;
    this.showNotification('error', message);
  }

  // ============ NOTIFICATION METHODS ============

  /**
   * Show notification message
   */
  private showNotification(type: NotificationMessage['type'], message: string, duration: number = 5000): void {
    this.notification = { type, message, duration };
    
    // Auto-clear notification after duration
    setTimeout(() => {
      this.clearNotification();
    }, duration);
  }

  /**
   * Clear current notification
   */
  clearNotification(): void {
    this.notification = null;
  }

  // ============ DATE FORMATTING METHODS ============

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
}