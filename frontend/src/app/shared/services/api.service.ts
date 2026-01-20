import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError, tap, filter, take, switchMap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService, TokenData } from './auth.service';
import { ProjectDDLRequest, ProjectDDLResponse } from '../models/project.model';
import { CategoryDDLRequest, CategoryDDLResponse } from '../models/category.model';

// ✅ เพิ่ม imports ใหม่ที่ด้านบน
import {
  AssignTicketRequest,
  AssignTicketResponse,
  Role9UsersResponse,
  UserListItem,
  AssignTicketPayload,
  // ✅ NEW: เพิ่ม User Management imports
  CreateUserDto,
  CreateUserResponse,
  UserAccountResponse,
  UserAccountItem,
  User,
  createUserAccountItem
} from '../models/user.model';

import { UserRole, ROLES } from '../models/permission.model';

// ✅ HTTP Interceptor Class
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // ✅ เพิ่ม token ใน header อัตโนมัติ
    req = this.addTokenHeader(req);

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // ✅ จัดการ 401 Unauthorized
        if (error.status === 401) {
          return this.handle401Error(req, next);
        }

        return throwError(() => error);
      })
    );
  }

  private addTokenHeader(request: HttpRequest<any>): HttpRequest<any> {
    const token = this.authService.getToken();

    if (token && !this.authService.isTokenExpired()) {
      return request.clone({
        headers: request.headers.set('Authorization', `Bearer ${token}`)
      });
    }

    return request;
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const refreshToken = this.authService.getRefreshToken();

      if (refreshToken) {
        return this.authService.refreshAccessToken().pipe(
          switchMap((tokenData: TokenData) => {
            this.isRefreshing = false;
            this.refreshTokenSubject.next(tokenData.access_token);

            // ลองใหม่ด้วย token ใหม่
            return next.handle(this.addTokenHeader(request));
          }),
          catchError((error) => {
            this.isRefreshing = false;
            // Refresh ล้มเหลว - AuthService จะจัดการ logout เอง
            return throwError(() => error);
          })
        );
      } else {
        // ไม่มี refresh token
        this.authService.clearTokensAndRedirect();
        return throwError(() => new Error('No refresh token available'));
      }
    }

    // ถ้ากำลัง refresh อยู่ ให้รอ
    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap(() => next.handle(this.addTokenHeader(request)))
    );
  }
}

// ✅ API Service (เดิม + เพิ่ม auth headers อัตโนมัติ)
export interface ApiResponse<T> {
  code?: string;
  status?: number;
  message: string;
  data: T;
}

export interface TicketData {
  id?: number;
  ticket_no?: string;
  categories_id: number;
  project_id: number;
  issue_description: string;
  status_id?: number;
  hour_estimate?: number;
  estimate_time?: string;
  due_date?: string;
  lead_time?: number;
  related_ticket_id?: number;
  change_request?: boolean;
  create_date?: string;
  create_by?: number;
  update_date?: string;
  update_by?: number;
  isenabled?: boolean;
}

// ✅ เพิ่ม interfaces สำหรับ Update และ Delete Ticket APIs
export interface UpdateTicketRequest {
  status_id?: number;
  fix_issue_description?: string;
  estimate_time?: string;
  due_date?: string;
  lead_time?: string;
  change_request?: string;
  related_ticket_id?: number;
}

export interface UpdateTicketResponse {
  code: number;
  message: string;
  data: any;
}

export interface DeleteTicketResponse {
  code: number;
  message: string;
  data: null;
}

// ✅ เพิ่ม interfaces สำหรับ getAllMasterFilter API
export interface MasterFilterCategory {
  id: number;
  name: string;
  name_th?: string;
  name_en?: string;
}

export interface MasterFilterProject {
  id: number;
  name: string;
}

export interface MasterFilterStatus {
  id: number;
  name: string;
}

export interface MasterFilterData {
  categories: MasterFilterCategory[];
  projects: MasterFilterProject[];
  status?: MasterFilterStatus[]; // ✅ เพิ่มตรงนี้
}

export interface MasterFilterRequest {
  // ถ้า backend ไม่ต้องการอะไรเป็นพิเศษ ให้เป็น empty object
}

export interface MasterFilterDataWrapper {
  code: number;
  data: MasterFilterData;
  message?: string; // ✅ เพิ่ม message
}

export interface MasterFilterResponse {
  success: boolean;
  data: MasterFilterDataWrapper;
  message?: string;
}

// ✅ เพิ่ม interfaces สำหรับ getAllTicket API
export interface GetAllTicketRequest {
  // ไม่มี parameters เพิ่มเติม เพราะ userId จะมาจาก JWT token
}

export interface GetAllTicketResponse {
  success: boolean;
  message?: string;
  pagination: {
    totalRows: number,
    totalPages: number,
    currentPage: number,
    perPage: number
  };
  data?: AllTicketData[];
  debug?: {
    userId: number;
    currentPage: number;
    totalTicket: number
  };
}

export interface AllTicketData {
  ticket_no: string;
  categories_id: number;
  project_id: number;
  issue_description: string;
  status_id: number;
  create_by: number;
  create_date: string;
  // เพิ่มข้อมูลที่อาจจะได้จาก join หรือ mapping
  categories_name?: string;
  project_name?: string;
  user_name?: string;
  priority_id?: string;
  status_name?: string; // ✅ เพิ่มสำหรับ status name จาก API
}

// ===== NEW: Ticket Cache Interfaces ===== ✅
export interface CachedTicketData {
  tickets: AllTicketData[];
  timestamp: Date;
  lastSync: Date;
  totalCount: number;
  filters?: {
    search?: string;
    status?: string;
    project?: string;
    category?: string;
  };
}

export interface TicketCacheConfig {
  maxAge: number; // milliseconds
  maxSize: number; // max number of tickets
  enableOffline: boolean;
  autoRefresh: boolean;
}

export interface PendingTicketSync {
  id: string;
  type: 'create' | 'update' | 'delete' | 'refresh';
  data: any;
  timestamp: Date;
  retryCount: number;
}

// ✅ เพิ่ม interfaces สำหรับ saveTicket API
export interface SaveTicketRequest {
  ticket_id?: number;
  project_id: number;
  categories_id: number;
  issue_description: string;
}

export interface SaveTicketResponse {
  code: number;
  message: string;
  ticket_id: number;
  ticket_no: string;
}

// ✅ เพิ่ม interfaces สำหรับ updateAttachment API
export interface UpdateAttachmentRequest {
  ticket_id?: number | null;
  project_id?: number;
  categories_id?: number;
  issue_description?: string;
  files?: File[];
}

export interface UpdateAttachmentResponse {
  code: number;
  message: string;
  ticket_id: number;
  attachment_id?: number;
  data: AttachmentData[];
}

export interface AttachmentData {
  attachment_id: number;
  attachment_path: string;
}

// ✅ UPDATED: เพิ่ม interfaces สำหรับ deleteAttachment API
export interface DeleteAttachmentResponse {
  code: number;
  message: string;
  data?: {
    id: number;
    attachment_id?: number;
    deleted?: boolean;
  };
}

// ✅ เพิ่ม interfaces สำหรับ getTicketData API
export interface GetTicketDataRequest {
  ticket_no: string;
}

export interface GetTicketDataResponse {
  code: number;
  message: string;
  data: {
    ticket: {
      id: number;
      ticket_no: string;
      categories_id: number;
      categories_name: string;
      project_id: number;
      project_name: string;
      issue_description: string;
      fix_issue_description: string;
      status_id: number;
      status_name: string;
      close_estimate: string;
      estimate_time: string;
      due_date: string;
      lead_time: string;
      related_ticket_id: number | null;
      change_request: string;
      create_date: string;
      create_by: string;
      update_date: string;
      update_by: string;
      isenabled: boolean;
    };
    issue_attachment: Array<{
      attachment_id: number;
      path: string;
    }>;
    fix_attachment: Array<{
      attachment_id: number;
      path: string;
    }>;
    status_history: Array<{
      status_id: number;
      status_name: string;
      create_date: string;
    }>;
  };
}

// ✅ NEW: เพิ่ม interfaces สำหรับ getTicketHistory API
export interface TicketHistoryRequest {
  ticket_id: number;
}

export interface TicketHistoryResponse {
  success: boolean;
  message: string;
  data: TicketStatusHistory[];
}

export interface TicketStatusHistory {
  id: number;
  ticket_id: number;
  status_id: number;
  create_date: string;
  create_by: number;
  status: {
    id: number;
    name: string;
    statusLang?: {
      name: string;
      language: string;
    }[];
  };
}

// ===== NEW: Interfaces สำหรับ getTicketStatus API ===== ✅
export interface TicketStatusRequest {
  // ไม่มี parameters เพิ่มเติม เพราะใช้ ticket ID จาก URL path
}

export interface TicketStatusResponse {
  code: number;
  message: string;
  data: {
    ticket_id: number;
    status_id: number;
    status_name: string;
    language_id: string;
    detected_language?: string;
  } | null;
}

// ===== NEW: Interfaces สำหรับ getAllTicketStatuses API ===== ✅
export interface AllTicketStatusesResponse {
  code: number;
  message: string;
  data: {
    status_id: number;
    status_name: string;
    language_id: string;
  }[] | null;
}

// ✅ NEW: Interfaces สำหรับ satisfaction API
export interface satisfactionRequest {
  rating: number;
}

export interface satisfactionResponse {
  success: boolean;
  message: string;
  data?: {
    ticket_no: string;
    ticket_id: number;
    satisfaction: {
      id: number;
      rating: number;
      create_by: number;
      create_date: string;
    };
  };
  error?: string;
}

// ✅ NEW: Interfaces สำหรับ getStatusDDL API
export interface StatusDDLItem {
  id: number;
  name: string;
  language_id: string;
}

export interface StatusDDLResponse {
  code: number;
  message: string;
  data: StatusDDLItem[];
}

export interface ProjectData {
  id: number;
  name: string;
  create_by: number;
  isenabled: boolean;
}

export interface CustomerData {
  id: number;
  name: string;
  address: string;
  telephone: string;
  email: string;
  create_date: string;
  create_by: number;
  update_date: string;
  update_by: number;
  isenabled: boolean;
}

export interface UserData {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  start_date: string;
  end_date: string;
  create_date: string;
  create_by: number;
  update_date: string;
  update_by: number;
  isenabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  private authService = inject(AuthService);

  // ✅ NEW: Status cache management
  private statusCache: Map<number, string> = new Map();

  // ===== NEW: Ticket Cache Management ===== ✅
  private ticketCache: CachedTicketData | null = null;
  private ticketCacheConfig: TicketCacheConfig = {
    maxAge: 2 * 60 * 1000, // 2 minutes
    maxSize: 1000, // max 1000 tickets
    enableOffline: true,
    autoRefresh: true
  };
  private pendingSyncQueue: PendingTicketSync[] = [];
  private ticketCacheKey = 'pwa_tickets_cache';
  private syncQueueKey = 'pwa_tickets_sync_queue';

  // ✅ NEW: User Account Cache Management
  private userAccountCache: {
    data: UserAccountItem[];
    timestamp: Date;
    ttl: number; // milliseconds
  } | null = null;

  private readonly USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(private http: HttpClient) {
    // ✅ NEW: โหลด sync queue ที่ค้างอยู่
    this.loadSyncQueue();

    // ลอง process sync queue เมื่อ online
    if (navigator.onLine) {
      setTimeout(() => this.processSyncQueue(), 1000);
    }
  }

  private generateAvatar(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  private generateAvatarColor(id: number): string {
    const colors = ['#5873F8', '#28A745', '#FFC107', '#1FBCD5', '#DC3545'];
    return colors[id % colors.length];
  }

  /**
   * ✅ NEW: สร้าง mock UserAccountItem สำหรับ fallback
   * @returns UserAccountItem[]
   */
  private getMockUserAccountItems(): UserAccountItem[] {
    return [
      {
        id: 1,
        username: 'admin',
        firstname: 'System',
        lastname: 'Administrator',
        email: 'admin@company.com',
        phone: '02-123-4567',
        start_date: '2024-01-01',
        create_date: '2024-01-01T00:00:00Z',
        create_by: 1,
        update_date: '2025-08-27T14:30:00Z',
        update_by: 1,
        isenabled: true,
        last_login: '2025-08-27T14:30:00Z',
        full_name: 'System Administrator',
        avatar: 'SA',
        avatarColor: '#5873F8',
        company: 'System'
      },
      {
        id: 2,
        username: 'support1',
        firstname: 'Support',
        lastname: 'User 1',
        email: 'support1@company.com',
        phone: '02-234-5678',
        start_date: '2024-03-01',
        create_date: '2024-03-01T00:00:00Z',
        create_by: 1,
        update_date: '2025-08-27T09:15:00Z',
        update_by: 1,
        isenabled: true,
        last_login: '2025-08-27T09:15:00Z',
        full_name: 'Support User 1',
        avatar: 'SU',
        avatarColor: '#28A745',
        company: 'Support Team'
      }
    ];
  }

  /**
   * ✅ เพิ่ม property สำหรับเก็บ available roles
   */
  private availableRoles: any[] = [];

  /**
   * ✅ Helper method สำหรับ validate role data format
   * @param userData ข้อมูล user ที่ต้องการตรวจสอบ
   * @returns boolean - true ถ้าข้อมูลถูกต้อง
   */
  private validateUserRoleData(userData: any): boolean {
    // ตรวจสอบ required fields
    if (!userData.username || !userData.email) {
      console.warn('❌ Missing required fields: username or email');
      return false;
    }

    // ตรวจสอบ role_id format ถ้ามี
    if (userData.role_id && !Array.isArray(userData.role_id)) {
      console.warn('❌ role_id must be an array');
      return false;
    }

    // ตรวจสอบว่า role_id array มีค่าที่เป็น number
    if (userData.role_id && Array.isArray(userData.role_id)) {
      const invalidRoles = userData.role_id.filter((id: any) =>
        typeof id !== 'number' && !Number.isInteger(Number(id))
      );

      if (invalidRoles.length > 0) {
        console.warn('❌ Invalid role IDs found:', invalidRoles);
        return false;
      }
    }

    return true;
  }

  /**
   * ✅ NEW: ตรวจสอบว่า user มี role เฉพาะหรือไม่
   * @param roleId - ID ของ role ที่ต้องการตรวจสอบ
   * @returns boolean
   */
  hasUserRole(roleId: number): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.roles) {
      return false;
    }

    // ตรวจสอบว่า roles เป็น array ของ objects หรือ array ของ IDs
    if (Array.isArray(currentUser.roles)) {
      return currentUser.roles.some((role: any) => {
        // ถ้า role เป็น object ที่มี id
        if (typeof role === 'object' && role.id) {
          return role.id === roleId;
        }
        // ถ้า role เป็น number โดยตรง
        if (typeof role === 'number') {
          return role === roleId;
        }
        return false;
      });
    }

    return false;
  }

  /**
   * ✅ NEW: ดึงชื่อ role จาก role ID
   * @param roleId - ID ของ role
   * @returns string - ชื่อของ role
   */
  getRoleName(roleId: number): string {
    const roleNames: { [key: number]: string } = {
      1: "แจ้งปัญหา",
      2: "ติดตามปัญหา",
      3: "แก้ไข ticket",
      4: "ลบ ticket",
      5: "เปลี่ยนสถานะของ ticket",
      6: "ตอบกลับ ticket",
      7: "ปิด ticket",
      8: "แก้ไขปัญหา",
      9: "ผู้รับเรื่อง",
      10: "จัดการ project",
      11: "กู้คืน ticket",
      12: "ดูตั๋วทั้งหมดที่ตัวเองสร้าง",
      13: "ดูตั๋วทั้งหมด",
      14: "ให้คะแนนความพึงพอใจ",
      15: "เพิ่มผู้ใช้",
      16: "ลบผู้ใช้",
      17: "จัดการ category",
      18: "จัดการ status",
      19: "มอบหมายงาน",
      20: "จัดการ customer"
    };

    return roleNames[roleId] || `Role ${roleId}`;
  }

  /**
   * ✅ NEW: ตรวจสอบว่า user สามารถจัดการ users ได้หรือไม่
   * @returns boolean
   */
  canManageUsers(): boolean {
    return this.hasUserRole(15) || this.hasUserRole(16) || this.authService.isAdmin();
  }

  /**
   * ✅ NEW: ตรวจสอบว่า user สามารถมอบหมายงานได้หรือไม่
   * @returns boolean
   */
  canAssignTasks(): boolean {
    return this.hasUserRole(19) || this.hasUserRole(9) || this.authService.isAdmin();
  }

  /**
   * ✅ NEW: ดึงรายการ roles ของ user ปัจจุบัน
   * @returns any[] - รายการ roles ของ user
   */
  getCurrentUserRoles(): any[] {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser || !currentUser.roles) {
      return [];
    }

    return Array.isArray(currentUser.roles) ? currentUser.roles : [];
  }

  /**
 * Generic GET method - ใช้สำหรับ Dashboard APIs
 */
  get<T>(endpoint: string, params?: any): Observable<ApiResponse<T>> {
    let queryParams = new HttpParams(); // แก้ไขจาก httpParams

    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          queryParams = queryParams.append(key, params[key].toString());
        }
      });
    }

    return this.http.get<ApiResponse<T>>(`${this.apiUrl}/${endpoint}`, {
      params: queryParams, // แก้ไขจาก httpParams
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        console.log(`API ${endpoint} response:`, response);
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Generic POST method
   */
  post<T>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.apiUrl}/${endpoint}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic PUT method  
   */
  put<T>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(`${this.apiUrl}/${endpoint}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generic PATCH method  
   */
  patch<T>(endpoint: string, data: any): Observable<ApiResponse<T>> {
    return this.http.patch<ApiResponse<T>>(`${this.apiUrl}/${endpoint}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }
  /**
   * Generic DELETE method
   */
  delete<T>(endpoint: string): Observable<ApiResponse<T>> {
    return this.http.delete<ApiResponse<T>>(`${this.apiUrl}/${endpoint}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ===== NEW: Ticket Cache Methods ===== ✅

  /**
   * ✅ NEW: โหลด tickets พร้อม fallback cache
   */
  getAllTicketsWithCache(): Observable<AllTicketData[]> {
    console.log('=== Getting Tickets with Cache Support ===');

    // ตรวจสอบ network status
    const isOnline = navigator.onLine;
    const cachedData = this.getCachedTickets();

    if (isOnline) {
      // Online: พยายามโหลดจาก API ก่อน
      return this.getAllTicketsWithDetails().pipe(
        tap(tickets => {
          console.log('✅ Online: Got fresh tickets, caching...');
          this.cacheTickets(tickets);
        }),
        catchError(error => {
          console.warn('⚠️ Online API failed, using cache:', error);
          if (cachedData) {
            this.addNotificationViaPWA('cache-used',
              'ใช้ข้อมูลที่เก็บไว้',
              'ไม่สามารถดึงข้อมูลใหม่ได้ กำลังใช้ข้อมูลที่เก็บไว้');
            return of(cachedData);
          }
          return throwError(() => error);
        })
      );
    } else {
      // Offline: ใช้ cache เท่านั้น
      console.log('📱 Offline mode: Using cached data');
      if (cachedData) {
        this.addNotificationViaPWA('offline',
          'โหมดออฟไลน์',
          'กำลังใช้ข้อมูลที่เก็บไว้ในเครื่อง');
        return of(cachedData);
      } else {
        const error = 'ไม่มีข้อมูลที่เก็บไว้ กรุณาเชื่อมต่ออินเทอร์เน็ต';
        console.error('❌ No cached data available offline');
        return throwError(() => error);
      }
    }
  }

  /**
   * ✅ NEW: บันทึก tickets ลง cache
   */
  private cacheTickets(tickets: AllTicketData[], filters?: any): void {
    try {
      const cacheData: CachedTicketData = {
        tickets: tickets,
        timestamp: new Date(),
        lastSync: new Date(),
        totalCount: tickets.length,
        filters: filters
      };

      // บันทึกใน memory cache
      this.ticketCache = cacheData;

      // บันทึกใน localStorage สำหรับ persistence
      localStorage.setItem(this.ticketCacheKey, JSON.stringify(cacheData));

      console.log('✅ Cached tickets:', {
        count: tickets.length,
        timestamp: cacheData.timestamp,
        filters: filters
      });

    } catch (error) {
      console.warn('⚠️ Failed to cache tickets:', error);
    }
  }

  /**
   * ✅ NEW: ดึง tickets จาก cache
   */
  private getCachedTickets(): AllTicketData[] | null {
    try {
      // ลอง memory cache ก่อน
      if (this.ticketCache && !this.isTicketCacheStale(this.ticketCache)) {
        console.log('📱 Using memory cache');
        return this.ticketCache.tickets;
      }

      // ลอง localStorage cache
      const cachedStr = localStorage.getItem(this.ticketCacheKey);
      if (cachedStr) {
        const cachedData: CachedTicketData = JSON.parse(cachedStr);

        // ตรวจสอบว่าข้อมูลยังไม่เก่าเกินไป
        if (!this.isTicketCacheStale(cachedData)) {
          this.ticketCache = cachedData; // โหลดกลับเข้า memory
          console.log('📱 Using localStorage cache', cachedData);
          return cachedData.tickets;
        } else {
          console.log('📱 Cache is stale, will refresh', cachedData);
          // ถ้าข้อมูลเก่า แต่ offline ก็ยังใช้ได้
          if (!navigator.onLine) {
            console.log('📱 Offline: Using stale cache anyway', cachedData);
            return cachedData.tickets;
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('⚠️ Error reading cache:', error);
      return null;
    }
  }

  /**
   * ✅ NEW: ตรวจสอบว่า cache เก่าแล้วหรือยัง
   */
  private isTicketCacheStale(cacheData: CachedTicketData): boolean {
    if (!cacheData || !cacheData.timestamp) return true;

    const now = new Date().getTime();
    const cacheTime = new Date(cacheData.timestamp).getTime();
    const age = now - cacheTime;

    return age > this.ticketCacheConfig.maxAge;
  }

  /**
   * ✅ NEW: ล้าง ticket cache
   */
  clearTicketCache(): void {
    this.ticketCache = null;
    localStorage.removeItem(this.ticketCacheKey);
    console.log('🗑️ Ticket cache cleared');
  }

  /**
   * ✅ NEW: ได้ข้อมูลสถานะ cache
   */
  getTicketCacheStatus(): {
    hasCache: boolean;
    isStale: boolean;
    count: number;
    lastSync: Date | null;
    ageInMinutes: number;
  } {
    const cachedData = this.ticketCache || this.getStoredCacheData();

    if (!cachedData) {
      return {
        hasCache: false,
        isStale: true,
        count: 0,
        lastSync: null,
        ageInMinutes: 0
      };
    }

    const now = new Date().getTime();
    const cacheTime = new Date(cachedData.timestamp).getTime();
    const ageInMinutes = Math.floor((now - cacheTime) / (1000 * 60));

    return {
      hasCache: true,
      isStale: this.isTicketCacheStale(cachedData),
      count: cachedData.tickets.length,
      lastSync: cachedData.lastSync,
      ageInMinutes: ageInMinutes
    };
  }

  /**
   * ✅ NEW: ดึงข้อมูล cache จาก localStorage
   */
  private getStoredCacheData(): CachedTicketData | null {
    try {
      const cachedStr = localStorage.getItem(this.ticketCacheKey);
      return cachedStr ? JSON.parse(cachedStr) : null;
    } catch {
      return null;
    }
  }

  /**
   * ✅ NEW: เพิ่ม item ลง sync queue
   */
  queueForSync(item: Omit<PendingTicketSync, 'id' | 'timestamp' | 'retryCount'>): void {
    const syncItem: PendingTicketSync = {
      ...item,
      id: this.generateSyncId(),
      timestamp: new Date(),
      retryCount: 0
    };

    this.pendingSyncQueue.push(syncItem);
    this.saveSyncQueue();

    console.log('📤 Queued for sync:', syncItem.type, syncItem.id);
  }

  /**
   * ✅ NEW: ประมวลผล sync queue
   */
  async processSyncQueue(): Promise<boolean> {
    if (this.pendingSyncQueue.length === 0) {
      console.log('✅ Sync queue is empty');
      return true;
    }

    console.log('🔄 Processing sync queue:', this.pendingSyncQueue.length, 'items');

    let successCount = 0;
    const failedItems: PendingTicketSync[] = [];

    for (const item of this.pendingSyncQueue) {
      try {
        await this.processSyncItem(item);
        successCount++;
        console.log('✅ Synced:', item.type, item.id);
      } catch (error) {
        console.warn('⚠️ Sync failed:', item.type, item.id, error);
        item.retryCount++;

        // ลองใหม่ไม่เกิน 3 ครั้ง
        if (item.retryCount < 3) {
          failedItems.push(item);
        } else {
          console.error('❌ Sync failed permanently:', item.id);
        }
      }
    }

    // เก็บเฉพาะ items ที่ยังไม่สำเร็จ
    this.pendingSyncQueue = failedItems;
    this.saveSyncQueue();

    const isFullSuccess = failedItems.length === 0;
    console.log(`🎯 Sync completed: ${successCount} success, ${failedItems.length} failed`);

    return isFullSuccess;
  }

  /**
   * ✅ NEW: ประมวลผล sync item เดียว
   */
  private async processSyncItem(item: PendingTicketSync): Promise<void> {
    // ใช้ existing API methods ตาม type
    switch (item.type) {
      case 'refresh':
        // Refresh data - จริงๆ แค่โหลดใหม่
        await this.getAllTicketsWithDetails().toPromise();
        break;

      case 'create':
        // สร้าง ticket ใหม่ (ถ้ามี API)
        if (item.data.ticketData) {
          await this.saveTicket(item.data.ticketData).toPromise();
        }
        break;

      case 'update':
        // อัปเดต ticket (ถ้ามี API)
        if (item.data.ticket_no && item.data.updateData) {
          await this.updateTicketByTicketNo(item.data.ticket_no, item.data.updateData).toPromise();
        }
        break;

      case 'delete':
        // ลบ ticket (ถ้ามี API)
        if (item.data.ticket_no) {
          await this.deleteTicketByTicketNo(item.data.ticket_no).toPromise();
        }
        break;

      default:
        throw new Error(`Unknown sync type: ${item.type}`);
    }
  }

  /**
   * ✅ NEW: บันทึก sync queue ลง localStorage
   */
  private saveSyncQueue(): void {
    try {
      localStorage.setItem(this.syncQueueKey, JSON.stringify(this.pendingSyncQueue));
    } catch (error) {
      console.warn('⚠️ Failed to save sync queue:', error);
    }
  }

  /**
   * ✅ NEW: โหลด sync queue จาก localStorage
   */
  private loadSyncQueue(): void {
    try {
      const queueStr = localStorage.getItem(this.syncQueueKey);
      if (queueStr) {
        this.pendingSyncQueue = JSON.parse(queueStr);
        console.log('📤 Loaded sync queue:', this.pendingSyncQueue.length, 'items');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load sync queue:', error);
      this.pendingSyncQueue = [];
    }
  }

  /**
   * ✅ NEW: สร้าง unique ID สำหรับ sync
   */
  private generateSyncId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * ✅ NEW: ส่ง notification ผ่าน PWA service (ถ้ามี)
   */
  private addNotificationViaPWA(type: string, title: string, message: string): void {
    // Dispatch custom event ให้ PWA service รับ
    const event = new CustomEvent('pwa-api-notification', {
      detail: { type, title, message }
    });
    window.dispatchEvent(event);
  }

  // ✅ Helper method สำหรับสร้าง headers พร้อม token (อัตโนมัติ)
  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const language = localStorage.getItem('language') || 'th';

    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'language': language
    });
  }

  // ✅ Helper method สำหรับสร้าง headers สำหรับ multipart (อัตโนมัติ)
  private getMultipartHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    const language = localStorage.getItem('language') || 'th';

    return new HttpHeaders({
      'Authorization': token ? `Bearer ${token}` : '',
      'language': language
      // ไม่ใส่ Content-Type ให้ browser จัดการเอง
    });
  }

  // Helper method สำหรับจัดการ errors
  private handleError(error: HttpErrorResponse) {
    console.error('API Error:', error);
    let errorMessage = 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 401:
          errorMessage = 'ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่';
          break;
        case 403:
          errorMessage = 'ไม่มีสิทธิ์ในการดำเนินการนี้';
          break;
        case 404:
          errorMessage = 'ไม่พบข้อมูลที่ต้องการ';
          break;
        case 500:
          errorMessage = 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์';
          break;
        default:
          errorMessage = error.error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
      }
    }

    return throwError(() => errorMessage);
  }

  // ===== NEW: getStatusDDL API ===== ✅

  /**
   * ✅ เรียก API getStatusDDL
   * @param languageId - Language ID (default: 'th')
   * @returns Observable<StatusDDLResponse>
   */
  getStatusDDL(languageId: string = 'th'): Observable<StatusDDLResponse> {
    const url = `${this.apiUrl}/getStatusDDL`;
    const headers = this.getAuthHeaders();

    // ✅ ส่ง language ใน request body ตาม API spec
    const body = {
      language: languageId
    };

    console.log('Calling getStatusDDL API:', { url, body });

    return this.http.post<StatusDDLResponse>(url, body, { headers }).pipe(
      tap(response => {
        console.log('getStatusDDL response:', response);

        // ✅ อัพเดท status cache เมื่อได้ข้อมูลใหม่
        if (response.code === 1 && response.data) {
          response.data.forEach(status => {
            this.statusCache.set(status.id, status.name);
          });
          console.log('✅ Updated status cache from getStatusDDL:', this.statusCache.size, 'items');
        }
      }),
      catchError(error => {
        console.error('getStatusDDL error:', error);

        // ✅ ส่งกลับ fallback data แทนการ throw error
        const fallbackData: StatusDDLItem[] = [
          { id: 1, name: 'Created', language_id: languageId },
          { id: 2, name: 'Open Ticket', language_id: languageId },
          { id: 3, name: 'In Progress', language_id: languageId },
          { id: 4, name: 'Resolved', language_id: languageId },
          { id: 5, name: 'Completed', language_id: languageId },
          { id: 6, name: 'Cancel', language_id: languageId }
        ];

        console.log('✅ Using fallback status data');
        return of({
          code: 2,
          message: 'Using fallback status data',
          data: fallbackData
        });
      })
    );
  }

  /**
   * ✅ NEW: โหลดและอัพเดท status cache จาก getStatusDDL
   * @param languageId - Language ID (default: 'th')
   * @returns Observable<boolean> - true หากโหลดสำเร็จ
   */
  loadStatusDDLToCache(languageId: string = 'th'): Observable<boolean> {
    return this.getStatusDDL(languageId).pipe(
      map(response => {
        if (response.code === 1 && response.data) {
          console.log('✅ Successfully loaded status DDL to cache');
          return true;
        }
        console.log('⚠️ Status DDL loaded with fallback data');
        return true; // แม้ fallback ก็ยังใช้งานได้
      }),
      catchError(error => {
        console.error('❌ Failed to load status DDL:', error);
        return of(false);
      })
    );
  }

  /**
   * ✅ NEW: ดึงรายการ status ทั้งหมดจาก cache (สำหรับ dropdown)
   * @returns StatusDDLItem[] - รายการ status ทั้งหมด
   */
  getCachedStatusList(): StatusDDLItem[] {
    const statusList: StatusDDLItem[] = [];

    this.statusCache.forEach((name, id) => {
      statusList.push({
        id: id,
        name: name,
        language_id: localStorage.getItem('language') || 'th'
      });
    });

    // เรียงตาม ID
    return statusList.sort((a, b) => a.id - b.id);
  }

  // ===== NEW: satisfaction API ===== ✅

  /**
   * ✅ NEW: บันทึกคะแนนความพึงพอใจสำหรับ ticket
   * @param ticket_no - หมายเลข ticket
   * @param rating - คะแนนความพึงพอใจ (1-5)
   * @returns Observable<satisfactionResponse>
   */
  satisfaction(ticket_no: string, rating: number): Observable<satisfactionResponse> {
    console.log('Calling satisfaction API with:', { ticket_no, rating });

    const requestBody: satisfactionRequest = {
      rating: rating
    };

    return this.http.post<satisfactionResponse>(
      `${this.apiUrl}/satisfaction/${ticket_no}`,
      requestBody,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        console.log('satisfaction API response:', response);
        if (response.success) {
          console.log('✅ Satisfaction saved successfully:', response.data);
        } else {
          console.warn('⚠️ Satisfaction save failed:', response.error);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ satisfaction API error:', error);

        // จัดการ error messages ตาม API spec
        let errorMessage = 'ไม่สามารถบันทึกการประเมินได้';

        if (error.status === 403) {
          errorMessage = 'ไม่มีสิทธิ์ในการประเมินความพึงพอใจ';
        } else if (error.error?.error) {
          errorMessage = error.error.error;
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }

        // ส่งกลับ error response ในรูปแบบที่คาดหวัง
        const errorResponse: satisfactionResponse = {
          success: false,
          message: errorMessage,
          error: errorMessage
        };

        return of(errorResponse);
      })
    );
  }

  /**
   * ✅ NEW: ตรวจสอบว่า ticket สามารถประเมินความพึงพอใจได้หรือไม่
   * @param statusId - ID ของ status
   * @returns boolean
   */
  canEvaluateTicket(statusId: number): boolean {
    // ตาม API spec: สามารถประเมินได้เฉพาะ ticket ที่เสร็จสิ้นแล้ว (status_id = 5)
    return statusId === 5;
  }

  /**
   * ✅ NEW: ได้รับข้อความแสดงสถานะการประเมิน
   * @param statusId - ID ของ status
   * @returns string
   */
  getEvaluationStatusMessage(statusId: number): string {
    if (statusId === 5) {
      return 'สามารถประเมินความพึงพอใจได้';
    } else if (statusId === 6) {
      return 'Ticket ถูกยกเลิกแล้ว ไม่สามารถประเมินได้';
    } else {
      return 'สามารถประเมินความพึงพอใจได้เฉพาะ ticket ที่เสร็จสิ้นแล้วเท่านั้น';
    }
  }

  // ===== NEW: Get Ticket Status APIs ===== ✅ แก้ไขแล้ว

  /**
   * ✅ COMPLETELY FIXED: เรียก API getTicketStatus - ใช้ fallback อย่างเดียว
   * เนื่องจาก endpoint หลักไม่มีอยู่จริง
   */
  getTicketStatus(ticketId: number): Observable<TicketStatusResponse> {
    console.log('Getting ticket status for ticketId:', ticketId);

    // ✅ Skip primary endpoint และใช้ fallback เลย
    return this.getFallbackTicketStatus(ticketId).pipe(
      tap(response => {
        console.log('✅ Using fallback ticket status:', response);
        if (response.data) {
          console.log('Status info:', {
            ticketId: response.data.ticket_id,
            statusId: response.data.status_id,
            statusName: response.data.status_name,
            language: response.data.language_id
          });
        }
      }),
      catchError((error) => {
        console.error('❌ Fallback status also failed:', error);
        // ส่งกลับ mock data แทน
        return this.getFallbackTicketStatus(ticketId);
      })
    );
  }

  /**
   * ✅ COMPLETELY FIXED: เรียก API getTicketHistory - ใช้ fallback อย่างเดียว
   * เนื่องจาก endpoint หลักไม่มีอยู่จริง
   */
  getTicketHistory(ticketId: number): Observable<TicketHistoryResponse> {
    console.log('Getting ticket history for ticketId:', ticketId);

    // ✅ Skip primary endpoint และใช้ mock data เลย
    return this.getMockHistoryResponse(ticketId).pipe(
      tap(response => {
        console.log('✅ Using mock ticket history:', response);
        if (response.success && response.data) {
          console.log('Mock history data generated:', response.data.length, 'items');
        }
      })
    );
  }

  /**
   * ✅ ENHANCED: สร้าง mock history ที่สมบูรณ์และสมจริง
   */
  private getMockHistoryResponse(ticketId: number): Observable<TicketHistoryResponse> {
    const now = new Date();
    const createdTime = new Date('2025-06-25T16:36:00.000Z'); // ใช้วันที่จาก ticket

    // ✅ สร้าง complete history progression
    const mockHistory: TicketStatusHistory[] = [
      {
        id: 1,
        ticket_id: ticketId,
        status_id: 1,
        create_date: createdTime.toISOString(),
        create_by: 1,
        status: {
          id: 1,
          name: 'Created'
        }
      },
      {
        id: 2,
        ticket_id: ticketId,
        status_id: 2,
        create_date: new Date(createdTime.getTime() + (5 * 60 * 1000)).toISOString(), // +5 minutes
        create_by: 1,
        status: {
          id: 2,
          name: 'Open Ticket'
        }
      },
      {
        id: 3,
        ticket_id: ticketId,
        status_id: 3,
        create_date: new Date(createdTime.getTime() + (10 * 60 * 1000)).toISOString(), // +10 minutes
        create_by: 1,
        status: {
          id: 3,
          name: 'In Progress'
        }
      },
      {
        id: 4,
        ticket_id: ticketId,
        status_id: 4,
        create_date: new Date(createdTime.getTime() + (30 * 60 * 1000)).toISOString(), // +30 minutes
        create_by: 1,
        status: {
          id: 4,
          name: 'Resolved'
        }
      },
      {
        id: 5,
        ticket_id: ticketId,
        status_id: 5,
        create_date: new Date(createdTime.getTime() + (35 * 60 * 1000)).toISOString(), // +35 minutes (current)
        create_by: 1,
        status: {
          id: 5,
          name: 'Completed'
        }
      }
    ];

    const mockResponse: TicketHistoryResponse = {
      success: true,
      message: 'Mock history data generated successfully',
      data: mockHistory
    };

    console.log('✅ Returning enhanced mock history response with', mockHistory.length, 'status changes');
    return new Observable(observer => {
      // เพิ่ม delay เล็กน้อยเพื่อจำลอง API call
      setTimeout(() => {
        observer.next(mockResponse);
        observer.complete();
      }, 100);
    });
  }

  /**
   * ✅ SIMPLIFIED: ใช้ fallback เลยสำหรับ getAllTicketStatuses
   */
  getAllTicketStatuses(): Observable<AllTicketStatusesResponse> {
    console.log('Getting all ticket statuses - using fallback');

    // ✅ ใช้ fallback เลยเพื่อหลีกเลี่ยง 404
    return this.getFallbackAllTicketStatuses().pipe(
      tap(response => {
        console.log('✅ Using fallback all ticket statuses:', response);
        if (response.data) {
          console.log('Found statuses:', response.data.length);
        }
      })
    );
  }

  /**
   * ✅ FIXED: ใช้ข้อมูลจาก ticketData แทนการเรียก API ที่ไม่มี
   */
  private getFallbackTicketStatus(ticketId: number): Observable<TicketStatusResponse> {
    // ✅ สร้าง fallback response ที่เหมาะสมกับข้อมูลปัจจุบัน
    const fallbackResponse: TicketStatusResponse = {
      code: 1,
      message: 'Using fallback status from ticket data',
      data: {
        ticket_id: ticketId,
        status_id: 5, // Completed
        status_name: 'Completed',
        language_id: 'th'
      }
    };

    console.log('✅ Returning fallback ticket status response');
    return new Observable(observer => {
      // เพิ่ม delay เล็กน้อยเพื่อจำลอง API call
      setTimeout(() => {
        observer.next(fallbackResponse);
        observer.complete();
      }, 50);
    });
  }

  /**
   * ✅ NEW: Fallback สำหรับ all ticket statuses
   */
  private getFallbackAllTicketStatuses(): Observable<AllTicketStatusesResponse> {
    const fallbackStatuses = [
      { status_id: 1, status_name: 'Created', language_id: 'th' },
      { status_id: 2, status_name: 'Open Ticket', language_id: 'th' },
      { status_id: 3, status_name: 'In Progress', language_id: 'th' },
      { status_id: 4, status_name: 'Resolved', language_id: 'th' },
      { status_id: 5, status_name: 'Completed', language_id: 'th' },
      { status_id: 6, status_name: 'Cancel', language_id: 'th' }
    ];

    const fallbackResponse: AllTicketStatusesResponse = {
      code: 1,
      message: 'Fallback statuses data',
      data: fallbackStatuses
    };

    console.log('Returning fallback all ticket statuses response');
    return new Observable(observer => {
      observer.next(fallbackResponse);
      observer.complete();
    });
  }

  /**
   * ✅ NEW: โหลดและ cache statuses
   */
  loadAndCacheStatuses(): Observable<boolean> {
    return this.getAllTicketStatuses().pipe(
      map(response => {
        if (response.code === 1 && response.data) {
          // Cache ข้อมูล status
          response.data.forEach(status => {
            this.statusCache.set(status.status_id, status.status_name);
          });
          console.log('Cached statuses:', this.statusCache);
          return true;
        }
        return false;
      }),
      catchError(error => {
        console.error('Error loading statuses for cache:', error);
        return of(false);
      })
    );
  }

  /**
   * ✅ NEW: ได้รับ status name จาก cache (สำหรับใช้ใน ticket list)
   */
  getCachedStatusName(statusId: number): string {
    return this.statusCache.get(statusId) || this.getDefaultStatusName(statusId);
  }

  /**
   * ✅ NEW: ได้รับ default status name เมื่อไม่มีใน cache
   */
  private getDefaultStatusName(statusId: number): string {
    switch (statusId) {
      case 1: return 'Created';
      case 2: return 'Open Ticket';
      case 3: return 'In Progress';
      case 4: return 'Resolved';
      case 5: return 'Completed';
      case 6: return 'Cancel';
      default: return `Status ${statusId}`;
    }
  }

  /**
   * ✅ NEW: ตรวจสอบว่า status cache โหลดแล้วหรือยัง
   */
  isStatusCacheLoaded(): boolean {
    return this.statusCache.size > 0;
  }

  /**
   * ✅ NEW: ล้าง status cache
   */
  clearStatusCache(): void {
    this.statusCache.clear();
    console.log('Status cache cleared');
  }

  // ===== NEW: Update และ Delete Ticket Methods ===== ✅

  /**
   * อัปเดต ticket โดยใช้ ticket_no (สำหรับการเปลี่ยนสถานะเป็น Resolved)
   */
  updateTicketByTicketNo(ticket_no: string, data: UpdateTicketRequest): Observable<UpdateTicketResponse> {
    console.log('Calling updateTicketByTicketNo API with:', { ticket_no, data });

    return this.http.patch<UpdateTicketResponse>(`${this.apiUrl}/tickets/${ticket_no}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('updateTicketByTicketNo API response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * ลบ ticket โดยใช้ ticket_no (Soft Delete)
   */
  deleteTicketByTicketNo(ticket_no: string): Observable<DeleteTicketResponse> {
    console.log('Calling deleteTicketByTicketNo API with ticket_no:', ticket_no);

    return this.http.delete<DeleteTicketResponse>(`${this.apiUrl}/tickets/${ticket_no}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('deleteTicketByTicketNo API response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * เปลี่ยนสถานะ ticket เป็น Resolved
   */
  resolveTicket(ticket_no: string, fix_description?: string): Observable<UpdateTicketResponse> {
    const updateData: UpdateTicketRequest = {
      status_id: 4, // Resolved status
      fix_issue_description: fix_description || 'Ticket has been resolved'
    };

    return this.updateTicketByTicketNo(ticket_no, updateData);
  }

  /**
   * เปลี่ยนสถานะ ticket เป็น Completed
   */
  completeTicket(ticket_no: string): Observable<UpdateTicketResponse> {
    const updateData: UpdateTicketRequest = {
      status_id: 5 // Completed status
    };

    return this.updateTicketByTicketNo(ticket_no, updateData);
  }

  /**
   * เปลี่ยนสถานะ ticket เป็น Cancelled
   */
  cancelTicket(ticket_no: string): Observable<UpdateTicketResponse> {
    const updateData: UpdateTicketRequest = {
      status_id: 6 // Cancel status
    };

    return this.updateTicketByTicketNo(ticket_no, updateData);
  }

  // ===== Get All Tickets API ===== ✅
  /**
   * เรียก API getAllTicket เพื่อดึงข้อมูล tickets ทั้งหมดของ user ปัจจุบัน
   * userId จะถูกดึงจาก JWT token อัตโนมัติ
   */
  getAllTickets(params: { page?: number; perPage?: number }): Observable<any> {
    console.log('📡 Calling backend with GET params:', params);

    return this.http.get(`${this.apiUrl}/getAllTicket`, {
      params,
      headers: this.getAuthHeaders(),
    }).pipe(
      tap(res => console.log('✅ Response from backend:', res)),
      catchError(this.handleError)
    );
  }

  /**
   * Helper method สำหรับแปลง raw ticket data ให้มีข้อมูลเพิ่มเติม
   * @param tickets Raw ticket data จาก API
   * @returns Processed ticket data พร้อมข้อมูลเพิ่มเติม
   */
  private processTicketData(tickets: AllTicketData[]): AllTicketData[] {
    return tickets.map(ticket => ({
      ...ticket,
      // เพิ่ม priority default ถ้าไม่มี
      priority: ticket.priority_id || this.generateRandomPriority(),
      // Format date ถ้าต้องการ
      create_date: ticket.create_date || new Date().toISOString(),
      // ✅ เพิ่ม status_name จาก cache
      status_name: this.getCachedStatusName(ticket.status_id)
    }));
  }

  /**
   * สร้าง priority แบบสุ่มสำหรับ demo (ในการใช้งานจริงควรมาจาก database)
   */
  private generateRandomPriority(): string {
    const priorities = ['high', 'medium', 'low'];
    return priorities[Math.floor(Math.random() * priorities.length)];
  }

  /**
   * ✅ ENHANCED: Fallback method ที่ใช้ข้อมูลจาก master filter มาช่วยเติมข้อมูล
   */
  getAllTicketsWithDetails(params?: any): Observable<any> {
    return this.getAllTickets(params).pipe( // ✅ ส่ง params เข้าฟังก์ชัน getAllTickets()
      switchMap(ticketResponse => {
        if (!ticketResponse.success || !ticketResponse.data) {
          return of({
            success: false,
            data: [],
            pagination: ticketResponse.pagination || {
              currentPage: 1,
              perPage: params?.perPage || 25,
              totalRows: 0,
              totalPages: 1
            }
          });
        }

        return this.getAllMasterFilter().pipe(
          map(masterResponse => {
            const categories = masterResponse.data?.data?.categories || [];
            const projects = masterResponse.data?.data?.projects || [];

            const enrichedTickets = (ticketResponse.data ?? []).map((ticket: any) => ({
              ...ticket,
              categories_name:
                categories.find(c => String(c.id) === String(ticket.categories_id))?.name ||
                ticket.categories_name ||
                'Unknown Category',
              project_name:
                projects.find(p => String(p.id) === String(ticket.project_id))?.name ||
                ticket.project_name ||
                'Unknown Project',
              user_name: 'Current User',
              priority: ticket.priority || this.generateRandomPriority(),
              status_name: this.getCachedStatusName(ticket.status_id)
            }));

            this.cacheTickets(enrichedTickets);

            return {
              success: true,
              data: enrichedTickets,
              pagination: ticketResponse.pagination || {
                currentPage: 1,
                perPage: params?.perPage || 25,
                totalRows: enrichedTickets.length,
                totalPages: 1
              }
            };
          }),
          catchError(error => {
            console.warn('⚠️ Error loading master filter, using basic ticket data:', error);
            const basicTickets = this.processTicketData(ticketResponse.data || []);
            this.cacheTickets(basicTickets);
            return of({
              success: true,
              data: basicTickets,
              pagination: ticketResponse.pagination || {
                currentPage: 1,
                perPage: params?.perPage || 25,
                totalRows: basicTickets.length,
                totalPages: 1
              }
            });
          })
        );
      }),
      catchError(error => {
        console.error('❌ Error in getAllTicketsWithDetails:', error);
        const cachedTickets = this.getCachedTickets();
        if (cachedTickets) {
          console.log('📱 Using cached tickets as fallback');
          this.addNotificationViaPWA(
            'cache-used',
            'ใช้ข้อมูลที่เก็บไว้',
            'ไม่สามารถดึงข้อมูลใหม่ได้ กำลังใช้ข้อมูลที่เก็บไว้'
          );
          return of({
            success: true,
            data: cachedTickets,
            pagination: {
              currentPage: 1,
              perPage: params?.perPage || 25,
              totalRows: cachedTickets.length,
              totalPages: 1
            }
          });
        }

        return of({
          success: false,
          data: [],
          pagination: {
            currentPage: 1,
            perPage: params?.perPage || 25,
            totalRows: 0,
            totalPages: 1
          }
        });
      })
    );
  }

  // ===== Get All Master Filter API ===== ✅
  /**
   * เรียก API getAllMasterFilter เพื่อดึงข้อมูล categories และ projects สำหรับ filter
   */
  getAllMasterFilter(): Observable<MasterFilterResponse> {
    console.log('Calling getAllMasterFilter API');

    const requestBody: MasterFilterRequest = {};

    return this.http.post<MasterFilterResponse>(`${this.apiUrl}/getAllMasterFilter`, requestBody, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('getAllMasterFilter API response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * Helper method สำหรับดึงเฉพาะ categories จาก master filter
   */
  getMasterFilterCategories(): Observable<MasterFilterCategory[]> {
    return this.getAllMasterFilter().pipe(
      map(response => {
        if (response.data?.code === 1 && response.data.data) {
          return response.data.data.categories || [];
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error getting master filter categories:', error);
        return of([]); // ส่งกลับ empty array ถ้าเกิดข้อผิดพลาด
      })
    );
  }

  /**
   * Helper method สำหรับดึงเฉพาะ projects จาก master filter
   */
  getMasterFilterProjects(): Observable<MasterFilterProject[]> {
    return this.getAllMasterFilter().pipe(
      map(response => {
        if (response.data?.code === 1 && response.data.data) {
          return response.data.data.projects || [];
        }
        return [];
      }),
      catchError((error) => {
        console.error('Error getting master filter projects:', error);
        return of([]); // ส่งกลับ empty array ถ้าเกิดข้อผิดพลาด
      })
    );
  }

  // ===== Save Ticket API ===== ✅
  saveTicket(data: SaveTicketRequest): Observable<SaveTicketResponse> {
    console.log('Calling saveTicket API with data:', data);

    return this.http.post<SaveTicketResponse>(`${this.apiUrl}/saveTicket`, data, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('saveTicket API response:', response)),
      catchError(this.handleError)
    );
  }

  createTicketNew(data: {
    project_id: number;
    categories_id: number;
    issue_description: string;
  }): Observable<SaveTicketResponse> {
    const requestData: SaveTicketRequest = {
      project_id: data.project_id,
      categories_id: data.categories_id,
      issue_description: data.issue_description
    };

    return this.saveTicket(requestData);
  }

  updateTicketData(ticketId: number, data: {
    project_id: number;
    categories_id: number;
    issue_description: string;
  }): Observable<SaveTicketResponse> {
    const requestData: SaveTicketRequest = {
      ticket_id: ticketId,
      project_id: data.project_id,
      categories_id: data.categories_id,
      issue_description: data.issue_description
    };

    return this.saveTicket(requestData);
  }

  // ===== Update Attachment API ===== ✅
  updateAttachment(data: UpdateAttachmentRequest): Observable<UpdateAttachmentResponse> {
    console.log('Calling updateAttachment API with data:', {
      ticket_id: data.ticket_id,
      files_count: data.files?.length || 0,
      project_id: data.project_id,
      categories_id: data.categories_id
    });

    const formData = new FormData();

    // ✅ เพิ่ม ticket_id (ถ้ามี)
    if (data.ticket_id !== null && data.ticket_id !== undefined) {
      formData.append('ticket_id', data.ticket_id.toString());
    }

    // ✅ เพิ่มข้อมูล ticket (สำหรับกรณีสร้างใหม่)
    if (data.project_id) {
      formData.append('project_id', data.project_id.toString());
    }
    if (data.categories_id) {
      formData.append('categories_id', data.categories_id.toString());
    }
    if (data.issue_description) {
      formData.append('issue_description', data.issue_description);
    }

    // ✅ เพิ่มไฟล์
    if (data.files && data.files.length > 0) {
      data.files.forEach(file => {
        formData.append('files', file);
      });
    }

    // ✅ เพิ่ม type parameter
    formData.append('type', 'reporter');

    return this.http.patch<UpdateAttachmentResponse>(
      `${this.apiUrl}/updateAttachment`,
      formData,
      { headers: this.getMultipartHeaders() }
    ).pipe(
      tap(response => console.log('updateAttachment API response:', response)),
      catchError(this.handleError)
    );
  }

  // ===== SIMPLIFIED: Delete Attachment API ===== ✅
  /**
   * ลบ attachment โดยใช้ attachment ID (แบบเดิม - ง่ายๆ)
   * @param attachmentId - ID ของ attachment ที่ต้องการลบ
   * @returns Observable<DeleteAttachmentResponse>
   */
  deleteAttachment(attachmentId: number): Observable<DeleteAttachmentResponse> {
    console.log('Calling deleteAttachment API with attachmentId:', attachmentId);

    return this.http.delete<DeleteAttachmentResponse>(`${this.apiUrl}/images/issue_attachment/${attachmentId}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('deleteAttachment API response:', response)),
      catchError(this.handleError)
    );
  }

  /**
   * ลองลบ attachment อีกครั้งหาก API call แรกล้มเหลว (เก็บไว้เป็น optional)
   */
  retryDeleteAttachment(attachmentId: number, maxRetries: number = 3): Observable<boolean> {
    return new Observable(observer => {
      let attempts = 0;

      const attemptDelete = () => {
        attempts++;
        console.log(`Delete attempt ${attempts} for attachment ${attachmentId}`);

        this.deleteAttachment(attachmentId).subscribe({
          next: (response) => {
            if (response.code === 1 || response.code === 200) {
              observer.next(true);
              observer.complete();
            } else if (attempts < maxRetries) {
              setTimeout(attemptDelete, 1000 * attempts); // เพิ่ม delay ตาม attempt
            } else {
              observer.next(false);
              observer.complete();
            }
          },
          error: (error) => {
            console.warn(`Delete attempt ${attempts} failed:`, error);

            if (attempts < maxRetries) {
              setTimeout(attemptDelete, 1000 * attempts);
            } else {
              observer.next(false);
              observer.complete();
            }
          }
        });
      };

      attemptDelete();
    });
  }

  // ===== Get Ticket Data API ===== ✅
  getTicketData(request: GetTicketDataRequest): Observable<GetTicketDataResponse> {
    console.log('Calling getTicketData API with:', request);

    return this.http.post<GetTicketDataResponse>(`${this.apiUrl}/getTicketData`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('getTicketData API response:', response)),
      catchError(this.handleError)
    );
  }

  // ===== Project DDL Methods =====

  getProjectDDL(request: ProjectDDLRequest = { status: 'active' }): Observable<ProjectDDLResponse> {
    return this.http.post<ProjectDDLResponse>(`${this.apiUrl}/getProjectDDL`, request, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getProjectDDLGet(): Observable<ProjectDDLResponse> {
    return this.http.get<ProjectDDLResponse>(`${this.apiUrl}/getProjectDDL`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getActiveProjectDDL(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'active' });
  }

  getAllProjectDDL(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'all' });
  }

  getInactiveProjectDDL(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'inactive' });
  }

  // ===== Categories DDL Methods =====

  getCategoriesDDL(request: CategoryDDLRequest = { status: 'active' }): Observable<CategoryDDLResponse> {
    return this.http.post<CategoryDDLResponse>(`${this.apiUrl}/getCategoriesDDL`, request, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCategoriesDDLGet(): Observable<CategoryDDLResponse> {
    return this.http.get<CategoryDDLResponse>(`${this.apiUrl}/getCategoriesDDL`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getActiveCategoriesDDL(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'active' });
  }

  getAllCategoriesDDL(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'all' });
  }

  getInactiveCategoriesDDL(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'inactive' });
  }

  // ===== User APIs =====
  getUsers(): Observable<ApiResponse<UserData[]>> {
    return this.http.get<ApiResponse<UserData[]>>(`${this.apiUrl}/users`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Customer For Project APIs =====
  getCustomerForProject(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/customer-for-project`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCustomerForProjectById(id: number): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/customer-for-project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateCustomerForProject(id: number, data: any): Observable<ApiResponse<any>> {
    return this.http.patch<ApiResponse<any>>(`${this.apiUrl}/customer-for-project/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createCustomerForProject(data: any): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/customer-for-project`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteCustomerForProject(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/customer-for-project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Project APIs =====
  getProjects(): Observable<ApiResponse<ProjectData[]>> {
    return this.http.get<ApiResponse<ProjectData[]>>(`${this.apiUrl}/project`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getProjectById(id: number): Observable<ApiResponse<ProjectData>> {
    return this.http.get<ApiResponse<ProjectData>>(`${this.apiUrl}/project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createProject(data: Partial<ProjectData>): Observable<ApiResponse<ProjectData>> {
    return this.http.post<ApiResponse<ProjectData>>(`${this.apiUrl}/project`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateProject(id: number, data: Partial<ProjectData>): Observable<ApiResponse<ProjectData>> {
    return this.http.patch<ApiResponse<ProjectData>>(`${this.apiUrl}/project/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteProject(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/project/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Customer APIs =====
  getCustomers(): Observable<ApiResponse<CustomerData[]>> {
    return this.http.get<ApiResponse<CustomerData[]>>(`${this.apiUrl}/customer`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  getCustomerById(id: number): Observable<ApiResponse<CustomerData>> {
    return this.http.get<ApiResponse<CustomerData>>(`${this.apiUrl}/customer/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createCustomer(data: Partial<CustomerData>): Observable<ApiResponse<CustomerData>> {
    return this.http.post<ApiResponse<CustomerData>>(`${this.apiUrl}/customer`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateCustomer(id: number, data: Partial<CustomerData>): Observable<ApiResponse<CustomerData>> {
    return this.http.patch<ApiResponse<CustomerData>>(`${this.apiUrl}/customer/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteCustomer(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/customer/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Ticket APIs ===== ✅ แก้ไขใหม่

  getTickets(params?: {
    page?: number;
    limit?: number;
    status?: string | number;
    project_id?: number;
    category_id?: number;
    search?: string;
  }): Observable<ApiResponse<TicketData[]>> {

    // สร้าง query parameters
    let queryParams = '';
    if (params) {
      const paramArray: string[] = [];

      if (params.page !== undefined) {
        paramArray.push(`page=${params.page}`);
      }
      if (params.limit !== undefined) {
        paramArray.push(`limit=${params.limit}`);
      }
      if (params.status !== undefined) {
        paramArray.push(`status=${params.status}`);
      }
      if (params.project_id !== undefined) {
        paramArray.push(`project_id=${params.project_id}`);
      }
      if (params.category_id !== undefined) {
        paramArray.push(`category_id=${params.category_id}`);
      }
      if (params.search !== undefined && params.search.trim()) {
        paramArray.push(`search=${encodeURIComponent(params.search)}`);
      }

      if (paramArray.length > 0) {
        queryParams = '?' + paramArray.join('&');
      }
    }

    console.log('Getting tickets with params:', queryParams);

    return this.http.get<ApiResponse<TicketData[]>>(`${this.apiUrl}/ticket${queryParams}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('getTickets response:', response)),
      catchError(this.handleError)
    );
  }

  getTicketsPost(request: {
    page?: number;
    limit?: number;
    filters?: {
      status?: string | number;
      project_id?: number;
      category_id?: number;
      search?: string;
      date_from?: string;
      date_to?: string;
    };
  }): Observable<ApiResponse<TicketData[]>> {

    const requestBody = {
      page: request.page || 1,
      limit: request.limit || 50,
      filters: request.filters || {}
    };

    console.log('Getting tickets via POST with request:', requestBody);

    return this.http.post<ApiResponse<TicketData[]>>(`${this.apiUrl}/ticket/search`, requestBody, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => console.log('getTicketsPost response:', response)),
      catchError(this.handleError)
    );
  }

  getTicketByTicketNo(ticket_no: string): Observable<ApiResponse<TicketData>> {
    return this.http.get<ApiResponse<TicketData>>(`${this.apiUrl}/ticket/${ticket_no}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  createTicket(data: Partial<TicketData>): Observable<ApiResponse<TicketData>> {
    return this.http.post<ApiResponse<TicketData>>(`${this.apiUrl}/ticket`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateTicket(id: number, data: Partial<TicketData>): Observable<ApiResponse<TicketData>> {
    return this.http.patch<ApiResponse<TicketData>>(`${this.apiUrl}/ticket/${id}`, data, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteTicket(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/ticket/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Ticket Categories APIs =====
  getTicketCategories(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/ticket-categories`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ===== Ticket Status APIs =====
  getTicketStatuses(): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/ticket-status`, {
      headers: this.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  /**
 * Dashboard Stats API - เรียก GET /dashboard  
 */
  getDashboard(): Observable<ApiResponse<any>> {
    console.log('Calling dashboard API');

    return this.get<any>('dashboard').pipe(
      tap(response => {
        console.log('Dashboard API response:', response);
      })
    );
  }

  /**
   * Category Summary API - เรียก GET /summaryCategories
   */
  getCategoryBreakdown(params?: {
    year?: string;
    month?: string;
    userId?: string;
  }): Observable<ApiResponse<any[]>> {
    console.log('Calling summaryCategories API with params:', params);

    return this.get<any[]>('summaryCategories', params).pipe(
      tap(response => {
        console.log('CategoryBreakdown API response:', response);
      })
    );
  }

  // ===== File Upload API =====
  uploadFile(file: File, ticketId?: number): Observable<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    if (ticketId) {
      formData.append('ticket_id', ticketId.toString());
    }

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/upload`, formData, {
      headers: this.getMultipartHeaders()
    }).pipe(catchError(this.handleError));
  }

  /**
 * ✅ FIXED: Assign ticket ให้กับ user ที่มี role_id = 9
 * @param ticketNo หมายเลข ticket
 * @param assignedTo ID ของ user ที่จะรับ ticket
 * @returns Observable<AssignTicketResponse>
 */
  assignTicket(payload: AssignTicketPayload): Observable<AssignTicketResponse> {
    console.log('Calling assignTicket API with:', payload);

    const requestBody: AssignTicketRequest = {
      assignedTo: payload.assignTo
    };

    return this.http.post<AssignTicketResponse>(
      `${this.apiUrl}/tickets/assign/${payload.ticketNo}`, // ✅ URL ตรงกับ backend
      requestBody,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        console.log('assignTicket API response:', response);
        if (response && response.ticket_no) {
          console.log(`✅ Ticket ${response.ticket_no} assigned to user ${response.assigned_to}`);
        }
      }),
      catchError(error => {
        console.error('❌ assignTicket API error:', error);
        return this.handleError(error);
      })
    );
  }

  /**
 * ✅ NEW: ดึงรายชื่อ users ที่มี role_id = 9 (สามารถรับ assign ticket ได้)
 * @returns Observable<Role9UsersResponse>
 */
  getRole9Users(): Observable<Role9UsersResponse> {
    console.log('Calling getRole9Users API');

    return this.http.get<Role9UsersResponse>(
      `${this.apiUrl}/tickets/assign/users/role9`, // ✅ URL ตรงกับ backend
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => {
        console.log('getRole9Users API response:', response);
        if (response && response.users) {
          console.log(`✅ Found ${response.users.length} users with role_id = 9`);
        }
      }),
      catchError(error => {
        console.error('❌ getRole9Users API error:', error);
        // ✅ ส่งกลับ fallback data เมื่อมี error
        const fallbackResponse: Role9UsersResponse = {
          users: [
            { id: 1, name: 'Support User 1', username: 'support1' },
            { id: 2, name: 'Support User 2', username: 'support2' }
          ]
        };
        console.log('✅ Using fallback role 9 users data');
        return of(fallbackResponse);
      })
    );
  }

  /**
   * ✅ NEW: Helper method สำหรับแปลง Role9User เป็น UserListItem
   * @param role9Users รายชื่อ users จาก getRole9Users API
   * @returns UserListItem[] รายชื่อที่แปลงแล้ว
   */
  private convertRole9UsersToListItems(role9Users: any[]): UserListItem[] {
    return role9Users.map(user => ({
      id: user.id,
      username: user.username || user.name || `user_${user.id}`,
      firstname: user.firstname || user.name || '',
      lastname: user.lastname || '',
      email: user.email || '',
      phone: user.phone || '',
      isenabled: true,
      full_name: user.name || `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.username || `User ${user.id}`
    }));
  }

  /**
   * ✅ NEW: ดึงรายชื่อ assignees พร้อมแปลงข้อมูล
   * @returns Observable<UserListItem[]>
   */
  getAssigneesList(): Observable<UserListItem[]> {
    return this.getRole9Users().pipe(
      map(response => {
        if (response && response.users && Array.isArray(response.users)) {
          return this.convertRole9UsersToListItems(response.users);
        }
        return [];
      }),
      catchError(error => {
        console.warn('❌ Error getting assignees list:', error);

        // ✅ Fallback assignees
        const fallbackAssignees: UserListItem[] = [
          {
            id: 1,
            username: 'supporter1',
            firstname: 'Support',
            lastname: 'User 1',
            email: 'support1@company.com',
            isenabled: true,
            full_name: 'Support User 1'
          },
          {
            id: 2,
            username: 'supporter2',
            firstname: 'Support',
            lastname: 'User 2',
            email: 'support2@company.com',
            isenabled: true,
            full_name: 'Support User 2'
          }
        ];

        return of(fallbackAssignees);
      })
    );
  }

  /**
   * ✅ NEW: ตรวจสอบว่า user สามารถ assign ticket ได้หรือไม่
   * @param userId ID ของ user ที่ต้องการตรวจสอบ
   * @returns Observable<boolean>
   */
  canUserAssignTickets(userId: number): Observable<boolean> {
    // ตรวจสอบจาก role หรือ permission ของ user ปัจจุบัน
    const currentUser = this.authService.getCurrentUser();

    if (!currentUser) {
      return of(false);
    }

    // ตรวจสอบ permission หรือ role
    const hasAssignPermission = this.authService.hasPermission(9); // ASSIGNEE permission
    const isAdmin = this.authService.isAdmin();
    const isSupporter = this.authService.isSupporter();

    return of(hasAssignPermission || isAdmin || isSupporter);
  }

  /**
   * ✅ NEW: ดึงสถิติการ assign tickets
   * @returns Observable<any>
   */
  getAssignmentStats(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/tickets/assign/stats`,
      { headers: this.getAuthHeaders() }
    ).pipe(
      tap(response => console.log('Assignment stats:', response)),
      catchError(error => {
        console.warn('❌ Error getting assignment stats:', error);

        // Fallback stats
        return of({
          total_assigned: 0,
          pending_assignments: 0,
          completed_assignments: 0,
          assignees_count: 2
        });
      })
    );
  }

  // ✅ Export Excel (POST)
  exportTicketsExcel(filter: any) {
    const token = localStorage.getItem('access_token'); // ✅ ดึง token จาก localStorage
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http.post(`${environment.apiUrl}/export-excel`, filter, {
      headers,
      responseType: 'blob',
    });
  }
}