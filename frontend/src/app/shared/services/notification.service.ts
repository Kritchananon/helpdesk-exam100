// src/app/shared/services/notification.service.ts
// ✅ FINAL VERSION - HTTP Polling + Backward Compatibility

import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, Subject, timer, Subscription } from 'rxjs';
import { catchError, tap, takeUntil, map, switchMap, finalize, retryWhen, delay, take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

// Import Models
import {
  AppNotification,
  NotificationSummary,
  NotificationSettings,
  NotificationStatus,
  DEFAULT_NOTIFICATION_SETTINGS,
  BackendNotificationListResponse,
  transformBackendToApp,
  transformBackendSummary,
  NotificationPayload,
  NotificationResponse
} from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService implements OnDestroy {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = environment.apiUrl;
  
  // ===== STATE MANAGEMENT =====
  private notificationsSubject = new BehaviorSubject<AppNotification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private summarySubject = new BehaviorSubject<NotificationSummary | null>(null);
  public summary$ = this.summarySubject.asObservable();

  private settingsSubject = new BehaviorSubject<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  public settings$ = this.settingsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  public error$ = this.errorSubject.asObservable();

  // ===== CONFIGURATION =====
  private readonly CACHE_KEY = 'app_notifications_cache';
  private readonly SETTINGS_KEY = 'app_notification_settings';
  
  // ✅ Polling Configuration
  private readonly POLLING_INTERVAL = 30000; // ดึงข้อมูลทุก 30 วินาที
  private pollingSubscription: Subscription | null = null;
  
  private destroy$ = new Subject<void>();
  private isFetchingNotifications = false;

  constructor() {
    this.initializeService();
  }

  private initializeService(): void {
    this.loadSettingsFromStorage();
    this.loadCachedNotifications();

    // เริ่ม/หยุด Polling ตามสถานะ Login
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        if (state.isAuthenticated) {
          // Fetch ครั้งแรกทันทีเมื่อ Login
          this.fetchNotifications().subscribe(); 
          // เริ่มระบบ Polling
          this.startPolling(); 
        } else {
          this.stopPolling();
          this.clearNotifications();
        }
      });
  }

  // ===== POLLING LOGIC ===== ✅
  
  private startPolling(): void {
    this.stopPolling(); // Clear existing if any

    console.log(`🔄 Starting notification polling (Every ${this.POLLING_INTERVAL / 1000}s)`);
    
    // ใช้ timer: รอ POLLING_INTERVAL แล้วทำซ้ำทุก POLLING_INTERVAL
    this.pollingSubscription = timer(this.POLLING_INTERVAL, this.POLLING_INTERVAL)
      .pipe(
        takeUntil(this.destroy$),
        // ใช้ switchMap เพื่อยกเลิก request เก่าถ้า request ใหม่มาถึง
        switchMap(() => {
          // ใช้ fetch แบบเงียบ (ไม่ loading spinner) ตอน polling
          return this.fetchNotifications(true); 
        })
      )
      .subscribe({
        next: () => { /* Log handled in fetchNotifications */ },
        error: (err) => console.error('Polling error:', err)
      });
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      console.log('🛑 Stopping notification polling');
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  // ===== API METHODS =====

  /**
   * Fetch notifications
   * @param isBackground ถ้า true จะไม่แสดง loading spinner (ใช้สำหรับ polling)
   */
  public fetchNotifications(isBackground: boolean = false): Observable<AppNotification[]> {
    // ป้องกัน Race Condition
    if (this.isFetchingNotifications) {
      return new Observable(obs => { 
        obs.next(this.notificationsSubject.value); 
        obs.complete(); 
      });
    }
    
    this.isFetchingNotifications = true;
    
    // Only show loading state if not a background poll
    if (!isBackground) {
      this.loadingSubject.next(true);
      this.errorSubject.next(null);
    }

    return this.http.get<BackendNotificationListResponse>(
      `${this.apiUrl}/notifications/list`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      retryWhen(errors => errors.pipe(delay(1000), take(2))),
      tap(response => {
        if (response.success && response.data) {
          const transformedNotifications = response.data.notifications.map(n => transformBackendToApp(n));
          
          // Update State
          this.notificationsSubject.next(transformedNotifications);
          
          const unreadCount = this.getSafeNumber(response.data.summary.unread_count);
          this.unreadCountSubject.next(unreadCount);
          
          const transformedSummary = transformBackendSummary(response.data.summary, transformedNotifications);
          this.summarySubject.next(transformedSummary);
          
          this.cacheNotifications(transformedNotifications);
        }
      }),
      map(response => response.data.notifications.map(n => transformBackendToApp(n))),
      finalize(() => {
        if (!isBackground) this.loadingSubject.next(false);
        this.isFetchingNotifications = false;
      }),
      catchError(error => this.handleError(error))
    );
  }

  public markAsRead(notificationId: number): Observable<any> {
    // Optimistic Update
    const currentList = this.notificationsSubject.value;
    const updatedList = currentList.map(n => 
      n.id === notificationId ? { ...n, status: NotificationStatus.READ, read_at: new Date().toISOString() } : n
    );
    this.notificationsSubject.next(updatedList);
    this.updateSummaryLocal();

    return this.http.patch(
      `${this.apiUrl}/markAsRead/${notificationId}`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  public markAllAsRead(): Observable<any> {
    const currentList = this.notificationsSubject.value;
    const updatedList = currentList.map(n => ({ 
      ...n, 
      status: NotificationStatus.READ,
      read_at: new Date().toISOString() 
    }));
    this.notificationsSubject.next(updatedList);
    this.unreadCountSubject.next(0);
    this.updateSummaryLocal();

    return this.http.patch(
      `${this.apiUrl}/read-all`,
      {},
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  public deleteNotification(notificationId: number): Observable<any> {
    const currentList = this.notificationsSubject.value;
    const updatedList = currentList.filter(n => n.id !== notificationId);
    this.notificationsSubject.next(updatedList);
    this.updateSummaryLocal();

    return this.http.delete(
      `${this.apiUrl}/delete-notification/${notificationId}`,
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  public deleteAllNotifications(): Observable<any> {
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
    this.summarySubject.next(null);
    this.clearCache();

    return this.http.delete(
      `${this.apiUrl}/delete-all-notifications`,
      { headers: this.getAuthHeaders() }
    ).pipe(catchError(this.handleError.bind(this)));
  }

  public notifyTicketChanges(payload: NotificationPayload): Observable<NotificationResponse> {
    return this.http.post<{ success: boolean; message: string; data: any[]; summary?: any; }>(
      `${this.apiUrl}/notify-changes`,
      payload,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(() => {
        this.fetchNotifications().subscribe();
      }),
      map(response => ({
        success: response.success,
        message: response.message,
        data: response.data?.map(n => transformBackendToApp(n)) || [],
        summary: response.summary
      })),
      catchError(this.handleError.bind(this))
    );
  }

  // =================================================================
  // ✅ COMPATIBILITY LAYER (Backward Compatibility for HeaderComponent)
  // =================================================================
  // ส่วนนี้ถูกเพิ่มเข้ามาเพื่อให้ HeaderComponent เดิมทำงานได้โดยไม่เกิด Error
  // เนื่องจาก HeaderComponent ยังคงเรียกใช้คำสั่ง WebSocket อยู่
  
  // 1. Mock connection state as always 'connected' for Polling
  public connectionState$ = new BehaviorSubject<'connected' | 'disconnected' | 'connecting'>('connected');

  // 2. Mock connect method (No-op)
  public connectSocket(): void {
    // ไม่ทำอะไร เพราะเราใช้ HTTP Polling แทนแล้ว
    console.log('⚠️ connectSocket called by HeaderComponent (Ignored: Using HTTP Polling)');
  }

  // 3. Mock disconnect method (No-op)
  public disconnectSocket(): void {
    // ไม่ทำอะไร
  }

  // 4. Mock isConnected check
  public isConnected(): boolean {
    // คืนค่า true เสมอ เพื่อไม่ให้ Header พยายาม connect ใหม่
    return true;
  }
  
  // =================================================================


  // ===== HELPER METHODS =====

  private updateSummaryLocal(): void {
    const notifications = this.notificationsSubject.value;
    const unreadCount = notifications.filter(n => n.status === NotificationStatus.UNREAD).length;
    
    this.unreadCountSubject.next(unreadCount);

    const currentSummary = this.summarySubject.value;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = notifications.filter(n => new Date(n.created_at) >= today).length;

    if (currentSummary) {
      this.summarySubject.next({
        ...currentSummary,
        unread: unreadCount,
        total: notifications.length,
        today: todayCount
      });
    }
  }

  private getSafeNumber(value: any): number {
    const num = Number(value);
    return (Number.isNaN(num) || !Number.isFinite(num) || num < 0) ? 0 : Math.floor(num);
  }

  // ===== CACHE & SETTINGS =====
  
  private cacheNotifications(notifications: AppNotification[]): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify({ notifications, timestamp: new Date().toISOString() }));
    } catch (e) { console.warn('Cache error', e); }
  }

  private loadCachedNotifications(): void {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        this.notificationsSubject.next(data.notifications || []);
        this.updateSummaryLocal();
      }
    } catch (e) { console.warn('Load cache error', e); }
  }

  private clearCache(): void { localStorage.removeItem(this.CACHE_KEY); }
  
  private clearNotifications(): void {
    this.notificationsSubject.next([]);
    this.unreadCountSubject.next(0);
    this.clearCache();
  }

  private loadSettingsFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.SETTINGS_KEY);
      if (saved) this.settingsSubject.next(JSON.parse(saved));
    } catch (e) {}
  }

  public updateSettings(settings: NotificationSettings): void {
    this.settingsSubject.next(settings);
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
  }

  public getSettings(): NotificationSettings {
    return this.settingsSubject.value;
  }

  // ===== AUTH & ERROR =====

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      if (error.status === 401) this.authService.logout();
      errorMessage = error.error?.message || errorMessage;
    }
    this.errorSubject.next(errorMessage);
    return throwError(() => errorMessage);
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }
}