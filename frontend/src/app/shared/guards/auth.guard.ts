import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { 
  permissionEnum, 
  UserRole, 
  RoleId,
  ROLES,
  ROLE_IDS,
  checkAccess,
  ROLE_ID_TO_NAME
} from '../models/permission.model';

/**
 * ✅ UPDATED: Enhanced Auth Guard with Permission and Role Support + Role ID Support
 * 
 * Usage in routes:
 * {
 *   path: 'admin',
 *   component: AdminComponent,
 *   canActivate: [authGuard],
 *   data: {
 *     permissions: [permissionEnum.ADD_USER, permissionEnum.DEL_USER],
 *     roles: ['admin'],
 *     role_ids: [15], // ✅ NEW: Support role IDs
 *     requireAllPermissions: true,
 *     requireAllRoles: false
 *   }
 * }
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot, 
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔍 Auth Guard checking access for:', state.url);
  console.log('Route data:', route.data);

  // ===== 1. Basic Authentication Check ===== ✅
  
  if (!authService.isAuthenticated()) {
    console.log('❌ Not authenticated, redirecting to login');
    router.navigate(['/login'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false;
  }

  console.log('✅ User is authenticated');

  // ===== 2. ✅ UPDATED: Permission and Role Extraction (with Role ID support) =====
  
  const requiredPermissions: number[] = route.data['permissions'] || [];
  const requiredRoles: UserRole[] = route.data['roles'] || [];
  const requiredRoleIds: RoleId[] = route.data['role_ids'] || []; // ✅ NEW: Support role IDs in route data
  const requireAllPermissions: boolean = route.data['requireAllPermissions'] || false;
  const requireAllRoles: boolean = route.data['requireAllRoles'] || false;

  // ถ้าไม่มีเงื่อนไข permission, role หรือ role ID = อนุญาต
  if (requiredPermissions.length === 0 && requiredRoles.length === 0 && requiredRoleIds.length === 0) {
    console.log('✅ No specific permissions, roles, or role IDs required, allowing access');
    return true;
  }

  // ===== 3. ✅ UPDATED: User Data Validation (with Role ID support) =====
  
  const userPermissions = authService.getEffectivePermissions();
  const userRoles = authService.getUserRoles();
  const userRoleIds = authService.getUserRoleIds(); // ✅ NEW: Get user role IDs
  const currentUser = authService.getCurrentUser();

  console.log('🔍 Access control check:', {
    userRoles,
    userRoleIds,
    userPermissions,
    userPermissionCount: userPermissions.length,
    requiredPermissions,
    requiredRoles,
    requiredRoleIds,
    requireAllPermissions,
    requireAllRoles
  });

  // ===== 4. Permission Checking ===== (no changes needed)
  
  let hasRequiredPermissions = true;
  let permissionMessage = '';

  if (requiredPermissions.length > 0) {
    if (requireAllPermissions) {
      // ต้องมีทุก permission
      hasRequiredPermissions = requiredPermissions.every(p => userPermissions.includes(p));
      if (!hasRequiredPermissions) {
        const missingPermissions = requiredPermissions.filter(p => !userPermissions.includes(p));
        permissionMessage = `Missing required permissions: ${missingPermissions.join(', ')}`;
      }
    } else {
      // มีอย่างน้อย 1 permission
      hasRequiredPermissions = requiredPermissions.some(p => userPermissions.includes(p));
      if (!hasRequiredPermissions) {
        permissionMessage = `Missing any of required permissions: ${requiredPermissions.join(', ')}`;
      }
    }
  }

  // ===== 5. ✅ UPDATED: Role Checking (with Role ID support) =====
  
  let hasRequiredRoles = true;
  let roleMessage = '';

  if (requiredRoles.length > 0 || requiredRoleIds.length > 0) {
    // ✅ NEW: Check both role names and role IDs
    let roleNameCheck = true;
    let roleIdCheck = true;
    
    // Check role names if specified
    if (requiredRoles.length > 0) {
      if (requireAllRoles) {
        roleNameCheck = requiredRoles.every(role => userRoles.includes(role));
      } else {
        roleNameCheck = requiredRoles.some(role => userRoles.includes(role));
      }
    }
    
    // ✅ NEW: Check role IDs if specified
    if (requiredRoleIds.length > 0) {
      if (requireAllRoles) {
        roleIdCheck = requiredRoleIds.every(roleId => userRoleIds.includes(roleId));
      } else {
        roleIdCheck = requiredRoleIds.some(roleId => userRoleIds.includes(roleId));
      }
    }
    
    // ✅ UPDATED: Combined role check (pass if either role names OR role IDs match)
    hasRequiredRoles = roleNameCheck && roleIdCheck;
    
    if (!hasRequiredRoles) {
      const messages: string[] = [];
      
      if (requiredRoles.length > 0 && !roleNameCheck) {
        const missingRoles = requireAllRoles 
          ? requiredRoles.filter(role => !userRoles.includes(role))
          : requiredRoles;
        messages.push(`Missing role names: ${missingRoles.join(', ')}`);
      }
      
      if (requiredRoleIds.length > 0 && !roleIdCheck) {
        const missingRoleIds = requireAllRoles
          ? requiredRoleIds.filter(roleId => !userRoleIds.includes(roleId))
          : requiredRoleIds;
        const missingRoleNames = missingRoleIds.map(id => ROLE_ID_TO_NAME[id] || `ID:${id}`);
        messages.push(`Missing role IDs: ${missingRoleNames.join(', ')}`);
      }
      
      roleMessage = messages.join('. ');
    }
  }

  // ===== 6. Access Decision ===== ✅
  
  const hasAccess = hasRequiredPermissions && hasRequiredRoles;

  if (hasAccess) {
    console.log('✅ Access granted to:', state.url);
    console.log('User has:', {
      roles: userRoles,
      roleIds: userRoleIds,
      permissions: userPermissions.length + ' permissions'
    });
    return true;
  } else {
    // ===== 7. Access Denied Handling ===== ✅
    
    const errorMessages: string[] = [];
    
    if (permissionMessage) {
      errorMessages.push(permissionMessage);
    }
    
    if (roleMessage) {
      errorMessages.push(roleMessage);
    }

    const fullErrorMessage = errorMessages.join('. ');
    
    console.log('❌ Access denied to:', state.url);
    console.log('Reason:', fullErrorMessage);
    console.log('User info:', {
      username: currentUser?.username,
      roles: userRoles,
      roleIds: userRoleIds,
      permissions: userPermissions,
      permissionCount: userPermissions.length
    });

    // ส่งไปหน้า access denied หรือกลับไป dashboard
    handleAccessDenied(router, state.url, fullErrorMessage, {
      requiredPermissions,
      requiredRoles,
      requiredRoleIds, // ✅ NEW: Include required role IDs
      userPermissions,
      userRoles,
      userRoleIds      // ✅ NEW: Include user role IDs
    });

    return false;
  }
};

/**
 * ✅ UPDATED: จัดการเมื่อถูกปฏิเสธการเข้าถึง (with Role ID support)
 */
function handleAccessDenied(
  router: Router, 
  attemptedUrl: string, 
  reason: string,
  context: {
    requiredPermissions: number[];
    requiredRoles: UserRole[];
    requiredRoleIds?: RoleId[];     // ✅ NEW: Include required role IDs
    userPermissions: number[];
    userRoles: UserRole[];
    userRoleIds?: RoleId[];         // ✅ NEW: Include user role IDs
  }
): void {
  
  // สร้างข้อความที่เป็นมิตรกับผู้ใช้
  const userFriendlyMessage = createUserFriendlyAccessDeniedMessage(context);
  
  // แสดง notification (ถ้ามี notification service)
  console.warn('🚫 Access Denied:', userFriendlyMessage);
  
  // TODO: เพิ่ม notification service
  // this.notificationService.showError(userFriendlyMessage);
  
  // กลับไป dashboard
  router.navigate(['/dashboard'], {
    queryParams: {
      accessDenied: 'true',
      reason: encodeURIComponent(reason)
    }
  });
}

/**
 * ✅ UPDATED: สร้างข้อความแจ้งเตือนที่เป็นมิตรกับผู้ใช้ (รองรับ Role IDs)
 */
function createUserFriendlyAccessDeniedMessage(context: {
  requiredPermissions: number[];
  requiredRoles: UserRole[];
  requiredRoleIds?: RoleId[];
  userPermissions: number[];
  userRoles: UserRole[];
  userRoleIds?: RoleId[];
}): string {
  
  const messages: string[] = [];
  
  // ✅ UPDATED: ตรวจสอบ role requirements (both names and IDs)
  const allRequiredRoles = [...context.requiredRoles];
  
  // ✅ NEW: Add role names from required role IDs
  if (context.requiredRoleIds) {
    const roleNamesFromIds = context.requiredRoleIds.map(id => ROLE_ID_TO_NAME[id]).filter(Boolean);
    allRequiredRoles.push(...roleNamesFromIds);
  }
  
  if (allRequiredRoles.length > 0) {
    const roleNames = [...new Set(allRequiredRoles)].map(role => {
      switch (role) {
        case 'admin': return 'ผู้ดูแลระบบ';
        case 'supporter': return 'ผู้สนับสนุน';
        case 'user': return 'ผู้ใช้งาน';
        default: return role;
      }
    });
    
    messages.push(`ต้องการสิทธิ์: ${roleNames.join(' หรือ ')}`);
  }
  
  // ตรวจสอบ permission requirements
  if (context.requiredPermissions.length > 0) {
    const permissionNames = context.requiredPermissions.map(permission => {
      // แปลง permission number เป็นชื่อที่อ่านได้ (20 permissions)
      switch (permission) {
        case 1: return 'แจ้งปัญหา';
        case 2: return 'ติดตามปัญหา';
        case 3: return 'แก้ไข ticket';
        case 4: return 'ลบ ticket';
        case 5: return 'เปลี่ยนสถานะของ ticket';
        case 6: return 'ตอบกลับ ticket';
        case 7: return 'ปิด ticket';
        case 8: return 'แก้ไขปัญหา';
        case 9: return 'ผู้รับเรื่อง';
        case 10: return 'จัดการ project';
        case 11: return 'กู้คืน ticket';
        case 12: return 'ดูรายงานตั๋วของตัวเอง';
        case 13: return 'ดูรายงานทั้งหมด';
        case 14: return 'ให้คะแนนความพึงพอใจ';
        case 15: return 'เพิ่มผู้ใช้';
        case 16: return 'ลบผู้ใช้';
        case 17: return 'จัดการ category';
        case 18: return 'จัดการ status';
        case 19: return 'มอนเทอริ่ง';
        case 20: return 'จัดการ customer';
        default: return `Permission ${permission}`;
      }
    });
    
    messages.push(`ต้องการสิทธิ์: ${permissionNames.join(', ')}`);
  }
  
  if (messages.length === 0) {
    return 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้';
  }
  
  return `ไม่สามารถเข้าถึงได้ ${messages.join(' และ ')}`;
}

// ===== ✅ UPDATED: Specialized Guards with Role ID Support =====

/**
 * ✅ UPDATED: Guard สำหรับ Admin เท่านั้น (รองรับ Role ID)
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('👑 Admin Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // ✅ UPDATED: ตรวจสอบทั้ง role และ role ID และ permissions
  const isAdmin = authService.isAdmin();
  const hasAdminRoleId = authService.hasRoleId(ROLE_IDS.ADMIN); // ✅ NEW: Check by role ID
  const hasAdminPermissions = authService.hasAnyPermission([15, 16]); // ADD_USER, DELETE_USER
  const hasManageProject = authService.hasPermission(10); // MANAGE_PROJECT

  console.log('👑 Admin check details:', {
    isAdmin,
    hasAdminRoleId,
    hasAdminPermissions,
    hasManageProject,
    userRoles: authService.getUserRoles(),
    userRoleIds: authService.getUserRoleIds(),
    userPermissions: authService.getEffectivePermissions()
  });

  // ✅ UPDATED: อนุโลมให้ผ่านถ้ามี admin role, role ID, หรือ admin permissions
  if (!isAdmin && !hasAdminRoleId && !hasAdminPermissions && !hasManageProject) {
    console.log('❌ User is not admin and has no admin permissions');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์ผู้ดูแลระบบ', {
      requiredPermissions: [15], // ADD_USER as minimum admin permission
      requiredRoles: ['admin'],
      requiredRoleIds: [ROLE_IDS.ADMIN],
      userPermissions: authService.getEffectivePermissions(),
      userRoles: authService.getUserRoles(),
      userRoleIds: authService.getUserRoleIds()
    });
    return false;
  }

  console.log('✅ Admin access granted');
  return true;
};

/**
 * ✅ UPDATED: Guard สำหรับ Support Team (Admin + Supporter) with Role ID support
 */
export const supportGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🛠️ Support Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // ✅ UPDATED: ตรวจสอบทั้ง role names, role IDs และ permissions
  const hasRole = authService.hasAnyRole(['admin', 'supporter']);
  const hasRoleId = authService.hasRoleId(ROLE_IDS.ADMIN) || authService.hasRoleId(ROLE_IDS.SUPPORTER);
  const hasSupportPermissions = authService.hasAnyPermission([13, 9, 6, 8]); // VIEW_ALL_TICKETS, ASSIGNEE, REPLY_TICKET, SOLVE_PROBLEM

  console.log('🛠️ Support check details:', {
    hasRole,
    hasRoleId,
    hasSupportPermissions,
    userRoles: authService.getUserRoles(),
    userRoleIds: authService.getUserRoleIds(),
    userPermissions: authService.getEffectivePermissions()
  });

  // ✅ UPDATED: Pass if has role names OR role IDs OR support permissions
  if (!hasRole && !hasRoleId && !hasSupportPermissions) {
    console.log('❌ User is not support team member');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์ทีมสนับสนุน', {
      requiredPermissions: [13, 9], // VIEW_ALL_TICKETS, ASSIGNEE
      requiredRoles: ['admin', 'supporter'],
      requiredRoleIds: [ROLE_IDS.ADMIN, ROLE_IDS.SUPPORTER],
      userPermissions: authService.getEffectivePermissions(),
      userRoles: authService.getUserRoles(),
      userRoleIds: authService.getUserRoleIds()
    });
    return false;
  }

  console.log('✅ Support team access granted');
  return true;
};

/**
 * ✅ UPDATED: Guard สำหรับ User Management (รองรับ Role ID)
 */
export const userManagementGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('👥 User Management Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const canManageUsers = authService.hasAnyPermission([15, 16]); // ADD_USER, DELETE_USER
  const isAdmin = authService.isAdmin(); // This now checks both role name and role ID

  if (!canManageUsers && !isAdmin) {
    console.log('❌ User cannot manage users');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์จัดการผู้ใช้', {
      requiredPermissions: [15, 16], // ADD_USER, DELETE_USER
      requiredRoles: ['admin'],
      requiredRoleIds: [ROLE_IDS.ADMIN],
      userPermissions: authService.getEffectivePermissions(),
      userRoles: authService.getUserRoles(),
      userRoleIds: authService.getUserRoleIds()
    });
    return false;
  }

  console.log('✅ User management access granted');
  return true;
};

/**
 * ✅ UPDATED: Guard สำหรับ Ticket Management (รองรับ Role ID)
 */
export const ticketManagementGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🎫 Ticket Management Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  const canManage = authService.hasAnyPermission([
    13, // VIEW_ALL_TICKETS
    5,  // CHANGE_STATUS
    9,  // ASSIGNEE
    8   // SOLVE_PROBLEM
  ]);

  const isSupport = authService.isSupporter() || authService.isAdmin(); // This now checks role IDs too

  if (!canManage && !isSupport) {
    console.log('❌ User cannot manage tickets');
    handleAccessDenied(router, state.url, 'ต้องการสิทธิ์จัดการตั๋ว', {
      requiredPermissions: [13, 5, 9, 8], // VIEW_ALL_TICKETS, CHANGE_STATUS, ASSIGNEE, SOLVE_PROBLEM
      requiredRoles: ['admin', 'supporter'],
      requiredRoleIds: [ROLE_IDS.ADMIN, ROLE_IDS.SUPPORTER],
      userPermissions: authService.getEffectivePermissions(),
      userRoles: authService.getUserRoles(),
      userRoleIds: authService.getUserRoleIds()
    });
    return false;
  }

  console.log('✅ Ticket management access granted');
  return true;
};

/**
 * ✅ UPDATED: Guard สำหรับ Own Tickets Only (ห้าม admin/supporter เข้า)
 */
export const ownTicketsOnlyGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('📄 Own Tickets Only Guard checking access');

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  // ตรวจสอบว่าสามารถดูแค่ tickets ของตัวเองได้เท่านั้น
  const hasViewOwn = authService.hasPermission(12); // VIEW_OWN_TICKETS
  const hasViewAll = authService.hasPermission(13); // VIEW_ALL_TICKETS
  const isElevatedUser = authService.isAdmin() || authService.isSupporter(); // Checks role IDs too
  const canViewOwnOnly = hasViewOwn && !hasViewAll && !isElevatedUser;

  if (!canViewOwnOnly) {
    console.log('❌ User has elevated permissions, redirecting to all tickets');
    router.navigate(['/tickets']); // Redirect ไปหน้า all tickets
    return false;
  }

  console.log('✅ Own tickets only access granted');
  return true;
};

// ===== ✅ UPDATED: Guard Utility Functions with Role ID Support =====

/**
 * ✅ UPDATED: Helper function สำหรับสร้าง custom permission guard (รองรับ Role ID)
 */
export function createPermissionGuard(
  requiredPermissions: number[],
  requireAll: boolean = false
): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    console.log('🔑 Custom Permission Guard:', {
      requiredPermissions,
      requireAll,
      url: state.url
    });

    if (!authService.isAuthenticated()) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const userPermissions = authService.getEffectivePermissions();
    
    const hasPermission = requireAll 
      ? requiredPermissions.every(p => userPermissions.includes(p))
      : requiredPermissions.some(p => userPermissions.includes(p));

    console.log('🔑 Permission check result:', {
      hasPermission,
      userPermissions,
      requiredPermissions,
      requireAll
    });

    if (!hasPermission) {
      const action = requireAll ? 'ทั้งหมด' : 'อย่างน้อยหนึ่งรายการ';
      handleAccessDenied(router, state.url, `ต้องการสิทธิ์ ${action}`, {
        requiredPermissions,
        requiredRoles: [],
        requiredRoleIds: [],
        userPermissions,
        userRoles: authService.getUserRoles(),
        userRoleIds: authService.getUserRoleIds()
      });
      return false;
    }

    return true;
  };
}

/**
 * ✅ UPDATED: Helper function สำหรับสร้าง custom role guard (รองรับ Role ID)
 */
export function createRoleGuard(
  requiredRoles: UserRole[] = [],
  requiredRoleIds: RoleId[] = [],
  requireAll: boolean = false
): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const userRoles = authService.getUserRoles();
    const userRoleIds = authService.getUserRoleIds();

    // ✅ NEW: Check both role names and role IDs
    let hasRoleNames = true;
    let hasRoleIds = true;

    if (requiredRoles.length > 0) {
      hasRoleNames = requireAll 
        ? requiredRoles.every(role => userRoles.includes(role))
        : requiredRoles.some(role => userRoles.includes(role));
    }

    if (requiredRoleIds.length > 0) {
      hasRoleIds = requireAll
        ? requiredRoleIds.every(roleId => userRoleIds.includes(roleId))
        : requiredRoleIds.some(roleId => userRoleIds.includes(roleId));
    }

    const hasRole = hasRoleNames && hasRoleIds;

    if (!hasRole) {
      const action = requireAll ? 'ทั้งหมด' : 'อย่างน้อยหนึ่งตำแหน่ง';
      handleAccessDenied(router, state.url, `ต้องการตำแหน่ง ${action}`, {
        requiredPermissions: [],
        requiredRoles,
        requiredRoleIds,
        userPermissions: authService.getEffectivePermissions(),
        userRoles,
        userRoleIds
      });
      return false;
    }

    return true;
  };
}

/**
 * ✅ UPDATED: Guard สำหรับตรวจสอบหลายเงื่อนไขพร้อมกัน (รองรับ Role ID)
 */
export function createComplexGuard(config: {
  permissions?: number[];
  roles?: UserRole[];
  role_ids?: RoleId[];          // ✅ NEW: Support role IDs
  requireAllPermissions?: boolean;
  requireAllRoles?: boolean;
  customCheck?: (authService: AuthService) => boolean;
  errorMessage?: string;
}): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const userPermissions = authService.getEffectivePermissions();
    const userRoles = authService.getUserRoles();
    const userRoleIds = authService.getUserRoleIds();

    // ตรวจสอบ permissions
    if (config.permissions?.length) {
      const hasPermissions = config.requireAllPermissions
        ? config.permissions.every(p => userPermissions.includes(p))
        : config.permissions.some(p => userPermissions.includes(p));
      
      if (!hasPermissions) {
        handleAccessDenied(router, state.url, config.errorMessage || 'ไม่มีสิทธิ์ที่จำเป็น', {
          requiredPermissions: config.permissions,
          requiredRoles: config.roles || [],
          requiredRoleIds: config.role_ids || [],
          userPermissions,
          userRoles,
          userRoleIds
        });
        return false;
      }
    }

    // ✅ UPDATED: ตรวจสอบ roles (both names and IDs)
    if (config.roles?.length || config.role_ids?.length) {
      let hasRoleNames = true;
      let hasRoleIds = true;

      if (config.roles?.length) {
        hasRoleNames = config.requireAllRoles
          ? config.roles.every(role => userRoles.includes(role))
          : config.roles.some(role => userRoles.includes(role));
      }

      if (config.role_ids?.length) {
        hasRoleIds = config.requireAllRoles
          ? config.role_ids.every(roleId => userRoleIds.includes(roleId))
          : config.role_ids.some(roleId => userRoleIds.includes(roleId));
      }
      
      if (!hasRoleNames || !hasRoleIds) {
        handleAccessDenied(router, state.url, config.errorMessage || 'ไม่มีตำแหน่งที่จำเป็น', {
          requiredPermissions: config.permissions || [],
          requiredRoles: config.roles || [],
          requiredRoleIds: config.role_ids || [],
          userPermissions,
          userRoles,
          userRoleIds
        });
        return false;
      }
    }

    // ตรวจสอบ custom logic
    if (config.customCheck && !config.customCheck(authService)) {
      handleAccessDenied(router, state.url, config.errorMessage || 'ไม่ผ่านเงื่อนไขการตรวจสอบ', {
        requiredPermissions: config.permissions || [],
        requiredRoles: config.roles || [],
        requiredRoleIds: config.role_ids || [],
        userPermissions,
        userRoles,
        userRoleIds
      });
      return false;
    }

    return true;
  };
}

// ===== ✅ NEW: Role ID Specific Guards =====

/**
 * ✅ NEW: Guard สำหรับตรวจสอบ role ID โดยตรง
 */
export function createRoleIdGuard(
  requiredRoleId: RoleId,
  errorMessage?: string
): CanActivateFn {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return false;
    }

    const hasRoleId = authService.hasRoleId(requiredRoleId);

    if (!hasRoleId) {
      const roleName = ROLE_ID_TO_NAME[requiredRoleId] || `Role ID ${requiredRoleId}`;
      const message = errorMessage || `ต้องการตำแหน่ง ${roleName}`;
      
      handleAccessDenied(router, state.url, message, {
        requiredPermissions: [],
        requiredRoles: [],
        requiredRoleIds: [requiredRoleId],
        userPermissions: authService.getEffectivePermissions(),
        userRoles: authService.getUserRoles(),
        userRoleIds: authService.getUserRoleIds()
      });
      return false;
    }

    return true;
  };
}

/**
 * ✅ NEW: Guard สำหรับ Admin โดยใช้ role ID
 */
export const adminRoleIdGuard: CanActivateFn = createRoleIdGuard(
  ROLE_IDS.ADMIN, 
  'ต้องการสิทธิ์ผู้ดูแลระบบ'
);

/**
 * ✅ NEW: Guard สำหรับ Supporter โดยใช้ role ID
 */
export const supporterRoleIdGuard: CanActivateFn = createRoleIdGuard(
  ROLE_IDS.SUPPORTER, 
  'ต้องการสิทธิ์ผู้สนับสนุน'
);

/**
 * ✅ NEW: Guard สำหรับ User โดยใช้ role ID
 */
export const userRoleIdGuard: CanActivateFn = createRoleIdGuard(
  ROLE_IDS.USER, 
  'ต้องการสิทธิ์ผู้ใช้งาน'
);

// ===== Export All Guards ===== ✅
export const PERMISSION_GUARDS = {
  // Basic guards
  auth: authGuard,
  admin: adminGuard,
  support: supportGuard,
  ticketManagement: ticketManagementGuard,
  userManagement: userManagementGuard,
  ownTicketsOnly: ownTicketsOnlyGuard,
  
  // Role ID specific guards
  adminRoleId: adminRoleIdGuard,
  supporterRoleId: supporterRoleIdGuard,
  userRoleId: userRoleIdGuard,
  
  // Helper functions
  createPermissionGuard,
  createRoleGuard,
  createComplexGuard,
  createRoleIdGuard
} as const;