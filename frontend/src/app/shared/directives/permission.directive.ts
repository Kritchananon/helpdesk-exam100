import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy, inject } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { 
  permissionEnum, 
  UserRole,
  RoleId,
  ROLES,
  ROLE_IDS,
  enumToNumber,
  isValidPermissionNumber,
  ROLE_ID_TO_NAME
} from '../models/permission.model';

/**
 * ✅ ENHANCED: Directive สำหรับตรวจสอب permissions และแสดง/ซ่อน elements
 * รองรับทั้ง number, permissionEnum และ Role ID system (20 permissions)
 * 
 * Usage:
 * <div *hasPermission="[1, 2]">Create Button</div>
 * <div *hasPermission="[permissionEnum.EDIT_TICKET, permissionEnum.DELETE_TICKET]" [requireAll]="true">Admin Actions</div>
 * <div *hasRole="['admin', 'supporter']">Support Menu</div>
 * <div *hasRoleId="[15, 8]">Admin or Support Menu</div> <!-- NEW: Role ID support -->
 * <div *hasRole="['admin']" *hasPermission="[15]">User Management</div>
 */

// ===== ✅ ENHANCED: Permission Directive =====
@Directive({
  selector: '[hasPermission]',
  standalone: true
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _permissions: number[] = [];
  private _requireAll = false;
  private _isVisible = false;

  /**
   * ✅ ENHANCED: รับทั้ง number[], permissionEnum[], หรือ mixed array
   * รองรับ requireAll mode ด้วย
   */
  @Input() set hasPermission(permissions: number | permissionEnum | (number | permissionEnum)[] | {
    permissions: (number | permissionEnum)[];
    requireAll?: boolean;
  }) {
    // ถ้าเป็น object ที่มี permissions และ requireAll
    if (typeof permissions === 'object' && !Array.isArray(permissions) && 'permissions' in permissions) {
      const config = permissions as { permissions: (number | permissionEnum)[]; requireAll?: boolean };
      this._requireAll = config.requireAll || false;
      
      this._permissions = config.permissions.map(p => {
        if (typeof p === 'number') {
          return p;
        } else {
          return enumToNumber(p as permissionEnum);
        }
      }).filter(p => isValidPermissionNumber(p));
    }
    // Handle single number
    else if (typeof permissions === 'number') {
      this._permissions = [permissions];
    } 
    // Handle array
    else if (Array.isArray(permissions)) {
      this._permissions = permissions.map(p => {
        if (typeof p === 'number') {
          return p;
        } else {
          return enumToNumber(p as permissionEnum);
        }
      }).filter(p => isValidPermissionNumber(p));
    } 
    // Handle single enum
    else {
      try {
        const permissionNumber = enumToNumber(permissions as permissionEnum);
        this._permissions = [permissionNumber];
      } catch (error) {
        console.warn('⚠️ Invalid permissions provided to hasPermission directive:', permissions);
        this._permissions = [];
      }
    }

    console.log('🔍 HasPermission directive updated:', {
      original: permissions,
      processed: this._permissions,
      requireAll: this._requireAll
    });

    this.updateVisibility();
  }

  @Input() set requireAll(value: boolean) {
    this._requireAll = value;
    this.updateVisibility();
  }

  ngOnInit(): void {
    console.log('🔧 HasPermission directive initialized');
    
    // ✅ Subscribe to auth state changes
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auth state changed, updating permission visibility');
        this.updateVisibility();
      });

    // ✅ Initial visibility check
    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const hasRequiredPermissions = this.checkPermissions();
    
    console.log('🔍 Permission check result:', {
      permissions: this._permissions,
      requireAll: this._requireAll,
      hasPermissions: hasRequiredPermissions,
      currentVisibility: this._isVisible
    });
    
    if (hasRequiredPermissions && !this._isVisible) {
      // แสดง element
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Element shown by permission directive');
    } else if (!hasRequiredPermissions && this._isVisible) {
      // ซ่อน element
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠️ Element hidden by permission directive');
    }
  }

  private checkPermissions(): boolean {
    if (!this._permissions.length) {
      console.log('📋 No permissions required, allowing access');
      return true; // ไม่มีเงื่อนไข = แสดง
    }

    if (!this.authService.isAuthenticated()) {
      console.log('🚫 User not authenticated, denying access');
      return false;
    }

    const userPermissions = this.authService.getEffectivePermissions();
    
    console.log('🔍 Checking permissions:', {
      required: this._permissions,
      user: userPermissions,
      requireAll: this._requireAll
    });
    
    if (this._requireAll) {
      // ต้องมีทุก permission
      const hasAll = this._permissions.every(permission => 
        userPermissions.includes(permission)
      );
      console.log('🎯 Require ALL permissions:', hasAll);
      return hasAll;
    } else {
      // มีอย่างน้อย 1 permission
      const hasAny = this._permissions.some(permission => 
        userPermissions.includes(permission)
      );
      console.log('🎯 Require ANY permission:', hasAny);
      return hasAny;
    }
  }
}

// ===== ✅ ENHANCED: Role Directive =====
@Directive({
  selector: '[hasRole]',
  standalone: true
})
export class HasRoleDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _roles: UserRole[] = [];
  private _requireAll = false;
  private _isVisible = false;

  /**
   * ✅ ENHANCED: รับ single role หรือ array of roles พร้อม validation
   */
  @Input() set hasRole(roles: UserRole | UserRole[]) {
    if (typeof roles === 'string') {
      // ตรวจสอบว่าเป็น valid role
      if (Object.values(ROLES).includes(roles as UserRole)) {
        this._roles = [roles as UserRole];
      } else {
        console.warn('⚠️ Invalid role provided to hasRole directive:', roles);
        this._roles = [];
      }
    } else if (Array.isArray(roles)) {
      // กรองเฉพาะ valid roles
      this._roles = roles.filter(role => Object.values(ROLES).includes(role));
      
      if (this._roles.length !== roles.length) {
        const invalidRoles = roles.filter(role => !Object.values(ROLES).includes(role));
        console.warn('⚠️ Some invalid roles filtered out:', invalidRoles);
      }
    } else {
      console.warn('⚠️ Invalid roles provided to hasRole directive:', roles);
      this._roles = [];
    }

    console.log('👥 HasRole directive updated:', {
      original: roles,
      processed: this._roles
    });

    this.updateVisibility();
  }

  @Input() set requireAll(value: boolean) {
    this._requireAll = value;
    this.updateVisibility();
  }

  ngOnInit(): void {
    console.log('🔧 HasRole directive initialized');
    
    // ✅ Subscribe to auth state changes
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auth state changed, updating role visibility');
        this.updateVisibility();
      });

    // ✅ Initial visibility check
    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const hasRequiredRoles = this.checkRoles();
    
    console.log('🔍 Role check result:', {
      roles: this._roles,
      requireAll: this._requireAll,
      hasRoles: hasRequiredRoles,
      currentVisibility: this._isVisible
    });
    
    if (hasRequiredRoles && !this._isVisible) {
      // แสดง element
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Element shown by role directive');
    } else if (!hasRequiredRoles && this._isVisible) {
      // ซ่อน element
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠️ Element hidden by role directive');
    }
  }

  private checkRoles(): boolean {
    if (!this._roles.length) {
      console.log('📋 No roles required, allowing access');
      return true; // ไม่มีเงื่อนไข = แสดง
    }

    if (!this.authService.isAuthenticated()) {
      console.log('🚫 User not authenticated, denying access');
      return false;
    }

    const userRoles = this.authService.getUserRoles();
    
    console.log('🔍 Checking roles:', {
      required: this._roles,
      user: userRoles,
      requireAll: this._requireAll
    });
    
    if (this._requireAll) {
      // ต้องมีทุก role
      const hasAll = this._roles.every(role => userRoles.includes(role));
      console.log('🎯 Require ALL roles:', hasAll);
      return hasAll;
    } else {
      // มีอย่างน้อย 1 role
      const hasAny = this._roles.some(role => userRoles.includes(role));
      console.log('🎯 Require ANY role:', hasAny);
      return hasAny;
    }
  }
}

// ===== ✅ NEW: Role ID Directive =====
@Directive({
  selector: '[hasRoleId]',
  standalone: true
})
export class HasRoleIdDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _roleIds: RoleId[] = [];
  private _requireAll = false;
  private _isVisible = false;

  /**
   * ✅ NEW: รับ single role ID หรือ array of role IDs พร้อม validation
   */
  @Input() set hasRoleId(roleIds: RoleId | RoleId[]) {
    if (typeof roleIds === 'number') {
      // ตรวจสอบว่าเป็น valid role ID
      if (Object.values(ROLE_IDS).includes(roleIds as RoleId)) {
        this._roleIds = [roleIds as RoleId];
      } else {
        console.warn('⚠️ Invalid role ID provided to hasRoleId directive:', roleIds);
        this._roleIds = [];
      }
    } else if (Array.isArray(roleIds)) {
      // กรองเฉพาะ valid role IDs
      this._roleIds = roleIds.filter(roleId => Object.values(ROLE_IDS).includes(roleId));
      
      if (this._roleIds.length !== roleIds.length) {
        const invalidRoleIds = roleIds.filter(roleId => !Object.values(ROLE_IDS).includes(roleId));
        console.warn('⚠️ Some invalid role IDs filtered out:', invalidRoleIds);
      }
    } else {
      console.warn('⚠️ Invalid role IDs provided to hasRoleId directive:', roleIds);
      this._roleIds = [];
    }

    console.log('🔢 HasRoleId directive updated:', {
      original: roleIds,
      processed: this._roleIds,
      roleNames: this._roleIds.map(id => ROLE_ID_TO_NAME[id])
    });

    this.updateVisibility();
  }

  @Input() set requireAll(value: boolean) {
    this._requireAll = value;
    this.updateVisibility();
  }

  ngOnInit(): void {
    console.log('🔧 HasRoleId directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auth state changed, updating role ID visibility');
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const hasRequiredRoleIds = this.checkRoleIds();
    
    console.log('🔍 Role ID check result:', {
      roleIds: this._roleIds,
      requireAll: this._requireAll,
      hasRoleIds: hasRequiredRoleIds,
      currentVisibility: this._isVisible
    });
    
    if (hasRequiredRoleIds && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Element shown by role ID directive');
    } else if (!hasRequiredRoleIds && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠️ Element hidden by role ID directive');
    }
  }

  private checkRoleIds(): boolean {
    if (!this._roleIds.length) {
      console.log('📋 No role IDs required, allowing access');
      return true;
    }

    if (!this.authService.isAuthenticated()) {
      console.log('🚫 User not authenticated, denying access');
      return false;
    }

    const userRoleIds = this.authService.getUserRoleIds();
    
    console.log('🔍 Checking role IDs:', {
      required: this._roleIds,
      user: userRoleIds,
      requireAll: this._requireAll
    });
    
    if (this._requireAll) {
      const hasAll = this._roleIds.every(roleId => userRoleIds.includes(roleId));
      console.log('🎯 Require ALL role IDs:', hasAll);
      return hasAll;
    } else {
      const hasAny = this._roleIds.some(roleId => userRoleIds.includes(roleId));
      console.log('🎯 Require ANY role ID:', hasAny);
      return hasAny;
    }
  }
}

// ===== ✅ ENHANCED: Combined Permission & Role Directive =====
@Directive({
  selector: '[hasAccess]',
  standalone: true
})
export class HasAccessDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _permissions: number[] = [];
  private _roles: UserRole[] = [];
  private _roleIds: RoleId[] = [];  // ✅ NEW: Add role IDs support
  private _requireAllPermissions = false;
  private _requireAllRoles = false;
  private _isVisible = false;

  /**
   * ✅ ENHANCED: รับ config object พร้อม validation และ Role ID support
   */
  @Input() set hasAccess(config: {
    permissions?: (number | permissionEnum)[];
    roles?: UserRole[];
    role_ids?: RoleId[];  // ✅ NEW: Add role IDs support
    requireAllPermissions?: boolean;
    requireAllRoles?: boolean;
  }) {
    // Process permissions
    if (config.permissions) {
      this._permissions = config.permissions.map(p => 
        typeof p === 'number' ? p : enumToNumber(p as permissionEnum)
      ).filter(p => isValidPermissionNumber(p));
    } else {
      this._permissions = [];
    }

    // Process roles
    if (config.roles) {
      this._roles = config.roles.filter(role => Object.values(ROLES).includes(role));
    } else {
      this._roles = [];
    }

    // ✅ NEW: Process role IDs
    if (config.role_ids) {
      this._roleIds = config.role_ids.filter(roleId => Object.values(ROLE_IDS).includes(roleId));
    } else {
      this._roleIds = [];
    }

    this._requireAllPermissions = config.requireAllPermissions || false;
    this._requireAllRoles = config.requireAllRoles || false;

    console.log('🔍👥🔢 HasAccess directive updated:', {
      permissions: this._permissions,
      roles: this._roles,
      roleIds: this._roleIds,
      requireAllPermissions: this._requireAllPermissions,
      requireAllRoles: this._requireAllRoles
    });

    this.updateVisibility();
  }

  ngOnInit(): void {
    console.log('🔧 HasAccess directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        console.log('🔄 Auth state changed, updating access visibility');
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const hasAccess = this.checkAccess();
    
    console.log('🔍 Access check result:', {
      permissions: this._permissions,
      roles: this._roles,
      roleIds: this._roleIds,
      hasAccess: hasAccess,
      currentVisibility: this._isVisible
    });
    
    if (hasAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Element shown by access directive');
    } else if (!hasAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠️ Element hidden by access directive');
    }
  }

  private checkAccess(): boolean {
    if (!this.authService.isAuthenticated()) {
      console.log('🚫 User not authenticated, denying access');
      return false;
    }

    const hasPermissions = this.checkPermissions();
    const hasRoles = this.checkRoles();
    const hasRoleIds = this.checkRoleIds(); // ✅ NEW: Check role IDs
    
    // ต้องผ่านทั้ง permission, role และ role ID checks
    const result = hasPermissions && hasRoles && hasRoleIds;
    
    console.log('🎯 Combined access check:', {
      hasPermissions,
      hasRoles,
      hasRoleIds,
      result
    });
    
    return result;
  }

  private checkPermissions(): boolean {
    if (!this._permissions.length) {
      return true;
    }

    const userPermissions = this.authService.getEffectivePermissions();
    
    if (this._requireAllPermissions) {
      return this._permissions.every(permission => 
        userPermissions.includes(permission)
      );
    } else {
      return this._permissions.some(permission => 
        userPermissions.includes(permission)
      );
    }
  }

  private checkRoles(): boolean {
    if (!this._roles.length) {
      return true;
    }

    const userRoles = this.authService.getUserRoles();
    
    if (this._requireAllRoles) {
      return this._roles.every(role => userRoles.includes(role));
    } else {
      return this._roles.some(role => userRoles.includes(role));
    }
  }

  // ✅ NEW: Check role IDs
  private checkRoleIds(): boolean {
    if (!this._roleIds.length) {
      return true;
    }

    const userRoleIds = this.authService.getUserRoleIds();
    
    if (this._requireAllRoles) {
      return this._roleIds.every(roleId => userRoleIds.includes(roleId));
    } else {
      return this._roleIds.some(roleId => userRoleIds.includes(roleId));
    }
  }
}

// ===== ✅ ENHANCED: Utility Directive สำหรับ Debug =====
@Directive({
  selector: '[debugPermissions]',
  standalone: true
})
export class DebugPermissionsDirective implements OnInit {
  private authService = inject(AuthService);

  @Input() debugPermissions: boolean = false;

  ngOnInit(): void {
    if (this.debugPermissions) {
      console.group('🔍 Permission Debug from Directive');
      console.log('🔍 User Permissions:', this.authService.getEffectivePermissions());
      console.log('👥 User Roles:', this.authService.getUserRoles());
      console.log('🔢 User Role IDs:', this.authService.getUserRoleIds()); // ✅ NEW
      console.log('🎯 Is Authenticated:', this.authService.isAuthenticated());
      console.log('🔧 Auth Methods:', {
        isAdmin: this.authService.isAdmin(),
        isSupporter: this.authService.isSupporter(),
        isUser: this.authService.isUser(),
        canManageTickets: this.authService.canManageTickets(),
        canViewAllTickets: this.authService.canViewAllTickets()
      });
      console.groupEnd();
    }
  }
}

// ===== ✅ UPDATED: Specific Permission Directives (รองรับ Role ID) =====

/**
 * ✅ UPDATED: Directive สำหรับ Supporter features เฉพาะ (รองรับ Role ID)
 */
@Directive({
  selector: '[supporterOnly]',
  standalone: true
})
export class SupporterOnlyDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 SupporterOnly directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    // ✅ UPDATED: ใช้ methods ที่รองรับ Role ID แล้ว
    const canAccess = this.authService.isSupporter() || this.authService.isAdmin();
    
    console.log('🔍 Supporter access check:', {
      canAccess,
      isSupporter: this.authService.isSupporter(),
      isAdmin: this.authService.isAdmin(),
      supporterRoleId: this.authService.hasRoleId(ROLE_IDS.SUPPORTER),
      adminRoleId: this.authService.hasRoleId(ROLE_IDS.ADMIN),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Supporter element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠️ Supporter element hidden');
    }
  }
}

/**
 * ✅ UPDATED: Directive สำหรับ Admin features เฉพาะ (รองรับ Role ID)
 */
@Directive({
  selector: '[adminOnly]',
  standalone: true
})
export class AdminOnlyDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 AdminOnly directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    // ✅ UPDATED: ใช้ method ที่รองรับ Role ID แล้ว
    const canAccess = this.authService.isAdmin();
    
    console.log('🔍 Admin access check:', {
      canAccess,
      isAdmin: this.authService.isAdmin(),
      adminRoleId: this.authService.hasRoleId(ROLE_IDS.ADMIN),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Admin element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠️ Admin element hidden');
    }
  }
}

/**
 * ✅ UPDATED: Directive สำหรับ User features เฉพาะ (ไม่ใช่ admin/supporter) - รองรับ Role ID
 */
@Directive({
  selector: '[userOnly]',
  standalone: true
})
export class UserOnlyDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 UserOnly directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    // ✅ UPDATED: User only = มี USER role และไม่มี ADMIN หรือ SUPPORTER role (รองรับ Role ID)
    const isUser = this.authService.isUser();
    const isAdmin = this.authService.isAdmin();
    const isSupporter = this.authService.isSupporter();
    const canAccess = isUser && !isAdmin && !isSupporter;
    
    console.log('🔍 User only access check:', {
      canAccess,
      isUser,
      isAdmin,
      isSupporter,
      userRoleId: this.authService.hasRoleId(ROLE_IDS.USER),
      adminRoleId: this.authService.hasRoleId(ROLE_IDS.ADMIN),
      supporterRoleId: this.authService.hasRoleId(ROLE_IDS.SUPPORTER),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ User-only element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠️ User-only element hidden');
    }
  }
}

// ===== ✅ NEW: Role ID Specific Directives =====

/**
 * ✅ NEW: Directive สำหรับ Admin Role ID (15) เฉพาะ
 */
@Directive({
  selector: '[adminRoleIdOnly]',
  standalone: true
})
export class AdminRoleIdOnlyDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 AdminRoleIdOnly directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const canAccess = this.authService.hasRoleId(ROLE_IDS.ADMIN);
    
    console.log('🔍 Admin Role ID access check:', {
      canAccess,
      hasAdminRoleId: this.authService.hasRoleId(ROLE_IDS.ADMIN),
      userRoleIds: this.authService.getUserRoleIds(),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Admin Role ID element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠️ Admin Role ID element hidden');
    }
  }
}

/**
 * ✅ NEW: Directive สำหรับ Supporter Role ID (8) เฉพาะ
 */
@Directive({
  selector: '[supporterRoleIdOnly]',
  standalone: true
})
export class SupporterRoleIdOnlyDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 SupporterRoleIdOnly directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const canAccess = this.authService.hasRoleId(ROLE_IDS.SUPPORTER);
    
    console.log('🔍 Supporter Role ID access check:', {
      canAccess,
      hasSupporterRoleId: this.authService.hasRoleId(ROLE_IDS.SUPPORTER),
      userRoleIds: this.authService.getUserRoleIds(),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Supporter Role ID element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠️ Supporter Role ID element hidden');
    }
  }
}

// ===== ✅ UPDATED: Specific Feature Directives (รองรับ 20 permissions + Role ID) =====

/**
 * ✅ UPDATED: Directive สำหรับ Customer Management features
 */
@Directive({
  selector: '[canManageCustomer]',
  standalone: true
})
export class CanManageCustomerDirective implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private destroy$ = new Subject<void>();

  private _isVisible = false;

  ngOnInit(): void {
    console.log('🔧 CanManageCustomer directive initialized');
    
    this.authService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateVisibility();
      });

    this.updateVisibility();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateVisibility(): void {
    const userPermissions = this.authService.getEffectivePermissions();
    const canAccess = userPermissions.includes(20); // MANAGE_CUSTOMER
    
    console.log('🔍 Customer management access check:', {
      canAccess,
      hasManageCustomer: userPermissions.includes(20),
      currentVisibility: this._isVisible
    });
    
    if (canAccess && !this._isVisible) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this._isVisible = true;
      console.log('✅ Customer management element shown');
    } else if (!canAccess && this._isVisible) {
      this.viewContainer.clear();
      this._isVisible = false;
      console.log('⚠️ Customer management element hidden');
    }
  }
}

// ===== ✅ Export ทั้งหมดเพื่อใช้งาน =====
export const PERMISSION_DIRECTIVES = [
  // Core directives
  HasPermissionDirective,
  HasRoleDirective, 
  HasRoleIdDirective,          // ✅ NEW: Role ID directive
  HasAccessDirective,
  DebugPermissionsDirective,
  
  // Role-specific directives
  SupporterOnlyDirective,
  AdminOnlyDirective,
  UserOnlyDirective,
  
  // Role ID-specific directives
  AdminRoleIdOnlyDirective,     // ✅ NEW
  SupporterRoleIdOnlyDirective, // ✅ NEW
  
  // Feature-specific directives
  CanManageCustomerDirective
  
  // TODO: Add more feature directives as needed:
  // CanManageProjectDirective,
  // CanManageSystemDirective,
  // CanViewDashboardDirective
] as const;