import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { PWAService, PWANotification, PWACacheInfo, TicketSyncStatus } from '../../services/pwa.service';

@Component({
  selector: 'app-pwa-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pwa-indicator.component.html',
  styleUrls: ['./pwa-indicator.component.css']
})
export class PWAIndicatorComponent implements OnInit, OnDestroy {
  
  // ✅ Component State (ใช้ logic ใหม่)
  isOnline = true;
  canInstall = false;
  notifications: PWANotification[] = [];
  cacheInfo: PWACacheInfo | null = null;
  syncStatus: TicketSyncStatus | null = null;
  showCacheDetails = false;
  
  // ✅ UI State (สำหรับ FAB style เก่า)
  isInstallable = false;
  hasUpdate = false;
  showInfoPanel = false;
  showQuickActions = false;

  private subscriptions: Subscription[] = [];

  constructor(private pwaService: PWAService) {}

  ngOnInit(): void {
    this.initializeSubscriptions();
    this.loadCacheInfo();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeSubscriptions(): void {
    // ✅ Subscribe to online status (logic ใหม่)
    this.subscriptions.push(
      this.pwaService.isOnline().subscribe(isOnline => {
        this.isOnline = isOnline;
        if (isOnline) {
          this.loadCacheInfo(); // Refresh cache info when back online
        }
      })
    );

    // ✅ Subscribe to installation availability (รวม logic ใหม่กับเก่า)
    this.subscriptions.push(
      this.pwaService.isInstallable().subscribe(canInstall => {
        this.canInstall = canInstall;
        this.isInstallable = canInstall; // สำหรับ template เก่า
      })
    );

    // ✅ Subscribe to notifications (logic ใหม่)
    this.subscriptions.push(
      this.pwaService.getNotifications().subscribe(notifications => {
        this.notifications = notifications;
      })
    );

    // ✅ Subscribe to sync status (logic ใหม่)
    this.subscriptions.push(
      this.pwaService.getTicketSyncStatus().subscribe(status => {
        this.syncStatus = status;
      })
    );

    // ✅ Subscribe to update availability (เพิ่มสำหรับ FAB เก่า)
    if (this.pwaService.hasUpdateAvailable) {
      this.subscriptions.push(
        this.pwaService.hasUpdateAvailable().subscribe(hasUpdate => {
          this.hasUpdate = hasUpdate;
        })
      );
    }
  }

  private async loadCacheInfo(): Promise<void> {
    try {
      this.cacheInfo = await this.pwaService.getCacheInfo();
    } catch (error) {
      console.warn('⚠️ PWA Indicator: Failed to load cache info:', error);
    }
  }

  // ✅ Actions (รวม logic ใหม่กับเก่า)
  
  async refreshData(): Promise<void> {
    if (!this.isOnline || this.syncStatus?.isSyncing) {
      return;
    }

    try {
      await this.pwaService.refreshTickets();
      await this.loadCacheInfo(); // Reload cache info after refresh
    } catch (error) {
      console.error('❌ PWA Indicator: Refresh failed:', error);
    }
  }

  toggleCacheDetails(): void {
    this.showCacheDetails = !this.showCacheDetails;
  }

  async clearCache(): Promise<void> {
    try {
      await this.pwaService.clearCache('all');
      await this.loadCacheInfo(); // Reload cache info after clearing
    } catch (error) {
      console.error('❌ PWA Indicator: Clear cache failed:', error);
    }
  }

  // ✅ FAB Actions (สำหรับ UI เก่า)
  async installPWA(): Promise<void> {
    try {
      const installed = await this.pwaService.installPWA();
      if (installed) {
        this.canInstall = false;
        this.isInstallable = false;
      }
    } catch (error) {
      console.error('❌ PWA Indicator: Installation failed:', error);
    }
  }

  async installApp(): Promise<void> {
    await this.installPWA();
  }

  async updateApp(): Promise<void> {
    if (this.pwaService.updateApp) {
      await this.pwaService.updateApp();
    }
  }

  toggleInfoPanel(): void {
    this.showInfoPanel = !this.showInfoPanel;
    if (this.showInfoPanel) {
      this.loadCacheInfo();
    }
  }

  async clearAllCache(): Promise<void> {
    if (confirm('คุณต้องการล้างแคชทั้งหมดหรือไม่? การดำเนินการนี้จะทำให้ต้องโหลดข้อมูลใหม่')) {
      await this.clearCache();
    }
  }

  async refreshCacheInfo(): Promise<void> {
    await this.loadCacheInfo();
  }

  executeNotificationAction(notification: PWANotification): void {
    if (notification.action) {
      notification.action();
    }
  }

  dismissNotification(id: string): void {
    this.pwaService.removeNotification(id);
  }

  // ✅ Utility Methods (รวมจากทั้งสอง version)
  
  trackNotification(index: number, notification: PWANotification): string {
    return notification.id;
  }

  formatCacheSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  formatBytes(bytes: number): string {
    return this.formatCacheSize(bytes);
  }

  formatLastSync(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'เมื่อสักครู่';
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} วันที่แล้ว`;
  }

  formatTime(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'เมื่อสักครู่';
    if (minutes === 1) return '1 นาทีที่แล้ว';
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 ชั่วโมงที่แล้ว';
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    
    const days = Math.floor(hours / 24);
    return `${days} วันที่แล้ว`;
  }
}