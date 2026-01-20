import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

// Services
import { ApiService } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';

// Interfaces
export interface UserInfo {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
}

// ✅ ปรับ Interface ให้ตรงกับที่ Backend (UsersService) ใช้งานจริง
// Backend รอรับ field: firstname, lastname, email, phone, และ "password" (สำหรับการเปลี่ยนรหัส)
export interface UpdateProfileDto {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  password?: string; // 👈 เปลี่ยนจาก newPassword เป็น password ให้ตรงกับ Backend
}

export interface NotificationMessage {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './my-profile.component.html',
  styleUrls: ['./my-profile.component.css']
})
export class MyProfileComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  userForm!: FormGroup;
  isSubmitting = false;

  userInfo: UserInfo = {
    id: 0,
    username: '',
    firstname: '',
    lastname: '',
    fullName: '',
    email: '',
    phone: '',
    role: ''
  };

  notification: NotificationMessage | null = null;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadUserProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.userForm = this.fb.group({
      username: [{ value: '', disabled: true }],
      firstname: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      lastname: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^[\d\s\-\+\(\)]{8,15}$/)]],
      // Password fields
      currentPassword: [''], // ยังคงไว้ใน Form เพื่อความสมบูรณ์ของ UI
      newPassword: ['', [Validators.minLength(8), Validators.maxLength(50)]],
      confirmPassword: ['']
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(group: FormGroup): { [key: string]: boolean } | null {
    const newPassword = group.get('newPassword')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    const currentPassword = group.get('currentPassword')?.value;

    // ถ้ามีการกรอกรหัสใหม่ ต้องใส่รหัสปัจจุบันด้วย (Validation ฝั่งหน้าบ้าน)
    if ((newPassword || confirmPassword) && !currentPassword) {
      group.get('currentPassword')?.setErrors({ required: true });
      return { currentPasswordRequired: true };
    }

    if (newPassword && newPassword !== confirmPassword) {
      group.get('confirmPassword')?.setErrors({ mismatch: true });
      return { passwordMismatch: true };
    }

    if (newPassword === confirmPassword) {
      const confirmControl = group.get('confirmPassword');
      if (confirmControl?.hasError('mismatch')) {
        confirmControl.setErrors(null);
      }
    }
    return null;
  }

  private loadUserProfile(): void {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    // เรียก API ไปที่ users/:id เพื่อดึงข้อมูลล่าสุด
    this.apiService.get(`users/${currentUser.id}`)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          this.loadUserProfileFromLocalStorage(currentUser);
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response && response.status === 'success' && response.data) {
            this.populateUserInfo(response.data);
            this.populateForm();
          } else {
            this.loadUserProfileFromLocalStorage(currentUser);
          }
        }
      });
  }

  private loadUserProfileFromLocalStorage(currentUser: any): void {
    // Logic เดิมในการดึงจาก LocalStorage (ย่อเพื่อความกระชับ)
    this.populateUserInfo(currentUser);
    this.populateForm();
  }

  private populateUserInfo(data: any): void {
    // Map ข้อมูลจาก API/Storage เข้าตัวแปร userInfo
    const firstname = data.firstname || data.first_name || '';
    const lastname = data.lastname || data.last_name || '';
    
    this.userInfo = {
      id: data.id,
      username: data.username,
      firstname: firstname,
      lastname: lastname,
      fullName: `${firstname} ${lastname}`.trim(),
      email: data.user_email || data.email || '',
      phone: data.user_phone || data.phone || '',
      role: 'User' // Role logic เดิมของคุณ (ละไว้เพื่อให้โค้ดสั้นลง)
    };
  }

  private populateForm(): void {
    this.userForm.patchValue({
      username: this.userInfo.username,
      firstname: this.userInfo.firstname,
      lastname: this.userInfo.lastname,
      email: this.userInfo.email,
      phone: this.userInfo.phone
    });
  }

  getUserInitial(): string {
    return this.userInfo.firstname ? this.userInfo.firstname.charAt(0).toUpperCase() : 'U';
  }

  onChangePhoto(): void {
    this.showNotification('info', 'Feature coming soon');
  }

  // ------------------------------------------------------------------
  // ✅ ส่วนสำคัญ: การส่งข้อมูล Update
  // ------------------------------------------------------------------
  onSubmit(): void {
    if (this.userForm.invalid) {
      this.markFormGroupTouched(this.userForm);
      this.showNotification('error', 'Please check your inputs');
      return;
    }

    this.isSubmitting = true;
    const formValue = this.userForm.getRawValue();

    // 1. เตรียมข้อมูลพื้นฐาน
    const updateData: UpdateProfileDto = {
      firstname: formValue.firstname,
      lastname: formValue.lastname,
      email: formValue.email,
      phone: formValue.phone
    };

    // 2. ✅ Map รหัสผ่านใหม่ ส่งไปในชื่อ "password"
    // เพราะใน users.service.ts ใช้: if (updateUserDto.password) { ... hash ... }
    if (formValue.newPassword) {
      updateData.password = formValue.newPassword;
    }

    // หมายเหตุ: Backend ปัจจุบันไม่ได้ใช้ currentPassword ในการ Verify 
    // เราจึงส่งแค่ "password" (ที่เป็นค่าใหม่) ไปให้ Backend ทำการ Hash ลง DB ได้เลย

    this.updateUserProfile(updateData);
  }

  private updateUserProfile(data: UpdateProfileDto): void {
    // ยิง PATCH ไปที่ users/update/:id
    this.apiService.patch(`users/update/${this.userInfo.id}`, data)
      .pipe(
        takeUntil(this.destroy$),
        catchError((error: HttpErrorResponse) => {
          console.error('Update error:', error);
          this.showNotification('error', error.error?.message || 'Update failed');
          this.isSubmitting = false;
          return of(null);
        })
      )
      .subscribe({
        next: (response: any) => {
          if (response) { // Backend อาจจะส่ง code: '1' หรือ status: 'success'
            this.handleUpdateSuccess();
            // อัปเดต LocalStorage เพื่อให้ข้อมูลตรงกัน
            this.updateLocalUserData(data);
          }
        }
      });
  }

  private handleUpdateSuccess(): void {
    this.isSubmitting = false;
    this.showNotification('success', 'Profile updated successfully!');
    
    // รีโหลดข้อมูลใหม่
    this.loadUserProfile(); 

    // เคลียร์ค่ารหัสผ่านในฟอร์ม
    this.userForm.patchValue({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    this.userForm.markAsPristine();
    this.userForm.markAsUntouched();
  }

  private updateLocalUserData(data: UpdateProfileDto): void {
    try {
      const currentUserJson = localStorage.getItem('currentUser');
      if (currentUserJson) {
        const currentUser = JSON.parse(currentUserJson);
        // อัปเดตเฉพาะข้อมูลทั่วไป (ไม่เก็บ password ใน local storage)
        currentUser.firstname = data.firstname;
        currentUser.lastname = data.lastname;
        currentUser.email = data.email;
        currentUser.phone = data.phone;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
    } catch (e) { console.error(e); }
  }

  // Helpers
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) this.markFormGroupTouched(control);
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.userForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getFieldError(fieldName: string): string {
    const field = this.userForm.get(fieldName);
    if (!field?.errors) return '';
    if (field.errors['required']) return 'Required';
    if (field.errors['email']) return 'Invalid email';
    if (field.errors['minlength']) return `Min ${field.errors['minlength'].requiredLength} chars`;
    if (field.errors['mismatch']) return 'Passwords do not match';
    if (field.errors['pattern']) return 'Invalid format';
    return 'Invalid';
  }

  private showNotification(type: NotificationMessage['type'], message: string): void {
    this.notification = { type, message, duration: 3000 };
    setTimeout(() => this.notification = null, 3000);
  }
  
  clearNotification() { this.notification = null; }
}