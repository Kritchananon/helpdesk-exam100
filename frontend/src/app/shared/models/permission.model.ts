// ===== Permission Enum (ตรงกับ Backend - 20 permissions) =====
export enum permissionEnum {
  CREATE_TICKET = 1,          // แจ้งปัญหา
  TRACK_TICKET = 2,           // ติดตามปัญหา
  EDIT_TICKET = 3,            // แก้ไข ticket
  DELETE_TICKET = 4,          // ลบ ticket
  CHANGE_STATUS = 5,          // เปลี่ยนสถานะของ ticket
  REPLY_TICKET = 6,           // ตอบกลับ ticket
  CLOSE_TICKET = 7,           // ปิด ticket
  SOLVE_PROBLEM = 8,          // แก้ไขปัญหา
  ASSIGN_TO = 9,              // ผู้รับเรื่อง
  MANAGE_PROJECT = 10,        // จัดการ project
  RESTORE_TICKET = 11,        // กู้คืน ticket
  VIEW_OWN_TICKETS = 12,      // ดูรายงานตั๋วของตัวเอง
  VIEW_ALL_TICKETS = 13,      // ดูรายงานทั้งหมด
  SATISFACTION = 14,          // ให้คะแนนความพึงพอใจ
  ADD_USER = 15,              // เพิ่มผู้ใช้
  DEL_USER = 16,              // ลบผู้ใช้
  MANAGE_CATEGORY = 17,       // จัดการ category
  MANAGE_STATUS = 18,         // จัดการ status
  ASSIGNEE = 19,              // มอบหมายงาน
  MANAGE_CUSTOMER = 20        // จัดการ customer
}

// ===== UPDATED: Role System with ID-based approach ===== ✅
export const ROLE_IDS = {
  USER: 1,
  SUPPORTER: 8, 
  ADMIN: 15,
} as const;

// Keep backward compatibility with string roles
export const ROLES = {
  ADMIN: 'admin',
  SUPPORTER: 'supporter', 
  USER: 'user',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];
export type RoleId = typeof ROLE_IDS[keyof typeof ROLE_IDS];

// ===== UPDATED: Role ID to Role Name Mapping ===== ✅
export const ROLE_ID_TO_NAME: Record<RoleId, UserRole> = {
  [ROLE_IDS.USER]: ROLES.USER,
  [ROLE_IDS.SUPPORTER]: ROLES.SUPPORTER,
  [ROLE_IDS.ADMIN]: ROLES.ADMIN,
};

export const ROLE_NAME_TO_ID: Record<UserRole, RoleId> = {
  [ROLES.USER]: ROLE_IDS.USER,
  [ROLES.SUPPORTER]: ROLE_IDS.SUPPORTER,
  [ROLES.ADMIN]: ROLE_IDS.ADMIN,
};

// ===== UPDATED: Role-Based Permissions Mapping (by Role ID) ===== ✅
export const ROLE_ID_PERMISSIONS: Record<RoleId, number[]> = {
  [ROLE_IDS.ADMIN]: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20
  ],
  [ROLE_IDS.SUPPORTER]: [
    2, 3, 5, 6, 7, 8, 9, 11, 12, 13, 19, 20
  ],
  [ROLE_IDS.USER]: [
    1, 2, 3, 4, 12, 14
  ]
};

// Keep backward compatibility
export const ROLE_PERMISSIONS: Record<UserRole, number[]> = {
  [ROLES.ADMIN]: ROLE_ID_PERMISSIONS[ROLE_IDS.ADMIN],
  [ROLES.SUPPORTER]: ROLE_ID_PERMISSIONS[ROLE_IDS.SUPPORTER],
  [ROLES.USER]: ROLE_ID_PERMISSIONS[ROLE_IDS.USER]
};

// ===== FIXED: Constants for Stable References (Prevents Infinite Loops) ===== ✅
const EMPTY_ROLES: UserRole[] = [];
const EMPTY_PERMISSIONS: number[] = [];

// ===== UPDATED: Validation Functions with Role ID Support ===== ✅

/**
 * ✅ Convert role IDs to role names
 */
export function convertRoleIdsToNames(roleIds: number[]): UserRole[] {
  if (!roleIds || roleIds.length === 0) return EMPTY_ROLES;
  const result = roleIds
    .filter(id => Object.values(ROLE_IDS).includes(id as RoleId))
    .map(id => ROLE_ID_TO_NAME[id as RoleId])
    .filter(Boolean);
  
  return result.length > 0 ? result : EMPTY_ROLES;
}

/**
 * ✅ Convert role names to role IDs  
 */
export function convertRoleNamesToIds(roleNames: UserRole[]): RoleId[] {
  if (!roleNames || roleNames.length === 0) return [];
  return roleNames
    .filter(name => Object.values(ROLES).includes(name))
    .map(name => ROLE_NAME_TO_ID[name])
    .filter(Boolean);
}

/**
 * ✅ Safe validation for mixed role input (IDs or names)
 * FIXED: Returns stable reference for empty arrays to prevent Change Detection Loops
 */
export function validateAndNormalizeRoles(roles: any): UserRole[] {
  // Check for invalid input
  if (!roles) return EMPTY_ROLES;
  if (!Array.isArray(roles)) return EMPTY_ROLES;
  if (roles.length === 0) return EMPTY_ROLES;

  const validRoles: UserRole[] = [];
  
  for (const role of roles) {
    // Handle role ID (number)
    if (typeof role === 'number' && Object.values(ROLE_IDS).includes(role as RoleId)) {
      const roleName = ROLE_ID_TO_NAME[role as RoleId];
      if (roleName) validRoles.push(roleName);
    }
    // Handle role name (string)  
    else if (typeof role === 'string' && Object.values(ROLES).includes(role as UserRole)) {
      validRoles.push(role as UserRole);
    }
    // Handle role object with id property
    else if (typeof role === 'object' && role.id && typeof role.id === 'number') {
      const roleName = ROLE_ID_TO_NAME[role.id as RoleId];
      if (roleName) validRoles.push(roleName);
    }
  }

  // If validation resulted in empty array, return the singleton EMPTY_ROLES
  return validRoles.length > 0 ? validRoles : EMPTY_ROLES;
}

/**
 * ✅ Safe permission validation function
 * FIXED: Returns stable reference for empty arrays
 */
export function validateAndNormalizePermissions(permissions: any): number[] {
  if (!permissions) return EMPTY_PERMISSIONS;
  if (!Array.isArray(permissions)) return EMPTY_PERMISSIONS;
  if (permissions.length === 0) return EMPTY_PERMISSIONS;

  const validPermissions: number[] = [];
  
  for (const permission of permissions) {
    if (typeof permission === 'number' && !isNaN(permission)) {
      if (isValidPermissionNumber(permission)) {
        validPermissions.push(permission);
      }
    } else if (typeof permission === 'string') {
      const numPermission = parseInt(permission, 10);
      if (!isNaN(numPermission) && isValidPermissionNumber(numPermission)) {
        validPermissions.push(numPermission);
      }
    }
  }

  return validPermissions.length > 0 ? validPermissions : EMPTY_PERMISSIONS;
}

// ===== UPDATED: Helper Functions with Role ID Support ===== ✅

/**
 * ✅ Get permissions from role ID
 */
export function getRoleIdPermissions(roleId: RoleId): number[] {
  return ROLE_ID_PERMISSIONS[roleId] || EMPTY_PERMISSIONS;
}

/**
 * ✅ Get permissions from role name (backward compatibility)
 */
export function getRolePermissions(role: UserRole): number[] {
  return ROLE_PERMISSIONS[role] || EMPTY_PERMISSIONS;
}

/**
 * ✅ Get permissions from mixed role input (IDs or names)
 */
export function getPermissionsFromRoles(roles: UserRole[]): number[] {
  if (!roles || roles.length === 0) return EMPTY_PERMISSIONS;
  const allPermissions = roles.flatMap(role => getRolePermissions(role));
  return [...new Set(allPermissions)]; // Remove duplicates
}

/**
 * ✅ Get permissions from role IDs
 */
export function getPermissionsFromRoleIds(roleIds: RoleId[]): number[] {
  if (!roleIds || roleIds.length === 0) return EMPTY_PERMISSIONS;
  const allPermissions = roleIds.flatMap(roleId => getRoleIdPermissions(roleId));
  return [...new Set(allPermissions)]; // Remove duplicates
}

/**
 * ✅ Check if user has role by ID
 */
export function userHasRoleId(userRoleIds: RoleId[], requiredRoleId: RoleId): boolean {
  return userRoleIds?.includes(requiredRoleId) ?? false;
}

/**
 * ✅ Check if user is admin by role ID
 */
export function isAdminByRoleId(userRoleIds: RoleId[]): boolean {
  return userRoleIds?.includes(ROLE_IDS.ADMIN) ?? false;
}

/**
 * ✅ Check if user is supporter by role ID  
 */
export function isSupporterByRoleId(userRoleIds: RoleId[]): boolean {
  return userRoleIds?.includes(ROLE_IDS.SUPPORTER) ?? false;
}

/**
 * ✅ Check if user is regular user by role ID
 */
export function isUserByRoleId(userRoleIds: RoleId[]): boolean {
  return userRoleIds?.includes(ROLE_IDS.USER) ?? false;
}

/**
 * ✅ Get safe fallback permissions for user
 */
export function getSafeFallbackPermissions(): number[] {
  return [
    permissionEnum.CREATE_TICKET,     // 1
    permissionEnum.TRACK_TICKET,      // 2
    permissionEnum.VIEW_OWN_TICKETS,  // 12
    permissionEnum.SATISFACTION       // 14
  ];
}

/**
 * ✅ Get safe fallback roles for user
 */
export function getSafeFallbackRoles(): UserRole[] {
  return [ROLES.USER];
}

// ===== Utility Functions (no changes needed) =====

export function enumToNumber(permission: permissionEnum): number {
  return permission as number;
}

export function numberToEnum(num: number): permissionEnum | null {
  return Object.values(permissionEnum).includes(num) ? (num as permissionEnum) : null;
}

export function isValidPermissionNumber(num: number): boolean {
  return Object.values(permissionEnum).includes(num);
}

// ===== Permission Name Functions (no changes needed) =====

export function getPermissionName(permission: number | permissionEnum): string {
  const permissionNumber = typeof permission === 'number' ? permission : enumToNumber(permission);
  
  const permissionNames: Record<number, string> = {
    1: 'Create Ticket', 2: 'Track Ticket', 3: 'Edit Ticket', 4: 'Delete Ticket',
    5: 'Change Status', 6: 'Reply Ticket', 7: 'Close Ticket', 8: 'Solve Problem',
    9: 'Assign Ticket', 10: 'Manage Project', 11: 'Restore Ticket', 12: 'View Own Tickets',
    13: 'View All Tickets', 14: 'Rate Satisfaction', 15: 'Add User', 16: 'Delete User',
    17: 'Manage Category', 18: 'Manage Status', 19: 'View Dashboard', 20: 'Manage Customer'
  };
  
  return permissionNames[permissionNumber] || `Permission ${permissionNumber}`;
}

export function getPermissionNameTh(permission: number | permissionEnum): string {
  const permissionNumber = typeof permission === 'number' ? permission : enumToNumber(permission);
  
  const permissionNamesTh: Record<number, string> = {
    1: 'แจ้งปัญหา', 2: 'ติดตามปัญหา', 3: 'แก้ไข ticket', 4: 'ลบ ticket',
    5: 'เปลี่ยนสถานะของ ticket', 6: 'ตอบกลับ ticket', 7: 'ปิด ticket', 8: 'แก้ไขปัญหา',
    9: 'ผู้รับเรื่อง', 10: 'จัดการ project', 11: 'กู้คืน ticket', 12: 'ดูรายงานตั๋วของตัวเอง',
    13: 'ดูรายงานทั้งหมด', 14: 'ให้คะแนนความพึงพอใจ', 15: 'เพิ่มผู้ใช้', 16: 'ลบผู้ใช้',
    17: 'จัดการ category', 18: 'จัดการ status', 19: 'มอนเทอริ่ง', 20: 'จัดการ customer'
  };
  
  return permissionNamesTh[permissionNumber] || `สิทธิ์ ${permissionNumber}`;
}

// ===== Permission Check Functions (no changes needed) =====
export interface PermissionCheck {
  hasPermission: boolean;
  missingPermissions: number[];
  userPermissions: number[];
}

export interface RoleCheck {
  hasRole: boolean;
  missingRoles: UserRole[];
  userRoles: UserRole[];
}

export interface AccessControl {
  canAccess: boolean;
  reason?: string;
  requiredPermissions?: number[];
  requiredRoles?: UserRole[];
}

export function checkUserPermission(
  userPermissions: number[], 
  requiredPermissions: number[]
): PermissionCheck {
  const safeUserPermissions = userPermissions || EMPTY_PERMISSIONS;
  const missingPermissions = requiredPermissions.filter(
    permission => !safeUserPermissions.includes(permission)
  );
  
  return {
    hasPermission: missingPermissions.length === 0,
    missingPermissions,
    userPermissions: safeUserPermissions
  };
}

export function checkUserRole(
  userRoles: UserRole[], 
  requiredRoles: UserRole[]
): RoleCheck {
  const safeUserRoles = userRoles || EMPTY_ROLES;
  const missingRoles = requiredRoles.filter(
    role => !safeUserRoles.includes(role)
  );
  
  return {
    hasRole: missingRoles.length === 0,
    missingRoles,
    userRoles: safeUserRoles
  };
}

export function checkAccess(
  userPermissions: number[],
  userRoles: UserRole[],
  requiredPermissions?: number[],
  requiredRoles?: UserRole[]
): AccessControl {
  if (!requiredPermissions?.length && !requiredRoles?.length) {
    return { canAccess: true };
  }
  
  let hasRequiredPermissions = true;
  let hasRequiredRoles = true;
  let reason = '';
  
  if (requiredPermissions?.length) {
    const permissionCheck = checkUserPermission(userPermissions, requiredPermissions);
    hasRequiredPermissions = permissionCheck.hasPermission;
    
    if (!hasRequiredPermissions) {
      const missingNames = permissionCheck.missingPermissions
        .map(p => getPermissionName(p))
        .join(', ');
      reason += `Missing permissions: ${missingNames}. `;
    }
  }
  
  if (requiredRoles?.length) {
    const roleCheck = checkUserRole(userRoles, requiredRoles);
    hasRequiredRoles = roleCheck.hasRole;
    
    if (!hasRequiredRoles) {
      const missingRoles = roleCheck.missingRoles.join(', ');
      reason += `Missing roles: ${missingRoles}. `;
    }
  }
  
  const canAccess = hasRequiredPermissions && hasRequiredRoles;
  
  return {
    canAccess,
    reason: canAccess ? undefined : reason.trim(),
    requiredPermissions,
    requiredRoles
  };
}

// ===== Common Permission Groups (no changes needed) =====
export const PERMISSION_GROUPS = {
  TICKET_MANAGEMENT: [1, 3, 4, 12],
  TICKET_ADMINISTRATION: [13, 5, 9, 7, 11],
  USER_MANAGEMENT: [15, 16],
  SUPPORT_OPERATIONS: [6, 8, 2],
  SYSTEM_ADMINISTRATION: [17, 18, 10, 19],
  CUSTOMER_MANAGEMENT: [20],
  SATISFACTION: [14]
} as const;

// ===== Type Guards =====
export function isValidPermission(value: any): value is permissionEnum {
  return Object.values(permissionEnum).includes(value);
}

export function isValidRole(value: any): value is UserRole {
  return Object.values(ROLES).includes(value);
}

export function isValidRoleId(value: any): value is RoleId {
  return Object.values(ROLE_IDS).includes(value);
}

// ===== Export Role Information for Easy Access =====
export const ROLE_INFO = {
  IDS: ROLE_IDS,
  NAMES: ROLES,
  ID_TO_NAME: ROLE_ID_TO_NAME,
  NAME_TO_ID: ROLE_NAME_TO_ID,
  ID_PERMISSIONS: ROLE_ID_PERMISSIONS,
  NAME_PERMISSIONS: ROLE_PERMISSIONS
} as const;