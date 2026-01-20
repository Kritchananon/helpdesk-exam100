// ✅ Import permission-related types with Role ID support
import {
  permissionEnum,
  UserRole,
  RoleId,
  ROLES,
  ROLE_IDS,
  ROLE_ID_TO_NAME,
  ROLE_NAME_TO_ID,
  convertRoleIdsToNames,
  convertRoleNamesToIds
} from './permission.model';

// ===== User Interface =====
export interface User {
  id: number;
  username: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  start_date?: string;
  end_date?: string;
  create_date?: string;
  create_by?: number;
  update_date?: string;
  update_by?: number;
  isenabled?: boolean;

  companyAddress?: string;
  project?: string;
  // ✅ เพิ่ม role และ permission fields with Role ID support
  roles?: UserRole[];
  role_ids?: RoleId[]; // ✅ NEW: Support for role IDs from backend
  permissions?: permissionEnum[];
}

// ===== NEW: Create User DTO ===== ✅
export interface CreateUserDto {
  username: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  start_date?: string;
  end_date?: string;
  create_by?: number;
  update_by?: number;
  isenabled?: boolean;
  // สำหรับรหัสผ่าน (ถ้า backend ต้องการ)
  password?: string;
  // ✅ UPDATED: Support both role names and IDs
  roles?: UserRole[];
  role_ids?: RoleId[];
}

// ===== NEW: Create User Response ===== ✅
export interface CreateUserResponse {
  code: number;
  status: boolean;
  message: string;
  data?: {
    id: number;
    username: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    start_date?: string;
    end_date?: string;
    create_date?: string;
    create_by?: number;
    update_date?: string;
    update_by?: number;
    isenabled?: boolean;
    // ✅ UPDATED: Include role data in response
    roles?: UserRole[];
    role_ids?: RoleId[];
  };
}

// ===== NEW: User Account Response ===== ✅
export interface UserAccountResponse {
  code: number;
  status: boolean;
  message: string;
  data?: User[];
}

// ===== NEW: User Account Item ===== ✅
export interface UserAccountItem {
  id: number;
  username: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  start_date?: string;
  end_date?: string;
  create_date?: string;
  create_by?: number;
  update_date?: string;
  update_by?: number;
  isenabled?: boolean;
  last_login?: string;
  full_name?: string; // computed field
  avatar?: string; // computed field
  avatarColor?: string; // computed field
  company?: string; // ถ้ามีข้อมูล company
  company_address?: string;
  // ✅ UPDATED: Include role data
  roles?: UserRole[];
  role_ids?: RoleId[];
}

// ===== Login Request Interface =====
export interface LoginRequest {
  username: string;
  password: string;
}

// ===== ✅ UPDATED: Backend Login Response Interface (รองรับ Role IDs) =====
export interface LoginResponse {
  code: number;                    // 1 = success, 0 = error
  status: boolean;                 // true = success, false = error
  message: string;                 // ข้อความแจ้งผลลัพธ์
  user: {                         // ข้อมูลผู้ใช้
    id: number;
    username: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    roles?: UserRole[];           // ✅ เพิ่ม roles ใน response
    role_ids?: RoleId[];          // ✅ NEW: Support role IDs from backend
  } | null;
  access_token: string | null;     // JWT token
  expires_in?: string;             // เช่น "3h"
  expires_at?: string;             // ISO string
  token_expires_timestamp?: number; // Unix timestamp
  permission?: permissionEnum[];   // ✅ ปรับเป็น permissionEnum[] แทน string[]
  roles?: UserRole[];              // ✅ เพิ่ม roles ใน response (top level)
  role_ids?: RoleId[];             // ✅ NEW: Support role IDs in response (top level)
}

// ===== Token Data Interface =====
export interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in?: string;
  expires_at?: string;
  token_expires_timestamp?: number;
}

// ===== User Permission Interface =====
export interface UserPermission {
  id: number;
  name: string;
  code: string;
  description?: string;
  module?: string;
}

// ===== ✅ UPDATED: Enhanced User Interface (กับ permissions และ roles + Role IDs) =====
export interface UserWithPermissions extends User {
  permissions: permissionEnum[];   // ✅ ใช้ permissionEnum แทน UserPermission[]
  roles: UserRole[];               // ✅ ใช้ UserRole แทน string[]
  role_ids?: RoleId[];             // ✅ NEW: Include role IDs
  last_login?: string;
  login_count?: number;
  effective_permissions?: permissionEnum[]; // ✅ permissions ที่ได้จาก roles
}

// ===== Login Form Data Interface =====
export interface LoginFormData {
  username: string;
  password: string;
  rememberMe: boolean;
}

// ===== ✅ UPDATED: Enhanced Auth State Interface (รองรับ Role IDs) =====
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  permissions: permissionEnum[];   // ✅ ปรับเป็น permissionEnum[]
  roles: UserRole[];               // ✅ เพิ่ม roles
  role_ids?: RoleId[];             // ✅ NEW: เพิ่ม role IDs
  expires_at: Date | null;
  last_activity: Date | null;
  // ✅ เพิ่มข้อมูลเกี่ยวกับ role และ permission
  role_permissions?: Record<UserRole, permissionEnum[]>;
  effective_permissions?: permissionEnum[];
}

// ===== Session Info Interface =====
export interface SessionInfo {
  user_id: number;
  username: string;
  login_time: string;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
  permissions: permissionEnum[];   // ✅ ปรับเป็น permissionEnum[]
  roles: UserRole[];               // ✅ เพิ่ม roles
  role_ids?: RoleId[];             // ✅ NEW: เพิ่ม role IDs
}

// ===== Error Response Interface =====
export interface AuthErrorResponse {
  code: number;
  status: boolean;
  message: string;
  user: null;
  access_token: null;
  errors?: {
    [key: string]: string[];
  };
}

// ===== ✅ UPDATED: Role Management Interfaces with Role ID support =====
export interface RoleAssignment {
  user_id: number;
  role: UserRole;
  role_id?: RoleId;                // ✅ NEW: Include role ID
  assigned_by: number;
  assigned_at: string;
  is_active: boolean;
}

export interface RolePermissionMapping {
  role: UserRole;
  role_id: RoleId;                 // ✅ NEW: Include role ID
  permissions: permissionEnum[];
  description?: string;
  is_system_role: boolean;
}

export interface UserRoleInfo {
  roles: UserRole[];
  role_ids: RoleId[];              // ✅ NEW: Include role IDs
  primary_role?: UserRole;
  primary_role_id?: RoleId;        // ✅ NEW: Include primary role ID
  permissions: permissionEnum[];
  role_assignments: RoleAssignment[];
}

// ✅ NEW: Interfaces สำหรับ Assign Ticket API =====
export interface AssignTicketRequest {
  assignedTo: number;
}

export interface AssignTicketResponse {
  message: string;
  ticket_no: string;
  assigned_to: number;
}

export interface AssignTicketPayload {
  ticketNo: string,
  assignTo: number
}

// ✅ NEW: Interfaces สำหรับ Role 9 Users API =====
export interface Role9User {
  id: number;
  name: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  role_id?: RoleId;                // ✅ NEW: Include role ID
}

export interface Role9UsersResponse {
  users: Role9User[];
}

// ✅ NEW: Generic User List Item (สำหรับ dropdown) =====
export interface UserListItem {
  id: number;
  username: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  isenabled: boolean;
  full_name?: string; // computed field
  roles?: UserRole[];              // ✅ NEW: Include roles
  role_ids?: RoleId[];             // ✅ NEW: Include role IDs
}

export interface UserListResponse {
  code: number;
  message: string;
  data: UserListItem[];
}

// ===== ✅ UPDATED: Utility Functions with Role ID Support =====

export function createEmptyAuthState(): AuthState {
  return {
    isAuthenticated: false,
    isLoading: false,
    user: null,
    token: null,
    permissions: [],
    roles: [],                     // ✅ เพิ่ม roles
    role_ids: [],                  // ✅ NEW: เพิ่ม role IDs
    expires_at: null,
    last_activity: null,
    effective_permissions: []      // ✅ เพิ่ม effective_permissions
  };
}

export function createLoginFormData(): LoginFormData {
  return {
    username: '',
    password: '',
    rememberMe: false
  };
}

// ===== ✅ UPDATED: Create User Utility Functions with Role ID Support =====

/**
 * ✅ UPDATED: สร้าง CreateUserDto ที่ว่างเปล่า
 */
export function createEmptyCreateUserDto(): CreateUserDto {
  return {
    username: '',
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    start_date: '',
    end_date: '',
    isenabled: true,
    password: '',
    roles: [],
    role_ids: []                   // ✅ NEW: เพิ่ม role IDs
  };
}

/**
 * ✅ UPDATED: สร้าง UserAccountItem จาก User data
 */
export function createUserAccountItem(user: User): UserAccountItem {
  return {
    ...user,
    full_name: getUserFullName(user),
    avatar: getUserInitials(user),
    avatarColor: generateAvatarColor(user.id),
    last_login: user.update_date || user.create_date || new Date().toISOString(),
    roles: user.roles || [],       // ✅ Include roles
    role_ids: user.role_ids || []  // ✅ NEW: Include role IDs
  };
}

/**
 * สร้างสี avatar แบบสุ่มตาม user ID
 */
export function generateAvatarColor(userId: number): string {
  const colors = [
    '#5873F8', '#28A745', '#FFC107', '#1FBCD5',
    '#DC3545', '#6F42C1', '#FD7E14', '#20C997'
  ];
  return colors[userId % colors.length];
}

/**
 * ✅ UPDATED: แปลง UserAccountItem เป็น CreateUserDto สำหรับการแก้ไข
 */
export function userAccountItemToCreateUserDto(item: UserAccountItem): CreateUserDto {
  return {
    username: item.username,
    firstname: item.firstname,
    lastname: item.lastname,
    email: item.email,
    phone: item.phone,
    start_date: item.start_date,
    end_date: item.end_date,
    isenabled: item.isenabled,
    update_by: item.update_by,
    roles: item.roles || [],       // ✅ Include roles
    role_ids: item.role_ids || []  // ✅ NEW: Include role IDs
  };
}

/**
 * ✅ UPDATED: ตรวจสอบว่าข้อมูล CreateUserDto ถูกต้องหรือไม่
 */
export function validateCreateUserDto(dto: CreateUserDto): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!dto.username || dto.username.trim().length === 0) {
    errors.push('Username is required');
  }

  if (dto.username && dto.username.length < 3) {
    errors.push('Username must be at least 3 characters');
  }

  if (dto.email && !isValidEmail(dto.email)) {
    errors.push('Invalid email format');
  }

  if (dto.phone && !isValidPhone(dto.phone)) {
    errors.push('Invalid phone number format');
  }

  // ✅ NEW: Validate role consistency
  if (dto.roles && dto.role_ids) {
    const expectedRoleIds = convertRoleNamesToIds(dto.roles);
    const roleIdConsistency = JSON.stringify(dto.role_ids.sort()) === JSON.stringify(expectedRoleIds.sort());

    if (!roleIdConsistency) {
      errors.push('Role names and role IDs are inconsistent');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * ตรวจสอบรูปแบบอีเมล
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * ตรวจสอบรูปแบบเบอร์โทรศัพท์
 */
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[0-9]{9,10}$/;
  return phoneRegex.test(phone.replace(/[-\s]/g, ''));
}

// ===== Login Response Validation Functions =====

export function isLoginSuccessResponse(response: LoginResponse): boolean {
  return response.code === 1 &&
    response.status === true &&
    !!response.access_token &&
    !!response.user;
}

export function extractTokenData(response: LoginResponse): TokenData | null {
  if (!isLoginSuccessResponse(response)) {
    return null;
  }

  return {
    access_token: response.access_token!,
    expires_in: response.expires_in,
    expires_at: response.expires_at,
    token_expires_timestamp: response.token_expires_timestamp
  };
}

export function extractUserData(response: LoginResponse): UserWithPermissions | null {
  if (!isLoginSuccessResponse(response) || !response.user) {
    return null;
  }

  // ✅ UPDATED: Extract role data with ID support
  const roles = response.roles || response.user.roles || [];
  const roleIds = response.role_ids || response.user.role_ids || [];
  const permissions = response.permission || [];

  return {
    id: response.user.id,
    username: response.user.username,
    firstname: response.user.firstname,
    lastname: response.user.lastname,
    email: response.user.email,
    isenabled: true,
    // ✅ เพิ่มข้อมูล permissions และ roles with Role ID support
    permissions,
    roles,
    role_ids: roleIds,             // ✅ NEW: Include role IDs
    effective_permissions: permissions
  };
}

// ===== ✅ UPDATED: Enhanced Utility Functions with Role ID Support =====

/**
 * ✅ UPDATED: สร้าง UserWithPermissions จาก User และ permissions/roles
 */
export function createUserWithPermissions(
  user: User,
  permissions: permissionEnum[] = [],
  roles: UserRole[] = [],
  roleIds: RoleId[] = []           // ✅ NEW: Add role IDs parameter
): UserWithPermissions {
  return {
    ...user,
    permissions,
    roles,
    role_ids: roleIds,             // ✅ NEW: Include role IDs
    effective_permissions: permissions
  };
}

/**
 * ✅ UPDATED: ตรวจสอบว่า user มี role หรือไม่ (รองรับ role ID)
 */
export function userHasRole(user: User | UserWithPermissions | null, role: UserRole): boolean {
  if (!user || !('roles' in user)) return false;

  // Check by role name
  if (user.roles?.includes(role)) return true;

  // ✅ NEW: Check by role ID if available
  if ('role_ids' in user && user.role_ids) {
    const roleId = ROLE_NAME_TO_ID[role];
    return user.role_ids.includes(roleId);
  }

  return false;
}

/**
 * ✅ NEW: ตรวจสอบว่า user มี role ID หรือไม่
 */
export function userHasRoleId(user: User | UserWithPermissions | null, roleId: RoleId): boolean {
  if (!user) return false;

  // Check by role ID directly
  if ('role_ids' in user && user.role_ids?.includes(roleId)) return true;

  // Check by converting role name to ID
  if ('roles' in user && user.roles) {
    const roleName = ROLE_ID_TO_NAME[roleId];
    return user.roles.includes(roleName);
  }

  return false;
}

/**
 * ✅ UPDATED: ตรวจสอบว่า user มี permission หรือไม่
 */
export function userHasPermission(user: User | UserWithPermissions | null, permission: permissionEnum): boolean {
  if (!user || !('permissions' in user)) return false;
  return user.permissions?.includes(permission) || false;
}

/**
 * ✅ UPDATED: ตรวจสอบว่า user มี role ใดๆ ใน list หรือไม่ (รองรับ role ID)
 */
export function userHasAnyRole(user: User | UserWithPermissions | null, roles: UserRole[]): boolean {
  if (!user || !('roles' in user) || !user.roles) return false;

  // Check by role names
  if (roles.some(role => user.roles!.includes(role))) return true;

  // ✅ NEW: Check by role IDs if available
  if ('role_ids' in user && user.role_ids) {
    const roleIds = convertRoleNamesToIds(roles);
    return roleIds.some(roleId => user.role_ids!.includes(roleId));
  }

  return false;
}

/**
 * ✅ NEW: ตรวจสอบว่า user มี role ID ใดๆ ใน list หรือไม่
 */
export function userHasAnyRoleId(user: User | UserWithPermissions | null, roleIds: RoleId[]): boolean {
  if (!user) return false;

  // Check by role IDs directly
  if ('role_ids' in user && user.role_ids) {
    return roleIds.some(roleId => user.role_ids!.includes(roleId));
  }

  // Check by converting role IDs to names
  if ('roles' in user && user.roles) {
    const roleNames = convertRoleIdsToNames(roleIds);
    return roleNames.some(roleName => user.roles!.includes(roleName));
  }

  return false;
}

/**
 * ✅ UPDATED: ตรวจสอบว่า user มี permission ใดๆ ใน list หรือไม่
 */
export function userHasAnyPermission(user: User | UserWithPermissions | null, permissions: permissionEnum[]): boolean {
  if (!user || !('permissions' in user) || !user.permissions) return false;
  return permissions.some(permission => user.permissions!.includes(permission));
}

/**
 * ✅ UPDATED: ดึงชื่อเต็มของ user (รองรับ role-based naming)
 */
export function getUserFullName(user: User | UserListItem | Role9User | UserAccountItem | null): string {
  if (!user) return '';

  // Check for UserAccountItem with full_name
  if ('full_name' in user && user.full_name) {
    return user.full_name;
  }

  // Check for Role9User with name field
  if ('name' in user && user.name) {
    return user.name;
  }

  // Standard User interface
  const firstName = user.firstname || '';
  const lastName = user.lastname || '';

  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }

  return user.username || 'User';
}

/**
 * ✅ UPDATED: ดึงชื่อย่อของ user
 */
export function getUserInitials(user: User | UserAccountItem | null): string {
  if (!user) return 'U';

  const firstName = user.firstname || '';
  const lastName = user.lastname || '';

  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }

  const username = user.username || 'User';
  return username.charAt(0).toUpperCase();
}

/**
 * ✅ UPDATED: สร้าง auth state จาก login response (รองรับ Role ID)
 */
export function createAuthStateFromLoginResponse(
  response: LoginResponse,
  user: UserWithPermissions,
  token: string
): AuthState {
  return {
    isAuthenticated: true,
    isLoading: false,
    user: user,
    token: token,
    permissions: user.permissions,
    roles: user.roles,
    role_ids: user.role_ids || [], // ✅ NEW: Include role IDs
    expires_at: response.expires_at ? new Date(response.expires_at) : null,
    last_activity: new Date(),
    effective_permissions: user.effective_permissions
  };
}

// ===== ✅ UPDATED: Type Guards with Role ID Support =====

export function isUser(obj: any): obj is User {
  return obj &&
    typeof obj.id === 'number' &&
    typeof obj.username === 'string';
}

export function isUserWithPermissions(obj: any): obj is UserWithPermissions {
  return isUser(obj) &&
    Array.isArray(obj.permissions) &&
    Array.isArray(obj.roles);
}

export function isLoginResponse(obj: any): obj is LoginResponse {
  return obj &&
    typeof obj.code === 'number' &&
    typeof obj.status === 'boolean' &&
    typeof obj.message === 'string';
}

export function isTokenData(obj: any): obj is TokenData {
  return obj &&
    typeof obj.access_token === 'string';
}

export function isValidAuthState(obj: any): obj is AuthState {
  return obj &&
    typeof obj.isAuthenticated === 'boolean' &&
    Array.isArray(obj.permissions) &&
    Array.isArray(obj.roles);
}

export function isCreateUserDto(obj: any): obj is CreateUserDto {
  return obj &&
    typeof obj.username === 'string';
}

export function isUserAccountItem(obj: any): obj is UserAccountItem {
  return obj &&
    typeof obj.id === 'number' &&
    typeof obj.username === 'string' &&
    typeof obj.isenabled === 'boolean';
}

// ✅ NEW: Role ID Type Guards
export function isValidRoleId(obj: any): obj is RoleId {
  const validIds: number[] = [1, 8, 15]; // USER, SUPPORTER, ADMIN
  return typeof obj === 'number' && validIds.includes(obj);
}

export function hasRoleIds(obj: any): obj is { role_ids: RoleId[] } {
  return obj && Array.isArray(obj.role_ids) && obj.role_ids.every(isValidRoleId);
}

// ===== Constants =====
export const LOGIN_SUCCESS_CODE = 1;
export const LOGIN_ERROR_CODE = 0;

// ✅ เก็บ permission constants ไว้เพื่อ backward compatibility
export const PERMISSION_CODES = {
  TICKET_CREATE: 'ticket.create',
  TICKET_READ: 'ticket.read',
  TICKET_UPDATE: 'ticket.update',
  TICKET_DELETE: 'ticket.delete',
  USER_MANAGE: 'user.manage',
  SETTINGS_ACCESS: 'settings.access'
} as const;

export type PermissionCode = typeof PERMISSION_CODES[keyof typeof PERMISSION_CODES];

// ===== ✅ UPDATED: Default Roles and Permissions with Role ID Support =====
export const DEFAULT_USER_ROLES: UserRole[] = [ROLES.USER];
export const DEFAULT_USER_ROLE_IDS: RoleId[] = [ROLE_IDS.USER]; // ✅ NEW
export const DEFAULT_USER_PERMISSIONS: permissionEnum[] = [
  permissionEnum.CREATE_TICKET,
  permissionEnum.VIEW_OWN_TICKETS,
  permissionEnum.TRACK_TICKET
];

// ===== ✅ UPDATED: Auth State Helpers with Role ID Support =====
export class AuthStateHelper {
  static hasRole(state: AuthState, role: UserRole): boolean {
    return state.roles.includes(role);
  }

  static hasAnyRole(state: AuthState, roles: UserRole[]): boolean {
    return roles.some(role => state.roles.includes(role));
  }

  static hasAllRoles(state: AuthState, roles: UserRole[]): boolean {
    return roles.every(role => state.roles.includes(role));
  }

  // ✅ NEW: Role ID methods
  static hasRoleId(state: AuthState, roleId: RoleId): boolean {
    return state.role_ids?.includes(roleId) || false;
  }

  static hasAnyRoleId(state: AuthState, roleIds: RoleId[]): boolean {
    if (!state.role_ids) return false;
    return roleIds.some(roleId => state.role_ids!.includes(roleId));
  }

  static hasAllRoleIds(state: AuthState, roleIds: RoleId[]): boolean {
    if (!state.role_ids) return false;
    return roleIds.every(roleId => state.role_ids!.includes(roleId));
  }

  static hasPermission(state: AuthState, permission: permissionEnum): boolean {
    return state.permissions.includes(permission) ||
      (state.effective_permissions?.includes(permission) || false);
  }

  static hasAnyPermission(state: AuthState, permissions: permissionEnum[]): boolean {
    return permissions.some(permission => this.hasPermission(state, permission));
  }

  static hasAllPermissions(state: AuthState, permissions: permissionEnum[]): boolean {
    return permissions.every(permission => this.hasPermission(state, permission));
  }

  // ✅ UPDATED: Role checking with Role ID support
  static isAdmin(state: AuthState): boolean {
    return this.hasRole(state, ROLES.ADMIN) || this.hasRoleId(state, ROLE_IDS.ADMIN);
  }

  static isSupporter(state: AuthState): boolean {
    return this.hasRole(state, ROLES.SUPPORTER) || this.hasRoleId(state, ROLE_IDS.SUPPORTER);
  }

  static isUser(state: AuthState): boolean {
    return this.hasRole(state, ROLES.USER) || this.hasRoleId(state, ROLE_IDS.USER);
  }

  static canManageUsers(state: AuthState): boolean {
    return this.hasPermission(state, permissionEnum.ADD_USER) ||
      this.hasPermission(state, permissionEnum.DEL_USER);
  }

  static canManageTickets(state: AuthState): boolean {
    return this.hasPermission(state, permissionEnum.VIEW_ALL_TICKETS) ||
      this.hasPermission(state, permissionEnum.CHANGE_STATUS);
  }

  // ✅ UPDATED: Get primary role with Role ID support
  static getPrimaryRole(state: AuthState): UserRole | undefined {  // เปลี่ยน return type
    if (this.isAdmin(state)) return ROLES.ADMIN;
    if (this.isSupporter(state)) return ROLES.SUPPORTER;
    if (this.isUser(state)) return ROLES.USER;
    return undefined; // เปลี่ยนจาก null เป็น undefined
  }

  // ✅ NEW: Get primary role ID
  static getPrimaryRoleId(state: AuthState): RoleId | undefined {  // เปลี่ยน return type
    if (this.hasRoleId(state, ROLE_IDS.ADMIN)) return ROLE_IDS.ADMIN;
    if (this.hasRoleId(state, ROLE_IDS.SUPPORTER)) return ROLE_IDS.SUPPORTER;
    if (this.hasRoleId(state, ROLE_IDS.USER)) return ROLE_IDS.USER;
    return undefined; // เปลี่ยนจาก null เป็น undefined
  }

  // ✅ NEW: Role consistency validation
  static validateRoleConsistency(state: AuthState): {
    isConsistent: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (state.roles.length !== (state.role_ids?.length || 0)) {
      issues.push('Role count mismatch between names and IDs');
    }

    if (state.role_ids) {
      const expectedRoleIds = convertRoleNamesToIds(state.roles);
      const actualRoleIds = state.role_ids.sort();
      const expectedSorted = expectedRoleIds.sort();

      if (JSON.stringify(actualRoleIds) !== JSON.stringify(expectedSorted)) {
        issues.push('Role IDs do not match role names');
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues
    };
  }

  // ✅ NEW: Get user role information
  static getUserRoleInfo(state: AuthState): UserRoleInfo {
    return {
      roles: state.roles,
      role_ids: state.role_ids || [],
      primary_role: this.getPrimaryRole(state),     // ไม่ต้อง || undefined เพราะเป็น optional
      primary_role_id: this.getPrimaryRoleId(state), // ไม่ต้อง || undefined เพราะเป็น optional
      permissions: state.permissions,
      role_assignments: []
    };
  }
}

// ===== ✅ NEW: Role ID Utility Functions =====

/**
 * ✅ NEW: Get user display name with role indicator
 */
export function getUserDisplayName(user: User | UserWithPermissions, includeRole: boolean = false): string {
  const fullName = getUserFullName(user);

  if (!includeRole || !('roles' in user) || !user.roles?.length) {
    return fullName;
  }

  // Get primary role for display
  const primaryRole = user.roles.includes(ROLES.ADMIN) ? 'Admin' :
    user.roles.includes(ROLES.SUPPORTER) ? 'Support' :
      user.roles.includes(ROLES.USER) ? 'User' : '';

  return primaryRole ? `${fullName} (${primaryRole})` : fullName;
}

/**
 * ✅ NEW: Check if user can access specific feature
 */
export function canUserAccessFeature(
  user: User | UserWithPermissions | null,
  feature: 'tickets' | 'users' | 'reports' | 'settings' | 'dashboard'
): boolean {
  if (!user || !('permissions' in user)) return false;

  const permissions = user.permissions || [];

  switch (feature) {
    case 'tickets':
      return permissions.some(p => [1, 12, 13].includes(p)); // CREATE_TICKET, VIEW_OWN_TICKETS, VIEW_ALL_TICKETS
    case 'users':
      return permissions.some(p => [15, 16].includes(p)); // ADD_USER, DEL_USER
    case 'reports':
      return permissions.some(p => [12, 13].includes(p)); // VIEW_OWN_TICKETS, VIEW_ALL_TICKETS
    case 'settings':
      return permissions.some(p => [17, 18].includes(p)); // MANAGE_CATEGORY, MANAGE_STATUS
    case 'dashboard':
      return permissions.includes(19); // VIEW_DASHBOARD
    default:
      return false;
  }
}

/**
 * ✅ NEW: Get user role badge info for UI
 */
export function getUserRoleBadge(user: User | UserWithPermissions | null): {
  text: string;
  color: string;
  icon?: string;
} | null {
  if (!user || !('roles' in user) || !user.roles?.length) {
    return null;
  }

  if (user.roles.includes(ROLES.ADMIN)) {
    return {
      text: 'Admin',
      color: 'red',
      icon: '👑'
    };
  }

  if (user.roles.includes(ROLES.SUPPORTER)) {
    return {
      text: 'Support',
      color: 'blue',
      icon: '🛠️'
    };
  }

  if (user.roles.includes(ROLES.USER)) {
    return {
      text: 'User',
      color: 'green',
      icon: '👤'
    };
  }

  return null;
}

/**
 * ✅ NEW: Sync role IDs with role names
 */
export function syncUserRoles(user: UserWithPermissions): UserWithPermissions {
  const updatedUser = { ...user };

  // If we have role names but no role IDs, convert them
  if (user.roles?.length && (!user.role_ids || user.role_ids.length === 0)) {
    updatedUser.role_ids = convertRoleNamesToIds(user.roles);
  }

  // If we have role IDs but no role names, convert them
  if (user.role_ids?.length && (!user.roles || user.roles.length === 0)) {
    updatedUser.roles = convertRoleIdsToNames(user.role_ids);
  }

  return updatedUser;
}

/**
 * ✅ NEW: Create user summary for debug/display purposes
 */
export function createUserSummary(user: User | UserWithPermissions | null): {
  id: number | null;
  username: string;
  fullName: string;
  roles: string[];
  roleIds: number[];
  permissions: number[];
  hasBasicAccess: boolean;
  isAdmin: boolean;
  isSupporter: boolean;
  isUser: boolean;
} {
  if (!user) {
    return {
      id: null,
      username: 'Unknown',
      fullName: 'Unknown User',
      roles: [],
      roleIds: [],
      permissions: [],
      hasBasicAccess: false,
      isAdmin: false,
      isSupporter: false,
      isUser: false
    };
  }

  const roles = ('roles' in user) ? user.roles || [] : [];
  const roleIds = ('role_ids' in user) ? user.role_ids || [] : [];
  const permissions = ('permissions' in user) ? user.permissions || [] : [];

  return {
    id: user.id,
    username: user.username,
    fullName: getUserFullName(user),
    roles,
    roleIds,
    permissions,
    hasBasicAccess: permissions.some(p => [1, 12, 13].includes(p)),
    isAdmin: roles.includes(ROLES.ADMIN) || roleIds.includes(ROLE_IDS.ADMIN),
    isSupporter: roles.includes(ROLES.SUPPORTER) || roleIds.includes(ROLE_IDS.SUPPORTER),
    isUser: roles.includes(ROLES.USER) || roleIds.includes(ROLE_IDS.USER)
  };
}

// ===== ✅ NEW: Debug Functions with Role ID Support =====

/**
 * ✅ NEW: Debug user role information
 */
export function debugUserRoles(user: User | UserWithPermissions | null): void {
  console.group('🔍 User Role Debug');

  if (!user) {
    console.log('❌ No user provided');
    console.groupEnd();
    return;
  }

  const summary = createUserSummary(user);

  console.log('👤 User Info:', {
    id: summary.id,
    username: summary.username,
    fullName: summary.fullName
  });

  console.log('👥 Role Data:', {
    roles: summary.roles,
    roleIds: summary.roleIds,
    roleCount: summary.roles.length,
    roleIdCount: summary.roleIds.length
  });

  console.log('🔍 Permissions:', {
    permissions: summary.permissions,
    permissionCount: summary.permissions.length,
    hasBasicAccess: summary.hasBasicAccess
  });

  console.log('🎯 Role Checks:', {
    isAdmin: summary.isAdmin,
    isSupporter: summary.isSupporter,
    isUser: summary.isUser
  });

  // Check role consistency
  if (summary.roles.length > 0 && summary.roleIds.length > 0) {
    const expectedRoleIds = convertRoleNamesToIds(summary.roles as UserRole[]);
    const isConsistent = JSON.stringify(summary.roleIds.sort()) === JSON.stringify(expectedRoleIds.sort());

    console.log('✅ Role Consistency:', {
      isConsistent,
      expectedRoleIds,
      actualRoleIds: summary.roleIds
    });
  }

  console.groupEnd();
}

/**
 * ✅ NEW: Export all role and permission utilities
 */
export const USER_UTILS = {
  // Role ID functions
  convertRoleIdsToNames,
  convertRoleNamesToIds,
  userHasRoleId,
  userHasAnyRoleId,

  // Enhanced user functions
  getUserDisplayName,
  canUserAccessFeature,
  getUserRoleBadge,
  syncUserRoles,
  createUserSummary,
  debugUserRoles,

  // Validation functions
  validateCreateUserDto,
  isValidRoleId,
  hasRoleIds,

  // Constants
  DEFAULT_USER_ROLE_IDS,
  ROLE_IDS,
  ROLE_ID_TO_NAME,
  ROLE_NAME_TO_ID
} as const;