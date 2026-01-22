import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type SupportedLanguage = 'th' | 'en';

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
  direction: 'ltr' | 'rtl';
}

export interface TranslationData {
  [key: string]: any;
}

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  // ✅ Supported Languages Configuration
  private readonly SUPPORTED_LANGUAGES: LanguageConfig[] = [
    {
      code: 'th',
      name: 'Thai',
      nativeName: 'ไทย',
      flag: '🇹🇭',
      direction: 'ltr'
    },
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      flag: '🇺🇸',
      direction: 'ltr'
    }
  ];

  private readonly DEFAULT_LANGUAGE: SupportedLanguage = 'th';
  private readonly STORAGE_KEY = 'app_language';

  // ✅ State Management
  private currentLanguageSubject: BehaviorSubject<SupportedLanguage>;
  public currentLanguage$: Observable<SupportedLanguage>;

  // ✅ NEW: เพิ่ม Subject สำหรับบอกสถานะการโหลดไฟล์ภาษา (แก้ปัญหา Race Condition)
  private translationsLoadedSubject = new BehaviorSubject<boolean>(false);
  public translationsLoaded$ = this.translationsLoadedSubject.asObservable();

  // ✅ Translation Cache
  private translations: Map<SupportedLanguage, TranslationData> = new Map();

  // ✅ NEW: Missing Keys Cache (ป้องกัน Log Error รัวๆ ใน Console)
  private missingKeysLog: Set<string> = new Set();

  constructor() {
    // Initialize with stored or default language
    const storedLanguage = this.getStoredLanguage();
    this.currentLanguageSubject = new BehaviorSubject<SupportedLanguage>(storedLanguage);
    this.currentLanguage$ = this.currentLanguageSubject.asObservable();

    console.log('🌐 Language Service initialized with language:', storedLanguage);
    
    // Load translations asynchronously
    this.loadTranslations(storedLanguage);
  }

  // ===== LANGUAGE MANAGEMENT ===== ✅

  /**
   * Get current language code
   */
  getCurrentLanguage(): SupportedLanguage {
    return this.currentLanguageSubject.value;
  }

  /**
   * Set current language
   */
  setLanguage(language: SupportedLanguage): void {
    if (!this.isLanguageSupported(language)) {
      language = this.DEFAULT_LANGUAGE;
    }

    const currentLang = this.currentLanguageSubject.value;
    
    // กรณีเลือกภาษาเดิม
    if (currentLang === language) {
      // ✅ ถ้าไฟล์โหลดเสร็จแล้ว ให้แจ้งเตือนอีกครั้งเพื่อให้ UI มั่นใจว่าพร้อม
      if (this.translations.has(language)) {
        this.translationsLoadedSubject.next(true);
      }
      return;
    }

    console.log('🌐 Changing language from', currentLang, 'to', language);

    // ✅ Reset missing keys log เมื่อเปลี่ยนภาษา
    this.missingKeysLog.clear();

    // Update state
    this.currentLanguageSubject.next(language);

    // Persist to storage
    this.saveLanguageToStorage(language);

    // Load translations logic
    if (!this.translations.has(language)) {
      // ถ้ายังไม่มีใน Cache ให้โหลดใหม่
      this.loadTranslations(language);
    } else {
      // ✅ ถ้ามี Cache แล้ว ให้แจ้งเตือนว่าโหลดเสร็จทันที (ไม่ต้องรอ fetch)
      this.translationsLoadedSubject.next(true);
    }

    // Broadcast change event
    this.broadcastLanguageChange(language);

    // Update document language attribute for accessibility
    this.updateDocumentLanguage(language);
  }

  /**
   * Toggle between languages (useful for quick switch)
   */
  toggleLanguage(): void {
    const current = this.getCurrentLanguage();
    const next: SupportedLanguage = current === 'th' ? 'en' : 'th';
    this.setLanguage(next);
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(language: string): language is SupportedLanguage {
    return this.SUPPORTED_LANGUAGES.some(lang => lang.code === language);
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): LanguageConfig[] {
    return [...this.SUPPORTED_LANGUAGES];
  }

  /**
   * Get language configuration
   */
  getLanguageConfig(language: SupportedLanguage): LanguageConfig | undefined {
    return this.SUPPORTED_LANGUAGES.find(lang => lang.code === language);
  }

  // ===== TRANSLATION METHODS ===== ✅

  /**
   * Get translation by key
   */
  translate(key: string, params?: { [key: string]: any }): string {
    const language = this.getCurrentLanguage();
    
    // ตรวจสอบว่าโหลดภาษาเสร็จหรือยัง ถ้ายังไม่เสร็จให้คืนค่า key ไปก่อน
    // เพื่อป้องกัน error ในขณะที่กำลังโหลด
    if (!this.translations.has(language)) {
      return key;
    }

    const translation = this.getTranslationByKey(key, language);

    if (!translation) {
      // Log warning แค่ครั้งเดียวต่อ key เพื่อไม่ให้รก Console
      const logKey = `${language}:${key}`;
      if (!this.missingKeysLog.has(logKey)) {
        console.warn(`⚠️ Translation not found for key: "${key}" (lang: ${language})`);
        this.missingKeysLog.add(logKey);
      }
      return key; // Return key as fallback
    }

    // Interpolate parameters if provided
    if (params) {
      return this.interpolate(translation, params);
    }

    return translation;
  }

  /**
   * Instant translation (alias for translate)
   */
  instant(key: string, params?: { [key: string]: any }): string {
    return this.translate(key, params);
  }

  /**
   * Get text based on current language
   */
  getText(thText: string, enText: string): string {
    return this.getCurrentLanguage() === 'th' ? thText : enText;
  }

  /**
   * Get translation for multiple keys at once
   */
  translateMultiple(keys: string[]): { [key: string]: string } {
    const result: { [key: string]: string } = {};
    keys.forEach(key => {
      result[key] = this.translate(key);
    });
    return result;
  }

  // ===== PRIVATE HELPER METHODS ===== ✅

  private getStoredLanguage(): SupportedLanguage {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored && this.isLanguageSupported(stored)) {
        return stored as SupportedLanguage;
      }
    } catch (error) {
      console.error('❌ Error reading language from storage:', error);
    }
    return this.detectBrowserLanguage();
  }

  private saveLanguageToStorage(language: SupportedLanguage): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, language);
    } catch (error) {
      console.error('❌ Error saving language to storage:', error);
    }
  }

  private detectBrowserLanguage(): SupportedLanguage {
    try {
      const browserLang = navigator.language.split('-')[0].toLowerCase();
      if (this.isLanguageSupported(browserLang)) {
        return browserLang as SupportedLanguage;
      }
    } catch (error) {
      console.error('❌ Error detecting browser language:', error);
    }
    return this.DEFAULT_LANGUAGE;
  }

  /**
   * Load translations from JSON files
   */
  private async loadTranslations(language: SupportedLanguage): Promise<void> {
    // ✅ ถ้ามี Cache แล้ว ให้แจ้งเตือนว่าโหลดเสร็จทันที
    if (this.translations.has(language)) {
      this.translationsLoadedSubject.next(true);
      return;
    }

    // ✅ แจ้งเตือนว่า "เริ่มโหลด" (สถานะเป็น false) เพื่อให้ UI รอ
    this.translationsLoadedSubject.next(false);

    try {
      const response = await fetch(`/assets/i18n/${language}.json`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TranslationData = await response.json();
      this.translations.set(language, data);
      console.log('✅ Translations loaded for:', language);
      
      // ✅ แจ้งเตือนว่า "โหลดเสร็จแล้ว" (สถานะเป็น true) UI จะเริ่มทำงานตอนนี้
      this.translationsLoadedSubject.next(true);
      
    } catch (error) {
      console.error(`❌ Error loading translations for ${language}:`, error);
      // ใส่ object ว่างเพื่อกันการโหลดซ้ำซ้อน
      this.translations.set(language, {});
      
      // ✅ แจ้งเตือนว่าจบกระบวนการ (แม้จะ Error) เพื่อให้ UI ไม่ค้างหน้า Loading
      this.translationsLoadedSubject.next(true);
    }
  }

  private getTranslationByKey(key: string, language: SupportedLanguage): string | null {
    const translations = this.translations.get(language);
    if (!translations) {
      return null;
    }

    const keys = key.split('.');
    let value: any = translations;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return typeof value === 'string' ? value : null;
  }

  private interpolate(text: string, params: { [key: string]: any }): string {
    let result = text;
    Object.keys(params).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(params[key]));
    });
    return result;
  }

  private broadcastLanguageChange(language: SupportedLanguage): void {
    const event = new CustomEvent('language-changed', {
      detail: { language, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }

  private updateDocumentLanguage(language: SupportedLanguage): void {
    try {
      document.documentElement.lang = language;
      const config = this.getLanguageConfig(language);
      if (config) {
        document.documentElement.dir = config.direction;
      }
    } catch (error) {
      console.error('❌ Error updating document language:', error);
    }
  }

  // ===== UTILITY METHODS ===== ✅
  
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    const language = this.getCurrentLanguage();
    const locale = language === 'th' ? 'th-TH' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, options).format(value);
    } catch (error) {
      return String(value);
    }
  }

  formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
    const language = this.getCurrentLanguage();
    const locale = language === 'th' ? 'th-TH' : 'en-US';
    try {
      const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      return new Intl.DateTimeFormat(locale, options).format(dateObj);
    } catch (error) {
      return String(date);
    }
  }

  formatCurrency(value: number, currency: string = 'THB'): string {
    const language = this.getCurrentLanguage();
    const locale = language === 'th' ? 'th-TH' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
      }).format(value);
    } catch (error) {
      return `${value} ${currency}`;
    }
  }

  getCurrentFlag(): string {
    const config = this.getLanguageConfig(this.getCurrentLanguage());
    return config?.flag || '🌐';
  }

  getCurrentLanguageName(): string {
    const config = this.getLanguageConfig(this.getCurrentLanguage());
    return config?.nativeName || 'Unknown';
  }

  isThaiLanguage(): boolean {
    return this.getCurrentLanguage() === 'th';
  }

  isEnglishLanguage(): boolean {
    return this.getCurrentLanguage() === 'en';
  }

  resetToDefault(): void {
    this.setLanguage(this.DEFAULT_LANGUAGE);
  }

  clearCache(): void {
    this.translations.clear();
    this.missingKeysLog.clear();
    const currentLang = this.getCurrentLanguage();
    this.loadTranslations(currentLang);
  }

  getDebugInfo(): any {
    return {
      currentLanguage: this.getCurrentLanguage(),
      supportedLanguages: this.SUPPORTED_LANGUAGES.map(l => l.code),
      cachedLanguages: Array.from(this.translations.keys()),
      missingKeysCount: this.missingKeysLog.size,
      loadingState: this.translationsLoadedSubject.value // Debug loading state
    };
  }
}