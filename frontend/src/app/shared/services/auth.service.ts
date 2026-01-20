import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, firstValueFrom } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

// Import interfaces จาก user.model.ts ที่อัปเดตแล้ว
import {
  LoginRequest,
  LoginResponse,
  TokenData,
  User,
  AuthState,
  UserWithPermissions,
  createEmptyAuthState,
  isLoginSuccessResponse,
  extractTokenData,
  extractUserData,
  createAuthStateFromLoginResponse
} from '../models/user.model';

// Import permission-related types with Role ID support
import {
  permissionEnum,
  UserRole,
  RoleId,
  ROLES,
  ROLE_IDS,
  ROLE_PERMISSIONS,
  ROLE_ID_PERMISSIONS,
  ROLE_ID_TO_NAME,
  ROLE_NAME_TO_ID,
  getRolePermissions,
  getRoleIdPermissions,
  getPermissionsFromRoles,
  getPermissionsFromRoleIds,
  validateAndNormalizePermissions,
  validateAndNormalizeRoles,
  convertRoleIdsToNames,
  convertRoleNamesToIds,
  getSafeFallbackPermissions,
  getSafeFallbackRoles,
  isAdminByRoleId,
  isSupporterByRoleId,
  isUserByRoleId,
  checkAccess as checkAccessPermission
} from '../models/permission.model';

// Re-export TokenData สำหรับ api.service.ts
export type { TokenData } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  // State Management with proper types
  private authStateSubject = new BehaviorSubject<AuthState>(createEmptyAuthState());
  public authState$ = this.authStateSubject.asObservable();

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  // Token management
  private tokenSubject = new BehaviorSubject<string | null>(null);
  private warningSubject = new BehaviorSubject<boolean>(false);
  private refreshInProgress = false;

  // Role ID storage for backend compatibility
  private userRoleIds: RoleId[] = [];

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    console.log('🔧 AuthService initialized with Role ID support');
    this.loadUserFromStorage();
    this.initTokenCheck();
    
    // ✅ เพิ่มตรงนี้: เช็คสถานะ 1 ครั้งถ้วน ตอนเริ่มทำงาน (จะไม่ Loop)
    this.debugAuthStatus(); 
  }

  // ===== CORE LOGIN METHOD ===== 

  /**
   * เข้าสู่ระบบผ่าน Backend API with Role ID support
   */
  async login(username: string, password: string, language: string = 'th'): Promise<LoginResponse> {
    console.log('🔄 Starting login process for:', username);

    try {
      // Set loading state
      this.updateAuthState({ isLoading: true });

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'language': language
      });

      const body: LoginRequest = {
        username: username.trim(),
        password: password
      };

      console.log('📤 Sending login request to:', `${this.apiUrl}/auth/login`);

      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, body, { headers })
          .pipe(
            tap(res => {
              console.log('📥 Raw backend response:', res);
            }),
            catchError((error: HttpErrorResponse) => this.handleLoginError(error))
          )
      );

      console.log('📋 Processing login response...');

      // Debug login response
      this.debugLoginResponse(response);

      // ตรวจสอบความสำเร็จของ response
      if (isLoginSuccessResponse(response)) {
        console.log('✅ Login successful, processing tokens and user data');

        const tokenData = extractTokenData(response);
        const userData = extractUserData(response);

        if (!tokenData) {
          throw new Error('Invalid token data in response');
        }

        if (!userData) {
          throw new Error('Invalid user data in response');
        }

        // บันทึก tokens
        this.setTokens(tokenData);

        // บันทึก user data
        this.setCurrentUser(userData);

        // จัดการ permissions และ roles
        let userPermissions: number[] = [];
        let userRoles: UserRole[] = [];
        let userRoleIds: RoleId[] = [];

        try {
          if (response.permission) {
            userPermissions = validateAndNormalizePermissions(response.permission);
          }

          if (response.roles) {
            if (Array.isArray(response.roles)) {
              const firstRole = response.roles[0];

              if (typeof firstRole === 'number') {
                const validRoleIds: RoleId[] = [];
                for (const roleId of response.roles) {
                  if (typeof roleId === 'number' && Object.values(ROLE_IDS).includes(roleId as RoleId)) {
                    validRoleIds.push(roleId as RoleId);
                  }
                }
                userRoleIds = validRoleIds;
                userRoles = convertRoleIdsToNames(userRoleIds);
              } else if (typeof firstRole === 'string') {
                userRoles = validateAndNormalizeRoles(response.roles as UserRole[]);
                userRoleIds = convertRoleNamesToIds(userRoles);
              } else {
                userRoles = getSafeFallbackRoles();
                userRoleIds = convertRoleNamesToIds(userRoles);
              }
            }
          } else if (userData.roles) {
            userRoles = validateAndNormalizeRoles(userData.roles);
            userRoleIds = convertRoleNamesToIds(userRoles);
          }

          // ใช้ fallback ถ้าไม่มีข้อมูล
          if (userPermissions.length === 0) {
            if (userRoleIds.length > 0) {
              userPermissions = getPermissionsFromRoleIds(userRoleIds);
            } else if (userRoles.length > 0) {
              userPermissions = getPermissionsFromRoles(userRoles);
            }

            if (userPermissions.length === 0) {
              userPermissions = getSafeFallbackPermissions();
            }
          }

          if (userRoles.length === 0) {
            const hasAdminPermissions = userPermissions.includes(15) && userPermissions.includes(16) && userPermissions.includes(17);
            const hasSupporterPermissions = userPermissions.includes(13) && userPermissions.includes(5) && !hasAdminPermissions;

            if (hasAdminPermissions) {
              userRoles = [ROLES.ADMIN];
              userRoleIds = [ROLE_IDS.ADMIN];
            } else if (hasSupporterPermissions) {
              userRoles = [ROLES.SUPPORTER];
              userRoleIds = [ROLE_IDS.SUPPORTER];
            } else {
              userRoles = getSafeFallbackRoles();
              userRoleIds = convertRoleNamesToIds(userRoles);
            }
          }

          // บันทึกข้อมูล
          this.setUserPermissions(userPermissions);
          this.setUserRoles(userRoles);
          this.setUserRoleIds(userRoleIds);

          // สร้าง auth state
          const newAuthState = createAuthStateFromLoginResponse(response, userData, tokenData.access_token);
          this.authStateSubject.next(newAuthState);

          console.log('🎉 Login process completed successfully');

          setTimeout(() => {
            this.validateUserAccess();
          }, 100);

        } catch (validationError) {
          console.error('❌ Error during permission/role validation:', validationError);

          const fallbackPermissions = getSafeFallbackPermissions();
          const fallbackRoles = getSafeFallbackRoles();
          const fallbackRoleIds = convertRoleNamesToIds(fallbackRoles);

          this.setUserPermissions(fallbackPermissions);
          this.setUserRoles(fallbackRoles);
          this.setUserRoleIds(fallbackRoleIds);

          const newAuthState = createAuthStateFromLoginResponse(response, userData, tokenData.access_token);
          this.authStateSubject.next(newAuthState);
        }

      } else {
        console.log('❌ Login failed:', response.message);
        this.updateAuthState({ isLoading: false });
      }

      return response;

    } catch (error: any) {
      console.error('❌ Login error:', error);
      this.updateAuthState({ isLoading: false });
      throw error;
    }
  }

  // ===== ROLE ID MANAGEMENT =====

  setUserRoleIds(roleIds: RoleId[]): void {
    try {
      const validRoleIds = roleIds.filter(id => Object.values(ROLE_IDS).includes(id));
      this.userRoleIds = validRoleIds;
      localStorage.setItem('user_role_ids', JSON.stringify(validRoleIds));
    } catch (error) {
      console.error('❌ Error saving role IDs:', error);
      this.userRoleIds = [ROLE_IDS.USER];
      localStorage.setItem('user_role_ids', JSON.stringify([ROLE_IDS.USER]));
    }
  }

  getUserRoleIds(): RoleId[] {
    try {
      const roleIdsStr = localStorage.getItem('user_role_ids');
      return roleIdsStr ? JSON.parse(roleIdsStr) : this.userRoleIds;
    } catch (error) {
      return [ROLE_IDS.USER];
    }
  }

  hasRoleId(roleId: RoleId): boolean {
    const userRoleIds = this.getUserRoleIds();
    return userRoleIds.includes(roleId);
  }

  // ===== ROLE MANAGEMENT WITH ID SUPPORT =====

  setUserRoles(roles: UserRole[]): void {
    try {
      const validRoles = roles.filter(role => typeof role === 'string' && Object.values(ROLES).includes(role));
      localStorage.setItem('user_roles', JSON.stringify(validRoles));
      
      const roleIds = convertRoleNamesToIds(validRoles);
      this.setUserRoleIds(roleIds);

    } catch (error) {
      console.error('❌ Error saving roles:', error);
      localStorage.setItem('user_roles', JSON.stringify([ROLES.USER]));
    }
  }

  getUserRoles(): UserRole[] {
    try {
      const rolesStr = localStorage.getItem('user_roles');
      return rolesStr ? JSON.parse(rolesStr) : [];
    } catch (error) {
      return [];
    }
  }

  isAdmin(): boolean {
    return this.hasRoleId(ROLE_IDS.ADMIN) || this.hasRole(ROLES.ADMIN);
  }

  isSupporter(): boolean {
    return this.hasRoleId(ROLE_IDS.SUPPORTER) || this.hasRole(ROLES.SUPPORTER);
  }

  isUser(): boolean {
    return this.hasRoleId(ROLE_IDS.USER) || this.hasRole(ROLES.USER);
  }

  getPrimaryRole(): UserRole | null {
    if (this.hasRoleId(ROLE_IDS.ADMIN)) return ROLES.ADMIN;
    if (this.hasRoleId(ROLE_IDS.SUPPORTER)) return ROLES.SUPPORTER;
    if (this.hasRoleId(ROLE_IDS.USER)) return ROLES.USER;

    if (this.hasRole(ROLES.ADMIN)) return ROLES.ADMIN;
    if (this.hasRole(ROLES.SUPPORTER)) return ROLES.SUPPORTER;
    if (this.hasRole(ROLES.USER)) return ROLES.USER;

    return null;
  }

  getEffectivePermissions(): number[] {
    const userRoles = this.getUserRoles();
    const userRoleIds = this.getUserRoleIds();
    const directPermissions = this.getUserPermissions();

    const rolePermissions = getPermissionsFromRoles(userRoles);
    const roleIdPermissions = getPermissionsFromRoleIds(userRoleIds);

    const allPermissions = [...new Set([
      ...directPermissions,
      ...rolePermissions,
      ...roleIdPermissions
    ])];

    return allPermissions;
  }

  // ===== TOKEN MANAGEMENT =====

  setTokens(tokenData: TokenData): void {
    try {
      localStorage.setItem('access_token', tokenData.access_token);
      if (tokenData.refresh_token) localStorage.setItem('refresh_token', tokenData.refresh_token);
      if (tokenData.expires_at) localStorage.setItem('token_expires_at', tokenData.expires_at);
      if (tokenData.token_expires_timestamp) localStorage.setItem('token_expires_timestamp', tokenData.token_expires_timestamp.toString());
      
      this.tokenSubject.next(tokenData.access_token);
    } catch (error) {
      console.error('❌ Error saving tokens:', error);
    }
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  isTokenExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp < currentTime;

      if (isExpired) {
        console.log('⏰ Token is expired');
      }
      return isExpired;
    } catch (error) {
      return true;
    }
  }

  isTokenExpiring(): boolean {
    const token = this.getToken();
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      const timeLeft = payload.exp - currentTime;
      return timeLeft <= 300; 
    } catch (error) {
      return false;
    }
  }

  hasValidToken(): boolean {
    const token = this.getToken();
    if (!token) return false;
    return !this.isTokenExpired();
  }

  // ===== USER MANAGEMENT =====

  setCurrentUser(user: User | UserWithPermissions): void {
    try {
      const userRoles = this.getUserRoles();
      const userRoleIds = this.getUserRoleIds();
      const userPermissions = this.getUserPermissions();

      const userWithRoles = {
        ...user,
        roles: userRoles,
        role_ids: userRoleIds,
        permissions: userPermissions
      };

      localStorage.setItem('user_data', JSON.stringify(userWithRoles));
      this.currentUserSubject.next(userWithRoles);
    } catch (error) {
      console.error('❌ Error saving user data:', error);
    }
  }

  getCurrentUser(): any {
    const userStr = localStorage.getItem('user_data');
    if (!userStr) {
      return null;
    }
    try {
      return JSON.parse(userStr);
    } catch (error) {
      return null;
    }
  }

  getCurrentUserWithPermissions(): UserWithPermissions | null {
    const user = this.getCurrentUser();
    if (!user) return null;

    const permissions = this.getUserPermissions();
    const roles = this.getUserRoles();

    return {
      ...user,
      permissions,
      roles,
      effective_permissions: permissions
    };
  }

  // ===== PERMISSION MANAGEMENT =====

  setUserPermissions(permissions: number[]): void {
    try {
      const validPermissions = permissions.filter(p => typeof p === 'number' && !isNaN(p));
      localStorage.setItem('user_permissions', JSON.stringify(validPermissions));
    } catch (error) {
      localStorage.setItem('user_permissions', JSON.stringify([1, 12, 14]));
    }
  }

  getUserPermissions(): number[] {
    try {
      const permStr = localStorage.getItem('user_permissions');
      return permStr ? JSON.parse(permStr) : [];
    } catch (error) {
      return [];
    }
  }

  hasPermission(permission: number): boolean {
    const permissions = this.getEffectivePermissions();
    return permissions.includes(permission);
  }

  hasAllPermissions(permissions: number[]): boolean {
    const userPermissions = this.getEffectivePermissions();
    return permissions.every(permission => userPermissions.includes(permission));
  }

  hasAnyPermission(permissions: number[]): boolean {
    const userPermissions = this.getEffectivePermissions();
    return permissions.some(permission => userPermissions.includes(permission));
  }

  // ===== ROLE MANAGEMENT =====

  hasRole(role: UserRole): boolean {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return false;

    const roles = currentUser.roles || currentUser.role || currentUser.userRoles || currentUser.user_roles || [];
    return validateAndNormalizeRoles(roles).includes(role);
  }

  hasAllRoles(roles: UserRole[]): boolean {
    const userRoles = this.getUserRoles();
    return roles.every(role => userRoles.includes(role));
  }

  hasAnyRole(roles: UserRole[]): boolean {
    const userRoles = this.getUserRoles();
    return roles.some(role => userRoles.includes(role));
  }

  // ===== ACCESS CONTROL =====

  checkAccess(requiredPermissions?: number[], requiredRoles?: UserRole[]): any {
    const userPermissions = this.getEffectivePermissions();
    const userRoles = this.getUserRoles();
    return checkAccessPermission(userPermissions, userRoles, requiredPermissions, requiredRoles);
  }

  canManageTickets(): boolean {
    return this.hasAnyPermission([13, 5, 9]);
  }

  canManageUsers(): boolean {
    return this.hasAnyPermission([15, 16]);
  }

  canCreateTickets(): boolean {
    return this.hasPermission(1);
  }

  canViewAllTickets(): boolean {
    return this.hasPermission(13);
  }

  canViewOwnTicketsOnly(): boolean {
    return this.hasPermission(12) && !this.hasPermission(13);
  }

  // ===== AUTHENTICATION STATUS =====

  /**
   * ตรวจสอบการ authentication
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();

    // ✅ แก้ไข: ลบ console.log ออก เพื่อป้องกัน Log เต็ม Console
    return !!(token && user && !this.isTokenExpired());
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  // ===== LOGOUT =====

  logout(): void {
    console.log('🚪 Starting logout process');
    const refreshToken = this.getRefreshToken();

    if (refreshToken) {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      });

      this.http.post(`${this.apiUrl}/logout`, { refresh_token: refreshToken }, { headers })
        .subscribe({
          next: () => console.log('✅ Logout API successful'),
          error: (error) => console.error('❌ Logout API failed:', error),
          complete: () => this.clearAuthData()
        });
    } else {
      this.clearAuthData();
    }
  }

  clearAuthData(): void {
    console.log('🧹 Clearing authentication data');
    const keysToRemove = [
      'access_token', 'refresh_token', 'token_expires_at', 'token_expires_timestamp',
      'user_data', 'user_permissions', 'user_roles', 'user_role_ids', 'remember_me'
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));

    this.currentUserSubject.next(null);
    this.tokenSubject.next(null);
    this.warningSubject.next(false);
    this.authStateSubject.next(createEmptyAuthState());
    this.refreshInProgress = false;
    this.userRoleIds = [];

    console.log('🏠 Redirecting to login page');
    this.router.navigate(['/login']);
  }

  clearTokensAndRedirect(): void {
    this.clearAuthData();
  }

  // ===== USER ACCESS VALIDATION =====

  private validateUserAccess(): void {
    console.group('🔍 Validating User Access (with Role IDs)');

    const user = this.getCurrentUser();
    const roles = this.getUserRoles();
    const roleIds = this.getUserRoleIds();
    const permissions = this.getEffectivePermissions();

    const hasBasicAccess = (roles.length > 0 || roleIds.length > 0) && (
      this.hasPermission(1) ||
      this.hasPermission(12) ||
      this.hasPermission(13) ||
      this.isAdmin() ||
      this.isSupporter()
    );

    if (!hasBasicAccess) {
      console.warn('⚠️ User has no basic access permissions!');
    }

    console.groupEnd();
  }

  // ===== DEBUG METHODS =====

  debugAuthStatus(): void {
    console.group('🔍 Authentication Debug Info (with Role IDs)');

    const token = this.getToken();
    const user = this.getCurrentUser();
    const permissions = this.getUserPermissions();
    const roles = this.getUserRoles();
    const roleIds = this.getUserRoleIds();
    const effectivePermissions = this.getEffectivePermissions();

    console.log('📋 Basic Info:', {
      hasToken: !!token,
      hasUser: !!user,
      permissionCount: permissions.length,
      roleCount: roles.length,
      roleIdCount: roleIds.length,
      effectivePermissionCount: effectivePermissions.length
    });

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('🔑 Token Info:', {
          userId: payload.sub || payload.user_id,
          username: payload.username,
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          isExpired: this.isTokenExpired(),
          isExpiring: this.isTokenExpiring()
        });
      } catch (error) {
        console.error('❌ Cannot decode token:', error);
      }
    }

    if (user) {
      console.log('👤 User Info:', {
        id: user.id,
        username: user.username,
        fullName: `${user.firstname} ${user.lastname}`
      });
    }

    console.log('🔍 Auth Methods:', {
      isAuthenticated: this.isAuthenticated(),
      isAdmin: this.isAdmin(),
      isSupporter: this.isSupporter(),
      isUser: this.isUser()
    });

    console.log('🎯 Access Control:', {
      canManageTickets: this.canManageTickets(),
      canManageUsers: this.canManageUsers(),
      canCreateTickets: this.canCreateTickets(),
      canViewAllTickets: this.canViewAllTickets(),
      canViewOwnTicketsOnly: this.canViewOwnTicketsOnly()
    });

    console.groupEnd();
  }

  debugRoleIdSystem(): void {
    console.group('🔢 Role ID System Debug');
    const roles = this.getUserRoles();
    const roleIds = this.getUserRoleIds();
    console.log('Current Role Data:', { roleNames: roles, roleIds: roleIds });
    console.groupEnd();
  }

  // ===== TOKEN REFRESH =====

  refreshAccessToken(): Observable<TokenData> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => 'No refresh token available');
    }

    if (this.refreshInProgress) {
      return new Observable(observer => {
        const checkInterval = setInterval(() => {
          if (!this.refreshInProgress) {
            clearInterval(checkInterval);
            const newToken = this.getToken();
            if (newToken) {
              observer.next({
                access_token: newToken,
                refresh_token: this.getRefreshToken()!
              });
              observer.complete();
            } else {
              observer.error('Token refresh failed');
            }
          }
        }, 100);
      });
    }

    this.refreshInProgress = true;
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const body = { refresh_token: refreshToken };

    return this.http.post<any>(`${this.apiUrl}/refresh`, body, { headers })
      .pipe(
        tap((response: any) => {
          if (response.access_token) {
            const tokenData: TokenData = {
              access_token: response.access_token,
              refresh_token: response.refresh_token || refreshToken,
              expires_at: response.expires_at
            };
            this.setTokens(tokenData);
            this.warningSubject.next(false);
          }
          this.refreshInProgress = false;
        }),
        catchError((error) => {
          this.refreshInProgress = false;
          this.clearAuthData();
          return throwError(() => 'Token refresh failed');
        })
      );
  }

  // ===== PRIVATE HELPER METHODS =====

  private loadUserFromStorage(): void {
    console.log('📂 Loading user data from storage');

    const token = this.getToken();
    const user = this.getCurrentUser();
    const permissions = this.getUserPermissions();
    const roles = this.getUserRoles();
    const roleIds = this.getUserRoleIds();

    if (token && user && !this.isTokenExpired()) {
      console.log('✅ Valid session found, restoring auth state');

      this.tokenSubject.next(token);
      this.currentUserSubject.next(user);
      this.userRoleIds = roleIds;

      this.updateAuthState({
        isAuthenticated: true,
        isLoading: false,
        user: user,
        token: token,
        permissions: permissions,
        roles: roles,
        last_activity: new Date(),
        effective_permissions: this.getEffectivePermissions()
      });

    } else {
      console.log('❌ No valid session found');
      this.clearAuthData();
    }
  }

  private updateAuthState(updates: Partial<AuthState>): void {
    const currentState = this.authStateSubject.value;
    const newState = { ...currentState, ...updates };
    this.authStateSubject.next(newState);
  }

  private handleLoginError(error: HttpErrorResponse): Observable<never> {
    console.error('❌ Login API error:', error);
    let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
    if (error.error?.message) errorMessage = error.error.message;
    return throwError(() => new Error(errorMessage));
  }

  debugLoginResponse(response: LoginResponse): void {
    console.group('🔍 Login Response Debug');
    console.log('Response structure:', {
      code: response.code,
      status: response.status,
      message: response.message
    });
    console.groupEnd();
  }

  private initTokenCheck(): void {
    setInterval(() => {
      const token = this.getToken();
      if (!token) return;

      if (this.isTokenExpired()) {
        this.refreshAccessToken().subscribe({
          next: () => console.log('✅ Auto refresh successful'),
          error: (error) => console.error('❌ Auto refresh failed')
        });
      } else if (this.isTokenExpiring() && !this.warningSubject.value) {
        this.warningSubject.next(true);
        this.refreshAccessToken().subscribe({
          next: () => console.log('✅ Proactive refresh successful'),
          error: (error) => console.error('❌ Proactive refresh failed')
        });
      }
    }, 30000);
  }

  // ===== OBSERVABLE GETTERS =====

  getWarningStatus(): Observable<boolean> {
    return this.warningSubject.asObservable();
  }

  getTokenChanges(): Observable<string | null> {
    return this.tokenSubject.asObservable();
  }

  manualRefresh(): Observable<TokenData> {
    return this.refreshAccessToken();
  }

  // ===== ADVANCED PERMISSION METHODS =====

  hasPermissionWithFallback(permission: permissionEnum, fallbackRoles?: UserRole[]): boolean {
    if (this.hasPermission(permission)) return true;
    if (fallbackRoles && this.hasAnyRole(fallbackRoles)) return true;
    const userRoles = this.getUserRoles();
    return userRoles.some(role => getRolePermissions(role).includes(permission));
  }

  getMissingPermissions(requiredPermissions: number[]): number[] {
    const userPermissions = this.getEffectivePermissions();
    return requiredPermissions.filter(permission => !userPermissions.includes(permission));
  }

  getMissingRoles(requiredRoles: UserRole[]): UserRole[] {
    const userRoles = this.getUserRoles();
    return requiredRoles.filter(role => !userRoles.includes(role));
  }

  getMissingRoleIds(requiredRoleIds: RoleId[]): RoleId[] {
    const userRoleIds = this.getUserRoleIds();
    return requiredRoleIds.filter(roleId => !userRoleIds.includes(roleId));
  }

  hasPermissionWithRoleIdFallback(permission: permissionEnum, fallbackRoleIds?: RoleId[]): boolean {
    if (this.hasPermission(permission)) return true;
    if (fallbackRoleIds && fallbackRoleIds.some(roleId => this.hasRoleId(roleId))) return true;
    const userRoleIds = this.getUserRoleIds();
    return userRoleIds.some(roleId => getRoleIdPermissions(roleId).includes(permission));
  }

  // ===== DEBUG AND UTILITY METHODS =====

  checkCurrentPermissionStatus(): void {
    console.group('🔍 Current Permission Status');
    console.log('Current Status:', {
      isAuthenticated: this.isAuthenticated(),
      roles: this.getUserRoles(),
      permissions: this.getEffectivePermissions()
    });
    console.groupEnd();
  }

  debugPermissionsInStorage(): void {
    console.group('🔍 Permissions Storage Debug');
    console.log('Raw localStorage:', localStorage.getItem('user_permissions'));
    console.groupEnd();
  }

  getAuthState(): AuthState {
    return this.authStateSubject.value;
  }

  getUsageStats(): any {
    const authState = this.getAuthState();
    const loginTime = authState.last_activity;
    return {
      loginTime: loginTime,
      lastActivity: authState.last_activity
    };
  }

  getTokenInfo(): any {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return {
        user_id: payload.sub || payload.user_id,
        username: payload.username,
        expires_at: new Date(payload.exp * 1000).toISOString()
      };
    } catch (error) {
      return null;
    }
  }
}