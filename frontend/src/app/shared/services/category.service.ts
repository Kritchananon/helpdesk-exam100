import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, of, BehaviorSubject } from 'rxjs';
import { catchError, retry, tap, switchMap, map } from 'rxjs/operators';
import { 
  CategoryDDL, 
  CategoryStatus, 
  CategoryDDLRequest, 
  CategoryDDLResponse
} from '../models/category.model';
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
export class CategoryService {
  private apiUrl = environment.apiUrl;
  
  // ✅ PWA Cache Management
  private readonly CACHE_KEY = 'pwa_categories_cache';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly OFFLINE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours for offline
  
  // ✅ Memory Cache
  private categoriesCache$ = new BehaviorSubject<CategoryDDL[]>([]);
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
  private saveToCache(data: CategoryDDL[], status: CategoryStatus = 'active'): void {
    try {
      const cacheData: CacheEntry<CategoryDDL[]> = {
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.CACHE_DURATION
      };
      
      const cacheKey = `${this.CACHE_KEY}_${status}`;
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      // ✅ อัปเดต memory cache
      this.categoriesCache$.next(data);
      this.cacheTimestamp = Date.now();
      
      console.log('📱 PWA: Categories cached for status:', status, data.length);
    } catch (error) {
      console.warn('📱 PWA: Failed to cache categories:', error);
    }
  }

  // ✅ PWA: อ่านข้อมูลจาก localStorage
  private loadFromCache(status: CategoryStatus = 'active'): CategoryDDL[] | null {
    try {
      const cacheKey = `${this.CACHE_KEY}_${status}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return null;
      
      const cacheEntry: CacheEntry<CategoryDDL[]> = JSON.parse(cached);
      const now = Date.now();
      
      // ✅ ตรวจสอบว่า cache หมดอายุหรือยัง
      const isExpired = now > cacheEntry.expiresAt;
      const isOffline = !this.isOnline();
      
      // ✅ ถ้าออฟไลน์ ให้ใช้ cache แม้หมดอายุแล้ว (แต่ไม่เกิน 24 ชั่วโมง)
      if (isOffline && (now - cacheEntry.timestamp) < this.OFFLINE_CACHE_DURATION) {
        console.log('📱 PWA: Using offline cache for categories (expired but offline)');
        return cacheEntry.data;
      }
      
      // ✅ ถ้าออนไลน์และยังไม่หมดอายุ
      if (!isExpired) {
        console.log('📱 PWA: Using valid cache for categories');
        return cacheEntry.data;
      }
      
      console.log('📱 PWA: Cache expired for categories');
      return null;
    } catch (error) {
      console.warn('📱 PWA: Failed to load cached categories:', error);
      return null;
    }
  }

  // ✅ PWA: โหลด cached data ตอนเริ่มต้น
  private loadCachedData(): void {
    const cachedData = this.loadFromCache('active');
    if (cachedData) {
      this.categoriesCache$.next(cachedData);
      this.cacheTimestamp = Date.now();
    }
  }

  // ✅ PWA: ล้าง cache
  private clearCache(): void {
    try {
      const statuses: CategoryStatus[] = ['active', 'inactive', 'all'];
      statuses.forEach(status => {
        const cacheKey = `${this.CACHE_KEY}_${status}`;
        localStorage.removeItem(cacheKey);
      });
      
      this.categoriesCache$.next([]);
      this.cacheTimestamp = 0;
      
      console.log('📱 PWA: Categories cache cleared');
    } catch (error) {
      console.warn('📱 PWA: Failed to clear categories cache:', error);
    }
  }

  // ✅ MAIN API METHOD with PWA Caching
  getCategoriesDDLWithCache(request: CategoryDDLRequest = { status: 'active' }): Observable<CategoryDDLResponse> {
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
    return this.getCategoriesDDL(request).pipe(
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
  getCachedCategories(status: CategoryStatus = 'active'): Observable<CategoryDDL[]> {
    const cachedData = this.loadFromCache(status);
    
    if (cachedData) {
      return of(cachedData);
    }
    
    // ✅ ถ้าไม่มี cache ให้ส่งกลับ empty array
    return of([]);
  }

  // ✅ PWA: บังคับ refresh cache
  refreshCache(request: CategoryDDLRequest = { status: 'active' }): Observable<CategoryDDLResponse> {
    const status = request.status || 'active';
    
    // ✅ ล้าง cache เฉพาะ status นี้
    const cacheKey = `${this.CACHE_KEY}_${status}`;
    localStorage.removeItem(cacheKey);
    
    // ✅ เรียก API ใหม่
    return this.getCategoriesDDL(request).pipe(
      tap(response => {
        if (response.code === 1 && response.data) {
          this.saveToCache(response.data, status);
        }
      })
    );
  }

  // ✅ PWA: ตรวจสอบว่ามี cache หรือไม่
  hasCachedData(status: CategoryStatus = 'active'): boolean {
    const cachedData = this.loadFromCache(status);
    return cachedData !== null && cachedData.length > 0;
  }

  // ✅ PWA: ได้รับอายุของ cache
  getCacheAge(status: CategoryStatus = 'active'): number {
    try {
      const cacheKey = `${this.CACHE_KEY}_${status}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) return 0;
      
      const cacheEntry: CacheEntry<CategoryDDL[]> = JSON.parse(cached);
      return Date.now() - cacheEntry.timestamp;
    } catch {
      return 0;
    }
  }

  // ✅ ORIGINAL API METHOD (เดิม)
  getCategoriesDDL(request: CategoryDDLRequest = { status: 'active' }): Observable<CategoryDDLResponse> {
    return this.http.post<CategoryDDLResponse>(`${this.apiUrl}/getCategoriesDDL`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      retry(2), // ลองใหม่ 2 ครั้งถ้าล้มเหลว
      catchError(this.handleError)
    );
  }

  // ✅ Convenience Methods
  getAllCategoriesWithCache(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDLWithCache({ status: 'all' });
  }

  getActiveCategoriesWithCache(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDLWithCache({ status: 'active' });
  }

  getInactiveCategoriesWithCache(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDLWithCache({ status: 'inactive' });
  }

  // ✅ ORIGINAL Methods (สำหรับ backward compatibility)
  getAllCategories(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'all' });
  }

  getActiveCategories(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'active' });
  }

  getInactiveCategories(): Observable<CategoryDDLResponse> {
    return this.getCategoriesDDL({ status: 'inactive' });
  }

  // ✅ PWA Utility Methods
  
  /**
   * ✅ PWA: ตรวจสอบสถานะ cache
   */
  getCacheStatus(status: CategoryStatus = 'active'): {
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
    const statuses: CategoryStatus[] = ['active', 'inactive', 'all'];
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
          const cacheEntry: CacheEntry<CategoryDDL[]> = JSON.parse(cached);
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
    
    console.error('CategoryService Error:', {
      status: error.status,
      message: errorMessage,
      error: error.error,
      url: error.url
    });
    
    return throwError(() => errorMessage);
  }
}