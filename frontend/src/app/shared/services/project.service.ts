import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of, BehaviorSubject } from 'rxjs';
import { catchError, retry, tap, switchMap, map } from 'rxjs/operators';
import { 
  ProjectDDL, 
  ProjectStatus, 
  ProjectDDLRequest, 
  ProjectDDLResponse
} from '../models/project.model';
import { environment } from '../../../environments/environment';

// ✅ PWA Cache Configuration
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private apiUrl = environment.apiUrl;
  
  // ✅ PWA Cache Management
  private readonly CACHE_KEY = 'pwa_projects_cache';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly OFFLINE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for offline
  
  // ✅ Memory Cache
  private projectsCache$ = new BehaviorSubject<ProjectDDL[]>([]);
  private cacheTimestamp = 0;

  constructor(private http: HttpClient) {
    // ✅ PWA: โหลด cached data ตอนเริ่มต้น
    this.loadCachedData();
  }

  // ✅ Helper method สำหรับสร้าง headers พร้อม token
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    const language = localStorage.getItem('language') || 'th';
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'language': language
    });
  }

  // ✅ PWA: ตรวจสอบสถานะออนไลน์
  private isOnline(): boolean {
    return navigator.onLine;
  }

  // ✅ PWA: บันทึกข้อมูลลง localStorage
  private saveToCache(data: ProjectDDL[], status: ProjectStatus = 'active'): void {
    try {
      const cacheData: CacheEntry<ProjectDDL[]> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_DURATION
      };
      
      const cacheKey = `${this.CACHE_KEY}_${status}`;
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      // ✅ อัปเดต memory cache
      this.projectsCache$.next(data);
      this.cacheTimestamp = Date.now();
      
      console.log('📱 PWA: Projects cached for status:', status, data.length);
    } catch (error) {
      console.warn('📱 PWA: Failed to cache projects:', error);
    }
  }

  // ✅ PWA: อ่านข้อมูลจาก localStorage
  private loadFromCache(status: ProjectStatus = 'active'): ProjectDDL[] | null {
    try {
      const cacheKey = `${this.CACHE_KEY}_${status}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const cacheEntry: CacheEntry<ProjectDDL[]> = JSON.parse(cached);
      const now = Date.now();
      
      // ✅ ตรวจสอบว่า cache หมดอายุหรือยัง
      const isExpired = now > cacheEntry.expiresAt;
      const isOffline = !this.isOnline();
      
      // ✅ ถ้าออฟไลน์ ให้ใช้ cache แม้หมดอายุแล้ว (แต่ไม่เกิน 24 ชั่วโมง)
      if (isOffline && (now - cacheEntry.timestamp) < this.OFFLINE_CACHE_DURATION) {
        console.log('📱 PWA: Using offline cache for projects (expired but offline)');
        return cacheEntry.data;
      }
      
      // ✅ ถ้าออนไลน์และยังไม่หมดอายุ
      if (!isExpired) {
        console.log('📱 PWA: Using valid cache for projects');
        return cacheEntry.data;
      }
      
      console.log('📱 PWA: Cache expired for projects');
      return null;
    } catch (error) {
      console.warn('📱 PWA: Failed to load cached projects:', error);
      return null;
    }
  }

  // ✅ PWA: โหลด cached data ตอนเริ่มต้น
  private loadCachedData(): void {
    const cachedData = this.loadFromCache('active');
    if (cachedData) {
      this.projectsCache$.next(cachedData);
      this.cacheTimestamp = Date.now();
    }
  }

  // ✅ PWA: ล้าง cache
  private clearCache(): void {
    try {
      const statuses: ProjectStatus[] = ['active', 'inactive', 'all'];
      statuses.forEach(status => {
        const cacheKey = `${this.CACHE_KEY}_${status}`;
        localStorage.removeItem(cacheKey);
      });
      
      this.projectsCache$.next([]);
      this.cacheTimestamp = 0;
      
      console.log('📱 PWA: Projects cache cleared');
    } catch (error) {
      console.warn('📱 PWA: Failed to clear projects cache:', error);
    }
  }

  // ✅ MAIN API METHOD with PWA Caching
  getProjectDDLWithCache(request: ProjectDDLRequest = { status: 'active' }): Observable<ProjectDDLResponse> {
    const status = request.status || 'active';
    
    // ✅ 1. ลองใช้ cache ก่อน (ถ้าไม่หมดอายุ)
    const cachedData = this.loadFromCache(status);
    if (cachedData) {
      return of({
        code: 1,
        message: 'Data from cache',
        data: cachedData,
        success: true
      });
    }

    // ✅ 2. ถ้าไม่มี cache หรือหมดอายุ ให้เรียก API
    return this.getProjectDDL(request).pipe(
      tap(response => {
        // ✅ 3. บันทึกผลลัพธ์ลง cache
        if (response.code === 1 && response.data) {
          this.saveToCache(response.data, status);
        }
      }),
      catchError(error => {
        console.error('📱 PWA: API failed, trying offline cache:', error);
        
        // ✅ 4. ถ้า API ล้มเหลว ลองใช้ offline cache
        const offlineData = this.loadFromCache(status);
        if (offlineData) {
          return of({
            code: 1,
            message: 'Data from offline cache',
            data: offlineData,
            success: true
          });
        }
        
        // ✅ 5. สุดท้าย ส่งกลับ error
        return throwError(() => error);
      })
    );
  }

  // ✅ PWA: ได้รับ cached data โดยตรง
  getCachedProjects(status: ProjectStatus = 'active'): Observable<ProjectDDL[]> {
    const cachedData = this.loadFromCache(status);
    
    if (cachedData) {
      return of(cachedData);
    }
    
    // ✅ ถ้าไม่มี cache ให้ส่งกลับ empty array
    return of([]);
  }

  // ✅ PWA: บังคับ refresh cache
  refreshCache(request: ProjectDDLRequest = { status: 'active' }): Observable<ProjectDDLResponse> {
    const status = request.status || 'active';
    
    // ✅ ล้าง cache เฉพาะ status นี้
    const cacheKey = `${this.CACHE_KEY}_${status}`;
    localStorage.removeItem(cacheKey);
    
    // ✅ เรียก API ใหม่
    return this.getProjectDDL(request).pipe(
      tap(response => {
        if (response.code === 1 && response.data) {
          this.saveToCache(response.data, status);
        }
      })
    );
  }

  // ✅ PWA: ตรวจสอบว่ามี cache หรือไม่
  hasCachedData(status: ProjectStatus = 'active'): boolean {
    const cachedData = this.loadFromCache(status);
    return cachedData !== null && cachedData.length > 0;
  }

  // ✅ PWA: ได้รับอายุของ cache
  getCacheAge(status: ProjectStatus = 'active'): number {
    try {
      const cacheKey = `${this.CACHE_KEY}_${status}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return 0;
      
      const cacheEntry: CacheEntry<ProjectDDL[]> = JSON.parse(cached);
      return Date.now() - cacheEntry.timestamp;
    } catch {
      return 0;
    }
  }

  // ✅ ORIGINAL API METHOD (เดิม)
  getProjectDDL(request: ProjectDDLRequest = { status: 'active' }): Observable<ProjectDDLResponse> {
    return this.http.post<ProjectDDLResponse>(`${this.apiUrl}/getProjectDDL`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      retry(2), // ลองใหม่ 2 ครั้งถ้าล้มเหลว
      catchError(this.handleError)
    );
  }

  // ✅ Convenience Methods
  getAllProjectsWithCache(): Observable<ProjectDDLResponse> {
    return this.getProjectDDLWithCache({ status: 'all' });
  }

  getActiveProjectsWithCache(): Observable<ProjectDDLResponse> {
    return this.getProjectDDLWithCache({ status: 'active' });
  }

  getInactiveProjectsWithCache(): Observable<ProjectDDLResponse> {
    return this.getProjectDDLWithCache({ status: 'inactive' });
  }

  // ✅ ORIGINAL Methods (สำหรับ backward compatibility)
  getAllProjects(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'all' });
  }

  getActiveProjects(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'active' });
  }

  getInactiveProjects(): Observable<ProjectDDLResponse> {
    return this.getProjectDDL({ status: 'inactive' });
  }

  // ✅ PWA Utility Methods
  
  /**
   * ✅ PWA: ตรวจสอบสถานะ cache
   */
  getCacheStatus(status: ProjectStatus = 'active'): {
    hasCache: boolean;
    isExpired: boolean;
    ageInMinutes: number;
    dataCount: number;
  } {
    const hasCache = this.hasCachedData(status);
    const ageMs = this.getCacheAge(status);
    const ageInMinutes = Math.floor(ageMs / (1000 * 60));
    const isExpired = ageMs > this.CACHE_DURATION;
    
    let dataCount = 0;
    if (hasCache) {
      const cachedData = this.loadFromCache(status);
      dataCount = cachedData?.length || 0;
    }
    
    return {
      hasCache,
      isExpired,
      ageInMinutes,
      dataCount
    };
  }

  /**
   * ✅ PWA: ได้รับสถิติ cache
   */
  getCacheStats(): {
    totalCacheSize: number;
    cacheKeys: string[];
    oldestCache: number;
    newestCache: number;
  } {
    const statuses: ProjectStatus[] = ['active', 'inactive', 'all'];
    const cacheKeys: string[] = [];
    let totalSize = 0;
    let oldestCache = Date.now();
    let newestCache = 0;
    
    statuses.forEach(status => {
      const cacheKey = `${this.CACHE_KEY}_${status}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        cacheKeys.push(cacheKey);
        totalSize += cached.length;
        
        try {
          const cacheEntry: CacheEntry<ProjectDDL[]> = JSON.parse(cached);
          oldestCache = Math.min(oldestCache, cacheEntry.timestamp);
          newestCache = Math.max(newestCache, cacheEntry.timestamp);
        } catch {
          // Ignore invalid cache entries
        }
      }
    });
    
    return {
      totalCacheSize: totalSize,
      cacheKeys,
      oldestCache: oldestCache === Date.now() ? 0 : oldestCache,
      newestCache
    };
  }

  /**
   * ✅ PWA: ล้าง cache ทั้งหมด
   */
  clearAllCache(): void {
    this.clearCache();
  }

  // ✅ Error Handling
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 0:
          errorMessage = 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ (ไม่มีอินเทอร์เน็ต)';
          break;
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
        case 503:
          errorMessage = 'เซิร์ฟเวอร์ไม่พร้อมให้บริการ';
          break;
        default:
          errorMessage = error.error?.message || `เซิร์ฟเวอร์ตอบกลับด้วยรหัสข้อผิดพลาด ${error.status}`;
      }
    }
    
    console.error('ProjectService Error:', {
      status: error.status,
      message: errorMessage,
      error: error.error,
      url: error.url
    });
    
    return throwError(() => errorMessage);
  }
}