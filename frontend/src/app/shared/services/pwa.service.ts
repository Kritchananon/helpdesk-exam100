import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge, timer } from 'rxjs';
import { map, distinctUntilChanged, startWith, takeUntil } from 'rxjs/operators';
// import { environment } from '../../../environments/environment'; // ใช้เมื่อจำเป็น

// ✅ PWA Notification Types
export interface PWANotification {
  id: string;
  type: 'offline' | 'online' | 'cache-used' | 'update-available' | 'error' | 'sync-success' | 'sync-failed' | 'ticket-cached' | 'ticket-synced';
  title: string;
  message: string;
  timestamp: Date;
  persistent?: boolean;
  action?: () => void;
  metadata?: {
    ticketCount?: number;
    syncItemsCount?: number;
    cacheSize?: string;
    errorCode?: string;
  };
}

// ✅ PWA Cache Info
export interface PWACacheInfo {
  totalSize: number;
  itemCount: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  categories: {
    hasCache: boolean;
    ageInMinutes: number;
    dataCount: number;
  };
  projects: {
    hasCache: boolean;
    ageInMinutes: number;
    dataCount: number;
  };
  // ✅ NEW: Ticket cache info
  tickets: {
    hasCache: boolean;
    ageInMinutes: number;
    dataCount: number;
    isStale: boolean;
    lastSync: Date | null;
  };
}

// ✅ NEW: Ticket Sync Status
export interface TicketSyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  syncProgress: number; // 0-100
  cacheStatus: 'fresh' | 'stale' | 'offline-only' | 'empty';
  errors: string[];
}

// ✅ NEW: API Notification Event
export interface APINotificationEvent {
  type: string;
  title: string;
  message: string;
  metadata?: any;
}

@Injectable({
  providedIn: 'root'
})
export class PWAService {
  
  // ✅ Online/Offline Status
  private onlineStatus$ = new BehaviorSubject<boolean>(navigator.onLine);
  private notifications$ = new BehaviorSubject<PWANotification[]>([]);
  
  // ✅ PWA Installation
  private deferredPrompt: any = null;
  private isInstallable$ = new BehaviorSubject<boolean>(false);
  
  // ✅ Service Worker
  private swRegistration: ServiceWorkerRegistration | null = null;
  private updateAvailable$ = new BehaviorSubject<boolean>(false);

  // ===== NEW: Ticket Sync Management ===== ✅
  private ticketSyncStatus$ = new BehaviorSubject<TicketSyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
    syncProgress: 0,
    cacheStatus: 'empty',
    errors: []
  });

  private syncInProgress = false;
  private syncQueue: Array<{id: string, type: string, timestamp: Date}> = [];
  private autoSyncTimer: any = null;

  constructor() {
    this.initializeOnlineStatus();
    this.initializePWAEvents();
    this.initializeServiceWorker();
    this.listenToCustomEvents();
    
    // ✅ NEW: Initialize ticket sync features
    this.initializeTicketSync();
    this.startAutoSync();
  }

  // ===== NEW: Ticket Sync Initialization ===== ✅

  private initializeTicketSync(): void {
    console.log('📱 PWA: Initializing ticket sync features');

    // ฟัง network status changes เพื่อ auto sync
    this.onlineStatus$.subscribe(isOnline => {
      this.updateTicketSyncStatus({ isOnline });
      
      if (isOnline && !this.syncInProgress) {
        // Auto sync เมื่อกลับมา online
        setTimeout(() => this.triggerTicketSync(), 2000);
      }
    });

    // โหลด sync queue จาก localStorage
    this.loadSyncQueue();
  }

  private startAutoSync(): void {
    // Auto sync ทุก 5 นาที เมื่อ online
    this.autoSyncTimer = timer(0, 5 * 60 * 1000).subscribe(() => {
      if (this.getCurrentOnlineStatus() && !this.syncInProgress) {
        this.triggerTicketSync(true); // silent sync
      }
    });
  }

  // ===== NEW: Ticket Sync Methods ===== ✅

  /**
   * ✅ NEW: เริ่ม sync process
   */
  async triggerTicketSync(silent: boolean = false): Promise<boolean> {
    if (this.syncInProgress) {
      console.log('📱 PWA: Sync already in progress');
      return false;
    }

    console.log('📱 PWA: Starting ticket sync', { silent });
    this.syncInProgress = true;
    
    this.updateTicketSyncStatus({ 
      isSyncing: true, 
      syncProgress: 0,
      errors: []
    });

    if (!silent) {
      this.addNotification({
        type: 'sync-success',
        title: 'กำลังซิงค์ข้อมูล',
        message: 'กำลังอัปเดตข้อมูลตั๋วล่าสุด...'
      });
    }

    try {
      // Dispatch event ให้ API service ประมวลผล sync queue
      const syncResult = await this.requestAPISync();
      
      this.updateTicketSyncStatus({ 
        isSyncing: false,
        syncProgress: 100,
        lastSyncTime: new Date(),
        pendingCount: 0
      });

      if (syncResult.success) {
        if (!silent) {
          this.addNotification({
            type: 'sync-success',
            title: 'ซิงค์สำเร็จ',
            message: `อัปเดตข้อมูล ${syncResult.itemsProcessed} รายการเรียบร้อย`,
            metadata: {
              syncItemsCount: syncResult.itemsProcessed
            }
          });
        }
        
        // Clear processed items from queue
        this.clearProcessedSyncItems(syncResult.processedIds);
        console.log('✅ PWA: Sync completed successfully');
        return true;

      } else {
        throw new Error(syncResult.error || 'Sync failed');
      }

    } catch (error) {
      console.error('❌ PWA: Sync failed:', error);
      
      this.updateTicketSyncStatus({ 
        isSyncing: false,
        syncProgress: 0,
        errors: [error instanceof Error ? error.message : 'Unknown sync error']
      });

      if (!silent) {
        this.addNotification({
          type: 'sync-failed',
          title: 'ซิงค์ล้มเหลว',
          message: 'ไม่สามารถอัปเดตข้อมูลได้ จะลองใหม่ภายหลัง',
          persistent: true,
          action: () => this.triggerTicketSync()
        });
      }

      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * ✅ NEW: ส่งคำขอ sync ไป API service
   */
  private requestAPISync(): Promise<{
    success: boolean;
    itemsProcessed: number;
    processedIds: string[];
    error?: string;
  }> {
    return new Promise((resolve) => {
      // ส่ง custom event ให้ API service
      const syncEvent = new CustomEvent('pwa-request-sync', {
        detail: {
          queueItems: this.syncQueue,
          timestamp: new Date()
        }
      });

      // ฟังผลลัพธ์
      const handleSyncResult = (event: any) => {
        window.removeEventListener('pwa-sync-result', handleSyncResult);
        resolve(event.detail);
      };

      window.addEventListener('pwa-sync-result', handleSyncResult);
      window.dispatchEvent(syncEvent);

      // Timeout หลัง 30 วินาที
      setTimeout(() => {
        window.removeEventListener('pwa-sync-result', handleSyncResult);
        resolve({
          success: false,
          itemsProcessed: 0,
          processedIds: [],
          error: 'Sync timeout'
        });
      }, 30000);
    });
  }

  /**
   * ✅ NEW: เพิ่ม item ใน sync queue
   */
  addToSyncQueue(item: {
    id: string;
    type: 'ticket-refresh' | 'ticket-create' | 'ticket-update' | 'ticket-delete';
    data?: any;
  }): void {
    const queueItem = {
      ...item,
      timestamp: new Date()
    };

    this.syncQueue.push(queueItem);
    this.saveSyncQueue();
    
    this.updateTicketSyncStatus({ 
      pendingCount: this.syncQueue.length 
    });

    console.log('📤 PWA: Added to sync queue:', item.type, item.id);
  }

  /**
   * ✅ NEW: ล้าง items ที่ประมวลผลแล้ว
   */
  private clearProcessedSyncItems(processedIds: string[]): void {
    this.syncQueue = this.syncQueue.filter(item => 
      !processedIds.includes(item.id)
    );
    this.saveSyncQueue();
    
    this.updateTicketSyncStatus({ 
      pendingCount: this.syncQueue.length 
    });
  }

  /**
   * ✅ NEW: บันทึก sync queue
   */
  private saveSyncQueue(): void {
    try {
      localStorage.setItem('pwa_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.warn('⚠️ PWA: Failed to save sync queue:', error);
    }
  }

  /**
   * ✅ NEW: โหลด sync queue
   */
  private loadSyncQueue(): void {
    try {
      const queueStr = localStorage.getItem('pwa_sync_queue');
      if (queueStr) {
        this.syncQueue = JSON.parse(queueStr);
        this.updateTicketSyncStatus({ 
          pendingCount: this.syncQueue.length 
        });
        console.log('📤 PWA: Loaded sync queue:', this.syncQueue.length, 'items');
      }
    } catch (error) {
      console.warn('⚠️ PWA: Failed to load sync queue:', error);
      this.syncQueue = [];
    }
  }

  /**
   * ✅ NEW: อัปเดต ticket sync status
   */
  private updateTicketSyncStatus(updates: Partial<TicketSyncStatus>): void {
    const currentStatus = this.ticketSyncStatus$.value;
    const newStatus = { ...currentStatus, ...updates };
    this.ticketSyncStatus$.next(newStatus);
  }

  /**
   * ✅ NEW: ได้รับ ticket sync status
   */
  getTicketSyncStatus(): Observable<TicketSyncStatus> {
    return this.ticketSyncStatus$.asObservable();
  }

  /**
   * ✅ NEW: ได้รับ sync status ปัจจุบัน
   */
  getCurrentSyncStatus(): TicketSyncStatus {
    return this.ticketSyncStatus$.value;
  }

  /**
   * ✅ NEW: Manual refresh tickets
   */
  async refreshTickets(): Promise<boolean> {
    console.log('📱 PWA: Manual ticket refresh requested');
    
    // เพิ่ม refresh request ใน queue
    this.addToSyncQueue({
      id: `refresh_${Date.now()}`,
      type: 'ticket-refresh'
    });

    // Trigger sync ทันที
    return this.triggerTicketSync();
  }

  /**
   * ✅ NEW: ได้ข้อมูล cache status สำหรับ tickets
   */
  async getTicketCacheStatus(): Promise<{
    hasCache: boolean;
    isStale: boolean;
    count: number;
    lastSync: Date | null;
    ageInMinutes: number;
    sizeInKB: number;
  }> {
    try {
      // ส่งคำขอไป API service
      const event = new CustomEvent('pwa-request-cache-status');
      
      return new Promise((resolve) => {
        const handleCacheStatus = (event: any) => {
          window.removeEventListener('pwa-cache-status-result', handleCacheStatus);
          resolve(event.detail);
        };

        window.addEventListener('pwa-cache-status-result', handleCacheStatus);
        window.dispatchEvent(event);

        // Fallback หลัง 5 วินาที
        setTimeout(() => {
          window.removeEventListener('pwa-cache-status-result', handleCacheStatus);
          resolve({
            hasCache: false,
            isStale: true,
            count: 0,
            lastSync: null,
            ageInMinutes: 0,
            sizeInKB: 0
          });
        }, 5000);
      });

    } catch (error) {
      console.warn('⚠️ PWA: Failed to get cache status:', error);
      return {
        hasCache: false,
        isStale: true,
        count: 0,
        lastSync: null,
        ageInMinutes: 0,
        sizeInKB: 0
      };
    }
  }

  // ✅ Online/Offline Status Management (existing + enhanced)
  
  private initializeOnlineStatus(): void {
    // ✅ Listen to online/offline events
    merge(
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false))
    ).pipe(
      startWith(navigator.onLine),
      distinctUntilChanged()
    ).subscribe(isOnline => {
      console.log('📱 PWA: Network status changed:', isOnline ? 'Online' : 'Offline');
      
      this.onlineStatus$.next(isOnline);
      
      // ✅ Show notification when status changes
      this.addNotification({
        type: isOnline ? 'online' : 'offline',
        title: isOnline ? 'เชื่อมต่ออินเทอร์เน็ตแล้ว' : 'ออฟไลน์',
        message: isOnline 
          ? 'กลับมาออนไลน์แล้ว ข้อมูลจะอัปเดตอัตโนมัติ' 
          : 'ไม่มีการเชื่อมต่ออินเทอร์เน็ต จะใช้ข้อมูลที่เก็บไว้',
        persistent: !isOnline,
        // ✅ NEW: Add refresh action when back online
        action: isOnline ? () => this.refreshTickets() : undefined
      });
    });
  }

  public isOnline(): Observable<boolean> {
    return this.onlineStatus$.asObservable();
  }

  public getCurrentOnlineStatus(): boolean {
    return this.onlineStatus$.value;
  }

  // ✅ PWA Installation Management (existing)
  
  private initializePWAEvents(): void {
    // ✅ Listen for PWA installation prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('📱 PWA: Install prompt available');
      e.preventDefault();
      this.deferredPrompt = e;
      this.isInstallable$.next(true);
      
      this.addNotification({
        type: 'update-available',
        title: 'ติดตั้งแอปพลิเคชัน',
        message: 'คลิกเพื่อติดตั้งแอปบนหน้าจอหลัก',
        action: () => this.installPWA()
      });
    });

    // ✅ Listen for successful installation
    window.addEventListener('appinstalled', () => {
      console.log('📱 PWA: App installed successfully');
      this.deferredPrompt = null;
      this.isInstallable$.next(false);
      
      this.addNotification({
        type: 'online',
        title: 'ติดตั้งสำเร็จ',
        message: 'แอปพลิเคชันถูกติดตั้งบนหน้าจอหลักแล้ว'
      });
    });
  }

  public async installPWA(): Promise<boolean> {
    if (!this.deferredPrompt) {
      console.warn('📱 PWA: No install prompt available');
      return false;
    }

    try {
      const result = await this.deferredPrompt.prompt();
      console.log('📱 PWA: Install prompt result:', result.outcome);
      
      if (result.outcome === 'accepted') {
        this.deferredPrompt = null;
        this.isInstallable$.next(false);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('📱 PWA: Install error:', error);
      return false;
    }
  }

  public isInstallable(): Observable<boolean> {
    return this.isInstallable$.asObservable();
  }

  // ✅ Service Worker Management (existing)
  
  private async initializeServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/ngsw-worker.js');
        this.swRegistration = registration;
        
        console.log('📱 PWA: Service Worker registered:', registration.scope);
        
        // ✅ Listen for updates
        registration.addEventListener('updatefound', () => {
          console.log('📱 PWA: Update found');
          this.updateAvailable$.next(true);
          
          this.addNotification({
            type: 'update-available',
            title: 'อัปเดตใหม่',
            message: 'มีเวอร์ชั่นใหม่ของแอป คลิกเพื่ออัปเดต',
            persistent: true,
            action: () => this.updateApp()
          });
        });

      } catch (error) {
        console.error('📱 PWA: Service Worker registration failed:', error);
      }
    }
  }

  public async updateApp(): Promise<void> {
    if (!this.swRegistration) return;

    try {
      await this.swRegistration.update();
      
      // ✅ Force page reload to use new version
      window.location.reload();
      
    } catch (error) {
      console.error('📱 PWA: Update failed:', error);
      
      this.addNotification({
        type: 'error',
        title: 'อัปเดตล้มเหลว',
        message: 'ไม่สามารถอัปเดตแอปได้ กรุณาลองใหม่อีกครั้ง'
      });
    }
  }

  public hasUpdateAvailable(): Observable<boolean> {
    return this.updateAvailable$.asObservable();
  }

  // ===== ENHANCED: Custom Events Listener ===== ✅
  
  private listenToCustomEvents(): void {
    // ✅ Listen to dropdown offline events (existing)
    window.addEventListener('pwa-offline-data', (event: any) => {
      const { component, message } = event.detail;
      
      this.addNotification({
        type: 'cache-used',
        title: 'ใช้ข้อมูลที่เก็บไว้',
        message: message || `กำลังใช้ข้อมูลที่เก็บไว้สำหรับ ${component}`
      });
    });

    // ✅ NEW: Listen to API notifications
    window.addEventListener('pwa-api-notification', (event: any) => {
      const { type, title, message, metadata } = event.detail as APINotificationEvent;
      
      this.addNotification({
        type: type as any,
        title,
        message,
        metadata
      });
    });

    // ✅ NEW: Handle cache status requests
    window.addEventListener('pwa-request-cache-status', () => {
      this.handleCacheStatusRequest();
    });

    // ✅ NEW: Handle sync requests
    window.addEventListener('pwa-request-sync', (event: any) => {
      this.handleSyncRequest(event.detail);
    });
  }

  /**
   * ✅ NEW: จัดการ cache status request
   */
  private async handleCacheStatusRequest(): Promise<void> {
    try {
      // ดึงข้อมูล cache status จาก localStorage
      const ticketCacheStr = localStorage.getItem('pwa_tickets_cache');
      
      let cacheStatus: {
        hasCache: boolean;
        isStale: boolean;
        count: number;
        lastSync: Date | null;
        ageInMinutes: number;
        sizeInKB: number;
      } = {
        hasCache: false,
        isStale: true,
        count: 0,
        lastSync: null,
        ageInMinutes: 0,
        sizeInKB: 0
      };

      if (ticketCacheStr) {
        const cacheData = JSON.parse(ticketCacheStr);
        const now = new Date().getTime();
        const cacheTime = new Date(cacheData.timestamp).getTime();
        const ageInMinutes = Math.floor((now - cacheTime) / (1000 * 60));
        const sizeInKB = Math.round(ticketCacheStr.length / 1024);

        cacheStatus = {
          hasCache: true,
          isStale: ageInMinutes > 2, // 2 minutes threshold
          count: cacheData.tickets?.length || 0,
          lastSync: cacheData.lastSync ? new Date(cacheData.lastSync) : null,
          ageInMinutes,
          sizeInKB
        };
      }

      // อัปเดต sync status
      this.updateTicketSyncStatus({
        cacheStatus: cacheStatus.hasCache 
          ? (cacheStatus.isStale ? 'stale' : 'fresh')
          : 'empty'
      });

      // ส่งผลลัพธ์กลับ
      const resultEvent = new CustomEvent('pwa-cache-status-result', {
        detail: cacheStatus
      });
      window.dispatchEvent(resultEvent);

    } catch (error) {
      console.warn('⚠️ PWA: Error handling cache status request:', error);
    }
  }

  /**
   * ✅ NEW: จัดการ sync request
   */
  private handleSyncRequest(detail: any): void {
    console.log('📱 PWA: Handling sync request:', detail);
    
    // ส่งผลลัพธ์ mock สำหรับ demo
    // ในการใช้งานจริง จะต้องเชื่อมต่อกับ API service
    setTimeout(() => {
      const result = {
        success: true,
        itemsProcessed: detail.queueItems?.length || 0,
        processedIds: detail.queueItems?.map((item: any) => item.id) || [],
        error: null
      };

      const resultEvent = new CustomEvent('pwa-sync-result', {
        detail: result
      });
      window.dispatchEvent(resultEvent);
    }, 1000);
  }

  // ✅ Notification Management (existing + enhanced)
  
  private addNotification(notification: Omit<PWANotification, 'id' | 'timestamp'>): void {
    const newNotification: PWANotification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date()
    };
    
    const currentNotifications = this.notifications$.value;
    
    // ✅ Remove duplicate notifications
    const filteredNotifications = currentNotifications.filter(n => 
      !(n.type === newNotification.type && n.title === newNotification.title)
    );
    
    const updatedNotifications = [newNotification, ...filteredNotifications];
    
    // ✅ Keep only last 10 notifications
    if (updatedNotifications.length > 10) {
      updatedNotifications.splice(10);
    }
    
    this.notifications$.next(updatedNotifications);
    
    // ✅ Auto-remove non-persistent notifications
    if (!newNotification.persistent) {
      setTimeout(() => {
        this.removeNotification(newNotification.id);
      }, 5000);
    }
  }

  public removeNotification(id: string): void {
    const currentNotifications = this.notifications$.value;
    const updatedNotifications = currentNotifications.filter(n => n.id !== id);
    this.notifications$.next(updatedNotifications);
  }

  public getNotifications(): Observable<PWANotification[]> {
    return this.notifications$.asObservable();
  }

  public clearAllNotifications(): void {
    this.notifications$.next([]);
  }

  // ===== ENHANCED: Cache Management ===== ✅
  
  public async getCacheInfo(): Promise<PWACacheInfo> {
    const categoryStats = await this.getCategoryServiceStats();
    const projectStats = await this.getProjectServiceStats();
    const ticketStats = await this.getTicketServiceStats(); // ✅ NEW
    
    const totalSize = categoryStats.totalSize + projectStats.totalSize + ticketStats.totalSize;
    const itemCount = categoryStats.itemCount + projectStats.itemCount + ticketStats.itemCount;
    
    const allTimestamps = [
      ...categoryStats.timestamps,
      ...projectStats.timestamps,
      ...ticketStats.timestamps // ✅ NEW
    ].filter(t => t > 0);
    
    const oldestEntry = allTimestamps.length > 0 
      ? new Date(Math.min(...allTimestamps)) 
      : null;
    
    const newestEntry = allTimestamps.length > 0 
      ? new Date(Math.max(...allTimestamps)) 
      : null;

    return {
      totalSize,
      itemCount,
      oldestEntry,
      newestEntry,
      categories: {
        hasCache: categoryStats.hasCache,
        ageInMinutes: categoryStats.ageInMinutes,
        dataCount: categoryStats.dataCount
      },
      projects: {
        hasCache: projectStats.hasCache,
        ageInMinutes: projectStats.ageInMinutes,
        dataCount: projectStats.dataCount
      },
      // ✅ NEW: Ticket cache info
      tickets: {
        hasCache: ticketStats.hasCache,
        ageInMinutes: ticketStats.ageInMinutes,
        dataCount: ticketStats.dataCount,
        isStale: ticketStats.isStale,
        lastSync: ticketStats.lastSync
      }
    };
  }

  /**
   * ✅ NEW: ดึงสถิติ ticket cache
   */
  private async getTicketServiceStats(): Promise<{
    totalSize: number;
    itemCount: number;
    timestamps: number[];
    hasCache: boolean;
    ageInMinutes: number;
    dataCount: number;
    isStale: boolean;
    lastSync: Date | null;
  }> {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('pwa_tickets_cache') || key.startsWith('pwa_tickets_sync_queue')
    );
    
    let totalSize = 0;
    const timestamps: number[] = [];
    let hasCache = false;
    let ageInMinutes = 0;
    let dataCount = 0;
    let isStale = false;
    let lastSync: Date | null = null;

    keys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        totalSize += data.length;
        try {
          const parsed = JSON.parse(data);
          if (parsed.timestamp) {
            const timestamp = new Date(parsed.timestamp).getTime();
            timestamps.push(timestamp);
            hasCache = true;
            ageInMinutes = Math.floor((Date.now() - timestamp) / (1000 * 60));
            dataCount += parsed.tickets?.length || parsed.length || 0;
            isStale = ageInMinutes > 2; // 2 minutes threshold
            
            if (parsed.lastSync) {
              lastSync = new Date(parsed.lastSync);
            }
          }
        } catch {
          // Ignore invalid cache entries
        }
      }
    });

    return {
      totalSize,
      itemCount: keys.length,
      timestamps,
      hasCache,
      ageInMinutes,
      dataCount,
      isStale,
      lastSync
    };
  }

  private async getCategoryServiceStats(): Promise<{
    totalSize: number;
    itemCount: number;
    timestamps: number[];
    hasCache: boolean;
    ageInMinutes: number;
    dataCount: number;
  }> {
    // ✅ This would integrate with CategoryService
    // For now, simulate with localStorage inspection
    const keys = Object.keys(localStorage).filter(key => key.startsWith('pwa_categories_cache'));
    let totalSize = 0;
    const timestamps: number[] = [];
    let hasCache = false;
    let ageInMinutes = 0;
    let dataCount = 0;

    keys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        totalSize += data.length;
        try {
          const parsed = JSON.parse(data);
          if (parsed.timestamp) {
            const timestamp = new Date(parsed.timestamp).getTime();
            timestamps.push(timestamp);
            hasCache = true;
            ageInMinutes = Math.floor((Date.now() - timestamp) / (1000 * 60));
            dataCount += parsed.categories?.length || parsed.length || 0;
          }
        } catch {
          // Ignore invalid cache entries
        }
      }
    });

    return {
      totalSize,
      itemCount: keys.length,
      timestamps,
      hasCache,
      ageInMinutes,
      dataCount
    };
  }

  private async getProjectServiceStats(): Promise<{
    totalSize: number;
    itemCount: number;
    timestamps: number[];
    hasCache: boolean;
    ageInMinutes: number;
    dataCount: number;
  }> {
    // ✅ This would integrate with ProjectService
    // For now, simulate with localStorage inspection
    const keys = Object.keys(localStorage).filter(key => key.startsWith('pwa_projects_cache'));
    let totalSize = 0;
    const timestamps: number[] = [];
    let hasCache = false;
    let ageInMinutes = 0;
    let dataCount = 0;

    keys.forEach(key => {
      const data = localStorage.getItem(key);
      if (data) {
        totalSize += data.length;
        try {
          const parsed = JSON.parse(data);
          if (parsed.timestamp) {
            const timestamp = new Date(parsed.timestamp).getTime();
            timestamps.push(timestamp);
            hasCache = true;
            ageInMinutes = Math.floor((Date.now() - timestamp) / (1000 * 60));
            dataCount += parsed.projects?.length || parsed.length || 0;
          }
        } catch {
          // Ignore invalid cache entries
        }
      }
    });

    return {
      totalSize,
      itemCount: keys.length,
      timestamps,
      hasCache,
      ageInMinutes,
      dataCount
    };
  }

  /**
   * ✅ Clear specific cache type
   */
  public async clearCache(type: 'all' | 'categories' | 'projects' | 'tickets' = 'all'): Promise<void> {
    try {
      const keys = Object.keys(localStorage);
      let keysToRemove: string[] = [];

      switch (type) {
        case 'categories':
          keysToRemove = keys.filter(key => key.startsWith('pwa_categories_cache'));
          break;
        case 'projects':
          keysToRemove = keys.filter(key => key.startsWith('pwa_projects_cache'));
          break;
        case 'tickets':
          keysToRemove = keys.filter(key => 
            key.startsWith('pwa_tickets_cache') || key.startsWith('pwa_sync_queue')
          );
          break;
        case 'all':
        default:
          keysToRemove = keys.filter(key => 
            key.startsWith('pwa_categories_cache') ||
            key.startsWith('pwa_projects_cache') ||
            key.startsWith('pwa_tickets_cache') ||
            key.startsWith('pwa_sync_queue')
          );
          break;
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      // Reset sync queue if clearing tickets cache
      if (type === 'tickets' || type === 'all') {
        this.syncQueue = [];
        this.updateTicketSyncStatus({
          pendingCount: 0,
          cacheStatus: 'empty'
        });
      }

      console.log(`📱 PWA: Cleared ${keysToRemove.length} cache entries for type: ${type}`);
      
      this.addNotification({
        type: 'cache-used',
        title: 'ล้างแคชสำเร็จ',
        message: `ลบข้อมูลแคช ${type === 'all' ? 'ทั้งหมด' : type} เรียบร้อยแล้ว`
      });

    } catch (error) {
      console.error('❌ PWA: Failed to clear cache:', error);
      
      this.addNotification({
        type: 'error',
        title: 'ล้างแคชล้มเหลว',
        message: 'ไม่สามารถลบข้อมูลแคชได้ กรุณาลองใหม่อีกครั้ง'
      });
    }
  }

  public async clearTicketCache(): Promise<void> {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith('pwa_tickets_cache') || key.startsWith('pwa_sync_queue')
      );

      keys.forEach(key => localStorage.removeItem(key));

      this.syncQueue = [];
      this.updateTicketSyncStatus({
        pendingCount: 0,
        cacheStatus: 'empty'
      });

      this.addNotification({
        type: 'cache-used',
        title: 'ล้างแคชสำเร็จ',
        message: 'ลบข้อมูลแคชตั๋วเรียบร้อยแล้ว'
      });
    } catch (error) {
      console.error('❌ PWA: Failed to clear ticket cache:', error);
      this.addNotification({
        type: 'error',
        title: 'ล้างแคชล้มเหลว',
        message: 'ไม่สามารถลบข้อมูลแคชตั๋วได้ กรุณาลองใหม่อีกครั้ง'
      });
    }
  }

  /**
   * ✅ Get cache size in human readable format
   */
  public formatCacheSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // ✅ Utility Methods
  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * ✅ Check if app is running in standalone mode (installed PWA)
   */
  public isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone ||
           document.referrer.includes('android-app://');
  }

  /**
   * ✅ Get device info for analytics
   */
  public getDeviceInfo(): {
    isStandalone: boolean;
    isOnline: boolean;
    userAgent: string;
    platform: string;
    screenSize: string;
  } {
    return {
      isStandalone: this.isStandalone(),
      isOnline: this.getCurrentOnlineStatus(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenSize: `${screen.width}x${screen.height}`
    };
  }

  /**
   * ✅ Cleanup resources
   */
  public ngOnDestroy(): void {
    if (this.autoSyncTimer) {
      this.autoSyncTimer.unsubscribe();
    }
    
    // Remove event listeners
    window.removeEventListener('pwa-offline-data', () => {});
    window.removeEventListener('pwa-api-notification', () => {});
    window.removeEventListener('pwa-request-cache-status', () => {});
    window.removeEventListener('pwa-request-sync', () => {});
  }
}