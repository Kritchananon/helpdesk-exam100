// src/app/shared/components/notification-bell/notification-bell.component.ts

import { Component, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service'; // ✅ Import LanguageService
import {
  DisplayNotification,
  NotificationSummary,
  NotificationType,
  NotificationStatus,
  NotificationPriority,
  getNotificationTypeLabel,
  getNotificationPriorityLabel
} from '../../models/notification.model';
import { ROLES } from '../../models/permission.model';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './notification-bell.component.html',
  styleUrls: ['./notification-bell.component.css']
})
export class NotificationBellComponent implements OnInit, OnDestroy {
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private router = inject(Router);
  public languageService = inject(LanguageService); // ✅ Inject เป็น Public เพื่อใช้ใน HTML

  // State
  notifications: DisplayNotification[] = [];
  unreadCount = 0;
  summary: NotificationSummary | null = null;
  isDropdownOpen = false;
  isLoading = false;
  errorMessage: string | null = null;

  // Filters
  selectedFilter: 'all' | 'unread' | 'today' = 'all';
  selectedType: NotificationType | 'all' = 'all';

  private destroy$ = new Subject<void>();

  // Template Helpers
  readonly NotificationType = NotificationType;
  readonly NotificationStatus = NotificationStatus;
  readonly NotificationPriority = NotificationPriority;
  readonly ROLES = ROLES;

  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeComponent(): void {
    // ✅ Subscribe การเปลี่ยนภาษา เพื่ออัปเดตเวลา (Time Ago) และข้อมูลที่ขึ้นกับภาษา
    this.languageService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateTimeAgoForList();
      });

    // Subscribe Notifications
    this.notificationService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        this.notifications = notifications.map(n => ({
          ...n,
          timeAgo: this.formatTimeAgo(n.created_at), // คำนวณครั้งแรก
          icon: this.getNotificationIcon(n.notification_type),
          color: this.getNotificationColor(n.notification_type),
          route: `/tickets/${n.ticket_no}`
        }));
      });

    // Subscribe Counts
    this.notificationService.unreadCount$
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => this.unreadCount = count);

    this.notificationService.summary$
      .pipe(takeUntil(this.destroy$))
      .subscribe(summary => this.summary = summary);

    // Subscribe Loading & Error
    this.notificationService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => this.isLoading = loading);

    this.notificationService.error$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        if (error) {
          this.errorMessage = error;
          setTimeout(() => this.errorMessage = null, 5000); // Auto clear error
        }
      });
  }

  refreshNotifications(): void {
    if (this.isLoading) return;
    this.notificationService.fetchNotifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  // UI Actions
  toggleDropdown(): void { this.isDropdownOpen = !this.isDropdownOpen; }
  closeDropdown(): void { this.isDropdownOpen = false; }

  markAsRead(notification: DisplayNotification, event: Event): void {
    event.stopPropagation();
    this.notificationService.markAsRead(notification.id).subscribe();
  }

  markAllAsRead(event: Event): void {
    event.stopPropagation();
    this.notificationService.markAllAsRead().subscribe();
  }

  deleteNotification(notification: DisplayNotification, event: Event): void {
    event.stopPropagation();
    // ✅ ใช้ translate พร้อม Fallback text กรณีไม่มี Key ใน JSON
    const confirmMsg = this.translate('notifications.deleteConfirm', { 
      defaultValue: this.languageService.isThaiLanguage() ? 'ลบการแจ้งเตือนนี้?' : 'Delete this notification?' 
    });
    
    if (confirm(confirmMsg)) {
      this.notificationService.deleteNotification(notification.id).subscribe();
    }
  }

  deleteAllNotifications(event: Event): void {
    event.stopPropagation();
    // ✅ ใช้ translate พร้อม Fallback text
    const confirmMsg = this.translate('notifications.deleteAllConfirm', { 
      defaultValue: this.languageService.isThaiLanguage() ? 'ลบการแจ้งเตือนทั้งหมด?' : 'Delete all notifications?' 
    });

    if (confirm(confirmMsg)) {
      this.notificationService.deleteAllNotifications().subscribe();
    }
  }

  onNotificationClick(notification: DisplayNotification, event: Event): void {
    event.stopPropagation();
    if (notification.status === NotificationStatus.UNREAD) {
      this.notificationService.markAsRead(notification.id).subscribe();
    }
    this.closeDropdown();
    this.router.navigate([notification.route]);
  }

  // Filters & Helpers
  changeFilter(filter: 'all' | 'unread' | 'today'): void { this.selectedFilter = filter; }
  changeTypeFilter(type: NotificationType | 'all'): void { this.selectedType = type; }

  getFilteredNotifications(): DisplayNotification[] {
    let filtered = [...this.notifications];
    if (this.selectedFilter === 'unread') filtered = filtered.filter(n => n.status === NotificationStatus.UNREAD);
    if (this.selectedFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter(n => new Date(n.created_at) >= today);
    }
    if (this.selectedType !== 'all') filtered = filtered.filter(n => n.notification_type === this.selectedType);
    return filtered;
  }

  hasUnreadNotifications(): boolean { return this.unreadCount > 0; }
  hasNotifications(): boolean { return this.notifications.length > 0; }
  canViewNotifications(): boolean { return this.authService.isAuthenticated(); }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-bell-container') && this.isDropdownOpen) {
      this.closeDropdown();
    }
  }

  onDropdownClick(event: Event): void { event.stopPropagation(); }
  
  viewAllNotifications(event: Event): void {
    event.stopPropagation();
    this.closeDropdown();
    this.router.navigate(['/notifications']);
  }

  openNotificationSettings(event: Event): void {
    event.stopPropagation();
    this.closeDropdown();
    this.router.navigate(['/settings/notifications']);
  }

  // ✅ Language Helpers

  /** Wrapper function สำหรับเรียกใช้ Translation ใน TS ได้สะดวก */
  translate(key: string, params?: any): string {
    const translation = this.languageService.translate(key, params);
    // กรณีหา key ไม่เจอ และมี defaultValue (fallback logic)
    if (translation === key && params?.defaultValue) {
        return params.defaultValue;
    }
    return translation;
  }

  /** อัปเดต TimeAgo ของทุก item ใน list (ใช้เมื่อเปลี่ยนภาษา) */
  private updateTimeAgoForList(): void {
    this.notifications = this.notifications.map(n => ({
      ...n,
      timeAgo: this.formatTimeAgo(n.created_at)
    }));
  }

  formatTimeAgo(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const isThai = this.languageService.isThaiLanguage(); // ✅ เช็คภาษาจาก Service

    if (seconds < 60) return isThai ? 'เมื่อสักครู่' : 'Just now';
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return isThai ? `${minutes} นาทีที่แล้ว` : `${minutes} m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return isThai ? `${hours} ชั่วโมงที่แล้ว` : `${hours} h ago`;
    
    const days = Math.floor(hours / 24);
    return isThai ? `${days} วันที่แล้ว` : `${days} d ago`;
  }

  getNotificationIcon(type: NotificationType | string): string {
    const icons: any = {
      'NEW_TICKET': 'bi-plus-circle-fill',
      'STATUS_CHANGE': 'bi-arrow-repeat',
      'ASSIGNMENT': 'bi-person-check-fill'
    };
    return icons[type] || 'bi-bell-fill';
  }

  getNotificationColor(type: NotificationType | string): string {
    const colors: any = {
      'NEW_TICKET': '#6c5ce7',
      'STATUS_CHANGE': '#74b9ff',
      'ASSIGNMENT': '#fdcb6e',
    };
    return colors[type] || '#6c5ce7';
  }

  getPriorityBadgeClass(priority: NotificationPriority): string {
    const classes: any = {
      [NotificationPriority.LOW]: 'badge-success',
      [NotificationPriority.MEDIUM]: 'badge-info',
      [NotificationPriority.HIGH]: 'badge-warning',
    };
    return classes[priority];
  }

  // ✅ ส่ง Current Language ไปให้ Helper functions ของ Model
  getNotificationTypeLabel(type: NotificationType | string): string { 
    return getNotificationTypeLabel(type, this.languageService.getCurrentLanguage()); 
  }
  
  getNotificationPriorityLabel(priority: NotificationPriority): string { 
    return getNotificationPriorityLabel(priority, this.languageService.getCurrentLanguage()); 
  }
  
  trackByNotificationId(index: number, notification: DisplayNotification): number { return notification.id; }
  truncateText(text: string, maxLength: number = 50): string { return text.length <= maxLength ? text : text.substring(0, maxLength) + '...'; }
}