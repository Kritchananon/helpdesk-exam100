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

  // ✅ Translation Cache
  private translations: Map<SupportedLanguage, TranslationData> = new Map();

  // ✅ NEW: Missing Keys Cache (ป้องกัน Log รัวๆ)
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
      // console.warn(`⚠️ Language "${language}" is not supported. Falling back to ${this.DEFAULT_LANGUAGE}`);
      language = this.DEFAULT_LANGUAGE;
    }

    const currentLang = this.currentLanguageSubject.value;
    if (currentLang === language) {
      return;
    }

    console.log('🌐 Changing language from', currentLang, 'to', language);

    // ✅ Reset missing keys log when language changes
    this.missingKeysLog.clear();

    // Update state
    this.currentLanguageSubject.next(language);

    // Persist to storage
    this.saveLanguageToStorage(language);

    // Load translations if not cached
    if (!this.translations.has(language)) {
      this.loadTranslations(language);
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
   * @param key - Translation key (e.g., 'login.title')
   * @param params - Optional parameters for interpolation
   */
  translate(key: string, params?: { [key: string]: any }): string {
    const language = this.getCurrentLanguage();
    
    // ตรวจสอบว่าโหลดภาษาเสร็จหรือยัง ถ้ายังไม่เสร็จให้คืนค่า key ไปก่อนโดยไม่ Log Error
    if (!this.translations.has(language)) {
      return key;
    }

    const translation = this.getTranslationByKey(key, language);

    if (!translation) {
      // ✅ FIX: Log only once per key per session (ป้องกัน Console Flood)
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
   * @param thText - Thai text
   * @param enText - English text
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

  /**
   * Get stored language from localStorage
   */
  private getStoredLanguage(): SupportedLanguage {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored && this.isLanguageSupported(stored)) {
        return stored as SupportedLanguage;
      }
    } catch (error) {
      console.error('❌ Error reading language from storage:', error);
    }

    // Fallback to browser language or default
    return this.detectBrowserLanguage();
  }

  /**
   * Save language to localStorage
   */
  private saveLanguageToStorage(language: SupportedLanguage): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, language);
      // console.log('💾 Language saved to storage:', language); // ลด Log
    } catch (error) {
      console.error('❌ Error saving language to storage:', error);
    }
  }

  /**
   * Detect browser language
   */
  private detectBrowserLanguage(): SupportedLanguage {
    try {
      const browserLang = navigator.language.split('-')[0].toLowerCase();
      if (this.isLanguageSupported(browserLang)) {
        // console.log('🌐 Browser language detected:', browserLang);
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
    if (this.translations.has(language)) {
      return;
    }

    try {
      // console.log('📥 Loading translations for:', language);
      const response = await fetch(`/assets/i18n/${language}.json`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: TranslationData = await response.json();
      this.translations.set(language, data);
      console.log('✅ Translations loaded for:', language);
      
      // Force UI update check implies logs might reappear if cleared, but safely.
    } catch (error) {
      console.error(`❌ Error loading translations for ${language}:`, error);
      // Set empty object to prevent repeated failed attempts
      this.translations.set(language, {});
    }
  }

  /**
   * Get translation by key path (e.g., 'login.title')
   */
  private getTranslationByKey(key: string, language: SupportedLanguage): string | null {
    const translations = this.translations.get(language);
    if (!translations) {
      return null;
    }

    // Navigate nested object using key path
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

  /**
   * Interpolate parameters in translation string
   * Example: "Hello {{name}}" with params {name: "John"} => "Hello John"
   */
  private interpolate(text: string, params: { [key: string]: any }): string {
    let result = text;
    Object.keys(params).forEach(key => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, String(params[key]));
    });
    return result;
  }

  /**
   * Broadcast language change event
   */
  private broadcastLanguageChange(language: SupportedLanguage): void {
    const event = new CustomEvent('language-changed', {
      detail: { language, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }

  /**
   * Update document language attribute for accessibility
   */
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

  /**
   * Format number according to current language
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    const language = this.getCurrentLanguage();
    const locale = language === 'th' ? 'th-TH' : 'en-US';
    
    try {
      return new Intl.NumberFormat(locale, options).format(value);
    } catch (error) {
      console.error('❌ Error formatting number:', error);
      return String(value);
    }
  }

  /**
   * Format date according to current language
   */
  formatDate(date: Date | string | number, options?: Intl.DateTimeFormatOptions): string {
    const language = this.getCurrentLanguage();
    const locale = language === 'th' ? 'th-TH' : 'en-US';
    
    try {
      const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
      return new Intl.DateTimeFormat(locale, options).format(dateObj);
    } catch (error) {
      console.error('❌ Error formatting date:', error);
      return String(date);
    }
  }

  /**
   * Format currency according to current language
   */
  formatCurrency(value: number, currency: string = 'THB'): string {
    const language = this.getCurrentLanguage();
    const locale = language === 'th' ? 'th-TH' : 'en-US';
    
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
      }).format(value);
    } catch (error) {
      console.error('❌ Error formatting currency:', error);
      return `${value} ${currency}`;
    }
  }

  /**
   * Get current language flag emoji
   */
  getCurrentFlag(): string {
    const config = this.getLanguageConfig(this.getCurrentLanguage());
    return config?.flag || '🌐';
  }

  /**
   * Get current language native name
   */
  getCurrentLanguageName(): string {
    const config = this.getLanguageConfig(this.getCurrentLanguage());
    return config?.nativeName || 'Unknown';
  }

  /**
   * Check if current language is Thai
   */
  isThaiLanguage(): boolean {
    return this.getCurrentLanguage() === 'th';
  }

  /**
   * Check if current language is English
   */
  isEnglishLanguage(): boolean {
    return this.getCurrentLanguage() === 'en';
  }

  /**
   * Reset to default language
   */
  resetToDefault(): void {
    console.log('🔄 Resetting to default language:', this.DEFAULT_LANGUAGE);
    this.setLanguage(this.DEFAULT_LANGUAGE);
  }

  /**
   * Clear cached translations (useful for memory management)
   */
  clearCache(): void {
    console.log('🧹 Clearing translation cache');
    this.translations.clear();
    this.missingKeysLog.clear(); // Reset warnings too
    
    // Reload current language translations
    const currentLang = this.getCurrentLanguage();
    this.loadTranslations(currentLang);
  }

  // ===== DEBUG METHODS ===== ✅

  /**
   * Get debug information
   */
  getDebugInfo(): any {
    return {
      currentLanguage: this.getCurrentLanguage(),
      supportedLanguages: this.SUPPORTED_LANGUAGES.map(l => l.code),
      cachedLanguages: Array.from(this.translations.keys()),
      missingKeysCount: this.missingKeysLog.size,
      browserLanguage: navigator.language,
      documentLanguage: document.documentElement.lang,
      storageKey: this.STORAGE_KEY,
      defaultLanguage: this.DEFAULT_LANGUAGE
    };
  }

  /**
   * Log debug information to console
   */
  debugLog(): void {
    console.group('🌐 Language Service Debug Info');
    console.log('Debug Info:', this.getDebugInfo());
    console.log('Translations Cache:', this.translations);
    console.groupEnd();
  }
}