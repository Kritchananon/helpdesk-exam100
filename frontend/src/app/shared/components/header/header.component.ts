// src/app/shared/components/header/header.component.ts

import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service'; // ✅ เพิ่ม Language Service

// ✅ Import Permission Models
import { permissionEnum, UserRole, ROLES } from '../../models/permission.model';
import { User, AuthState, UserWithPermissions } from '../../models/user.model';

// ✅ Import Permission Directives
import { HasPermissionDirective, HasRoleDirective } from '../../directives/permission.directive';

// ✅ Import Components
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';
import { LanguageSelectorComponent } from '../language-selector/language-selector.component'; // ✅ เพิ่ม
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HasPermissionDirective,
    HasRoleDirective,
    NotificationBellComponent,
    LanguageSelectorComponent // ✅ เพิ่ม Language Selector
  ],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private languageService = inject(LanguageService); // ✅ เพิ่ม Language Service
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  // ✅ User and Auth State with enhanced types
  currentUser: UserWithPermissions | null = null;
  authState: AuthState | null = null;
  userPermissions: number[] = [];
  userRoles: UserRole[] = [];
  
  // ✅ UI State
  currentLanguage = 'th';
  isLoading = false;

  // ✅ WebSocket Connection State
  socketConnectionState: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

  // ✅ Token Warning Properties
  showTokenWarning = false;
  isRefreshing = false;
  tokenInfo: any = null;

  // ✅ Permission Enums (for template usage)
  readonly permissionEnum = permissionEnum;
  readonly ROLES = ROLES;

  // ✅ Subscription Management
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    console.log('🔧 Header component initialized');
    this.initializeComponent();
    this.setupSubscriptions();
    
    // ✅ เริ่มการเชื่อมต่อ WebSocket ถ้า user ล็อกอินแล้ว
    if (this.authService.isAuthenticated()) {
      console.log('🔌 User authenticated, connecting WebSocket...');
      this.notificationService.connectSocket();
    }
  }

  ngOnDestroy(): void {
    console.log('🧹 Header component cleanup');
    
    // ✅ ตัดการเชื่อมต่อ WebSocket ก่อน cleanup
    console.log('🔌 Disconnecting WebSocket...');
    this.notificationService.disconnectSocket();
    
    // Cleanup subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ===== INITIALIZATION ===== ✅

  private initializeComponent(): void {
    this.loadUserData();
    this.loadLanguagePreference();
    this.loadTokenInfo();
    
    console.log('📋 Header initialized with:', {
      hasUser: !!this.currentUser,
      language: this.currentLanguage,
      permissionCount: this.userPermissions.length,
      roleCount: this.userRoles.length,
      primaryRole: this.getPrimaryRole()
    });
  }

  private setupSubscriptions(): void {
    // ✅ Subscribe to user changes
    const userSub = this.authService.currentUser$.subscribe(user => {
      console.log('👤 User data updated in header:', user?.username);
      this.updateUserData();
    });

    // ✅ Subscribe to auth state changes
    const authSub = this.authService.authState$.subscribe(state => {
      console.log('🔐 Auth state updated in header:', {
        isAuthenticated: state.isAuthenticated,
        hasUser: !!state.user,
        roleCount: state.roles.length,
        permissionCount: state.permissions.length
      });
      
      this.authState = state;
      this.userPermissions = state.permissions || [];
      this.userRoles = state.roles || [];

      // ✅ จัดการการเชื่อมต่อ WebSocket ตามสถานะการ login
      if (state.isAuthenticated) {
        // User logged in - connect socket ถ้ายังไม่ได้เชื่อมต่อ
        if (!this.notificationService.isConnected()) {
          console.log('🔌 User logged in, connecting WebSocket...');
          this.notificationService.connectSocket();
        }
      } else {
        // User logged out - disconnect socket
        if (this.notificationService.isConnected()) {
          console.log('🔌 User logged out, disconnecting WebSocket...');
          this.notificationService.disconnectSocket();
        }
      }
    });

    // ✅ Subscribe to token warning
    const warningSub = this.authService.getWarningStatus().subscribe(warning => {
      console.log('⚠️ Token warning status:', warning);
      this.showTokenWarning = warning;
      if (warning) {
        this.updateTokenInfo();
      }
    });

    // ✅ Subscribe to WebSocket connection state
    const socketStateSub = this.notificationService.connectionState$.subscribe(state => {
      console.log('🔌 Socket connection state changed:', state);
      this.socketConnectionState = state;
    });

    // ✅ Subscribe to language changes
    const langSub = this.languageService.currentLanguage$.subscribe(lang => {
      this.currentLanguage = lang;
      console.log('🌐 Language changed in header:', lang);
    });

    this.subscriptions.push(userSub, authSub, warningSub, socketStateSub, langSub);
  }

  // ===== DATA LOADING ===== ✅

  private loadUserData(): void {
    this.updateUserData();
    
    if (this.currentUser) {
      console.log('✅ User data loaded:', {
        id: this.currentUser.id,
        username: this.currentUser.username,
        fullName: this.getUserFullName(),
        primaryRole: this.getPrimaryRole()
      });
    }
  }

  private updateUserData(): void {
    this.currentUser = this.authService.getCurrentUserWithPermissions();
    this.userPermissions = this.authService.getUserPermissions();
    this.userRoles = this.authService.getUserRoles();
    
    if (this.currentUser) {
      this.updateTokenInfo();
    }
  }

  private loadLanguagePreference(): void {
    // Language Service จะจัดการการโหลดภาษาจาก localStorage อัตโนมัติ
    this.currentLanguage = this.languageService.getCurrentLanguage();
    console.log('🌐 Language preference loaded:', this.currentLanguage);
  }

  private loadTokenInfo(): void {
    this.tokenInfo = this.authService.getTokenInfo();
    if (this.tokenInfo) {
      console.log('🔑 Token info loaded:', {
        username: this.tokenInfo.username,
        expiresAt: this.tokenInfo.expires_at,
        timeLeftMinutes: this.tokenInfo.time_left_minutes
      });
    }
  }

  private updateTokenInfo(): void {
    this.tokenInfo = this.authService.getTokenInfo();
  }

  // ===== USER INFO METHODS ===== ✅

  getUserFullName(): string {
    if (!this.currentUser) return '';
    
    const firstName = this.currentUser.firstname || '';
    const lastName = this.currentUser.lastname || '';
    
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    
    return this.currentUser.username || 'User';
  }

  getUserInitials(): string {
    if (!this.currentUser) return 'U';
    
    const firstName = this.currentUser.firstname || '';
    const lastName = this.currentUser.lastname || '';
    
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    
    const username = this.currentUser.username || 'User';
    return username.charAt(0).toUpperCase();
  }

  getUserContact(): string {
    if (!this.currentUser) return '';
    return this.currentUser.email || this.currentUser.phone || '';
  }

  // ===== PERMISSION & ROLE METHODS ===== ✅

  hasPermission(permission: number): boolean {
    return this.authService.hasPermission(permission);
  }

  hasRole(role: UserRole): boolean {
    return this.authService.hasRole(role);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return this.authService.hasAnyRole(roles);
  }

  getPrimaryRole(): UserRole | null {
    return this.authService.getPrimaryRole();
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  isSupporter(): boolean {
    return this.authService.isSupporter();
  }

  isUser(): boolean {
    return this.authService.isUser();
  }

  getPermissionCount(): number {
    return this.userPermissions.length;
  }

  getRoleDisplay(): string {
    const primaryRole = this.getPrimaryRole();
    if (!primaryRole) return 'User';
    
    switch (primaryRole) {
      case ROLES.ADMIN: return this.translate('roles.admin');
      case ROLES.SUPPORTER: return this.translate('roles.supporter');
      case ROLES.USER: return this.translate('roles.user');
      default: return primaryRole;
    }
  }

  // ===== WEBSOCKET STATUS METHODS ===== ✅

  /**
   * ตรวจสอบสถานะการเชื่อมต่อ WebSocket
   */
  isSocketConnected(): boolean {
    return this.socketConnectionState === 'connected';
  }

  /**
   * ตรวจสอบว่ากำลังเชื่อมต่อหรือไม่
   */
  isSocketConnecting(): boolean {
    return this.socketConnectionState === 'connecting';
  }

  /**
   * รับข้อความแสดงสถานะ WebSocket
   */
  getSocketStatusText(): string {
    switch (this.socketConnectionState) {
      case 'connected':
        return this.translate('common.connected');
      case 'connecting':
        return this.translate('common.connecting');
      case 'disconnected':
        return this.translate('common.disconnected');
      default:
        return '';
    }
  }

  /**
   * ลองเชื่อมต่อ WebSocket ใหม่ (Manual reconnect)
   */
  reconnectSocket(): void {
    console.log('🔄 Manual socket reconnection requested');
    this.notificationService.disconnectSocket();
    setTimeout(() => {
      this.notificationService.connectSocket();
    }, 1000);
  }

  // ===== GREETING METHODS ===== ✅

  getGreeting(): string {
    const hour = new Date().getHours();
    
    if (this.currentLanguage === 'th') {
      if (hour < 6) return 'ราตรีสวัสดิ์';
      if (hour < 12) return 'สวัสดีตอนเช้า';
      if (hour < 17) return 'สวัสดีตอนบ่าย';
      if (hour < 20) return 'สวัสดีตอนเย็น';
      return 'สวัสดีตอนค่ำ';
    } else {
      if (hour < 6) return 'Good night';
      if (hour < 12) return 'Good morning';
      if (hour < 17) return 'Good afternoon';
      if (hour < 20) return 'Good evening';
      return 'Good night';
    }
  }

  // ===== LANGUAGE METHODS ===== ✅

  /**
   * ✅ แปลภาษาจาก translation key
   */
  translate(key: string, params?: { [key: string]: any }): string {
    return this.languageService.translate(key, params);
  }

  /**
   * ✅ ดึงข้อความตามภาษาปัจจุบัน (สำหรับ backward compatibility)
   */
  getText(en: string, th: string): string {
    return this.languageService.getText(th, en);
  }

  /**
   * ✅ Handle language change event from selector
   */
  onLanguageChanged(language: string): void {
    console.log('🌐 Language changed via selector in header:', language);
    // Language service จะจัดการเอง
  }

  // ===== NAVIGATION METHODS ===== ✅

  /**
   * Navigate to My Profile page
   */
  goToProfile(event: Event): void {
    event.preventDefault();
    console.log('👤 Navigating to My Profile page');
    
    // Close dropdown (Bootstrap)
    const dropdown = event.target as HTMLElement;
    const dropdownMenu = dropdown.closest('.dropdown');
    if (dropdownMenu) {
      const bsDropdown = (window as any).bootstrap?.Dropdown?.getInstance(dropdownMenu);
      if (bsDropdown) {
        bsDropdown.hide();
      }
    }
    
    // Navigate to profile
    this.router.navigate(['/profile']).then(success => {
      if (success) {
        console.log('✅ Successfully navigated to profile');
      } else {
        console.error('❌ Failed to navigate to profile');
      }
    }).catch(error => {
      console.error('❌ Navigation error:', error);
    });
  }

  /**
   * Navigate to Settings page
   */
  goToSettings(event: Event): void {
    event.preventDefault();
    console.log('⚙️ Navigating to settings');
    
    // Close dropdown
    const dropdown = event.target as HTMLElement;
    const dropdownMenu = dropdown.closest('.dropdown');
    if (dropdownMenu) {
      const bsDropdown = (window as any).bootstrap?.Dropdown?.getInstance(dropdownMenu);
      if (bsDropdown) {
        bsDropdown.hide();
      }
    }
    
    this.router.navigate(['/settings/general']).then(success => {
      if (success) {
        console.log('✅ Successfully navigated to settings');
      } else {
        console.error('❌ Failed to navigate to settings');
      }
    });
  }

  /**
   * Navigate to Dashboard
   */
  goToDashboard(): void {
    console.log('🏠 Navigating to dashboard');
    this.router.navigate(['/dashboard']).then(success => {
      if (success) {
        console.log('✅ Successfully navigated to dashboard');
      } else {
        console.error('❌ Failed to navigate to dashboard');
      }
    });
  }

  // ===== LOGOUT FUNCTIONALITY ===== ✅

  logout(event: Event): void {
    event.preventDefault();
    
    console.log('🚪 Logout requested');
    
    const confirmLogout = confirm(
      this.translate('common.logoutConfirm')
    );
    
    if (confirmLogout) {
      console.log('✅ Logout confirmed, proceeding...');
      this.performLogout();
    } else {
      console.log('❌ Logout cancelled by user');
    }
  }

  private performLogout(): void {
    this.isLoading = true;
    
    try {
      // ✅ CRITICAL: ตัดการเชื่อมต่อ WebSocket ก่อน logout
      console.log('🔌 Disconnecting WebSocket before logout...');
      this.notificationService.disconnectSocket();
      
      // เพิ่ม delay เล็กน้อยเพื่อให้ socket disconnect เสร็จก่อน
      setTimeout(() => {
        // ทำการ logout
        this.authService.logout();
        console.log('✅ Logout completed');
      }, 100);
      
    } catch (error) {
      console.error('❌ Logout error:', error);
      
      // ถ้าเกิด error ก็ force disconnect และ clear auth data
      this.notificationService.disconnectSocket();
      this.authService.clearAuthData();
      
    } finally {
      this.isLoading = false;
    }
  }

  // ===== TOKEN WARNING METHODS ===== ✅

  refreshSession(): void {
    console.log('🔄 Manual session refresh requested');
    
    this.isRefreshing = true;
    
    this.authService.manualRefresh().subscribe({
      next: (tokenData) => {
        console.log('✅ Manual token refresh successful:', tokenData);
        this.showTokenWarning = false;
        this.isRefreshing = false;
        this.updateTokenInfo();
        
        // ✅ Reconnect socket ด้วย token ใหม่
        console.log('🔄 Reconnecting socket with new token...');
        this.notificationService.disconnectSocket();
        setTimeout(() => {
          this.notificationService.connectSocket();
        }, 500);
      },
      error: (error) => {
        console.error('❌ Manual token refresh failed:', error);
        this.isRefreshing = false;
      }
    });
  }

  dismissWarning(): void {
    console.log('❌ Token warning dismissed');
    this.showTokenWarning = false;
  }

  getTimeLeftText(): string {
    if (!this.tokenInfo) return '';
    
    const minutes = this.tokenInfo.time_left_minutes;
    if (minutes <= 0) {
      return this.translate('common.sessionExpired');
    }
    
    return this.translate('common.sessionExpiresIn', { minutes });
  }

  // ===== MOBILE MENU ===== ✅

  toggleMobileMenu(): void {
    console.log('📱 Mobile menu toggled');
    
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const body = document.body;
    
    if (sidebar && overlay) {
      const isOpen = sidebar.classList.contains('show');
      
      if (isOpen) {
        sidebar.classList.remove('show');
        overlay.classList.remove('show');
        body.classList.remove('mobile-menu-open');
      } else {
        sidebar.classList.add('show');
        overlay.classList.add('show');
        body.classList.add('mobile-menu-open');
      }
    }
  }

  // ===== UTILITY METHODS ===== ✅

  isOnline(): boolean {
    return navigator.onLine;
  }

  getBrowserInfo(): string {
    return navigator.userAgent;
  }

  // ===== PERMISSION HELPERS FOR TEMPLATE ===== ✅

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  canCreateTickets(): boolean {
    return this.hasPermission(1); // CREATE_TICKET
  }

  canViewAllTickets(): boolean {
    return this.hasPermission(13); // VIEW_ALL_TICKETS
  }

  canManageUsers(): boolean {
    return this.authService.canManageUsers();
  }

  canManageTickets(): boolean {
    return this.authService.canManageTickets();
  }

  canAccessReports(): boolean {
    return this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }

  canAccessSettings(): boolean {
    return true; // All authenticated users can access general settings
  }

  canAccessAdminPanel(): boolean {
    return this.isAdmin();
  }

  canAccessSupportPanel(): boolean {
    return this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }
}