// ===== language-selector.component.ts =====
import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { LanguageService, SupportedLanguage, LanguageConfig } from '../../services/language.service';

export type SelectorStyle = 'dropdown' | 'toggle' | 'button-group';
export type SelectorSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './language-selector.component.html',
  styleUrls: ['./language-selector.component.css']
})
export class LanguageSelectorComponent implements OnInit, OnDestroy {
  
  // ===== INPUT PROPERTIES ===== ✅
  
  /**
   * Style of the language selector
   * - 'dropdown': Bootstrap dropdown style
   * - 'toggle': Simple toggle button
   * - 'button-group': Button group style
   */
  @Input() style: SelectorStyle = 'dropdown';
  
  /**
   * Size of the selector
   */
  @Input() size: SelectorSize = 'md';
  
  /**
   * Show language name or just flag
   */
  @Input() showLanguageName: boolean = true;
  
  /**
   * Show flag emoji
   */
  @Input() showFlag: boolean = true;
  
  /**
   * Custom CSS class
   */
  @Input() customClass: string = '';
  
  /**
   * Show as button or link style
   */
  @Input() buttonStyle: 'primary' | 'secondary' | 'outline' | 'link' = 'outline';
  
  /**
   * Position of dropdown menu
   */
  @Input() dropdownPosition: 'start' | 'end' = 'end';
  
  /**
   * Accessible label
   */
  @Input() ariaLabel: string = 'Select Language';

  // ===== OUTPUT EVENTS ===== ✅
  
  /**
   * Emitted when language changes
   */
  @Output() languageChanged = new EventEmitter<SupportedLanguage>();

  // ===== COMPONENT STATE ===== ✅
  
  currentLanguage: SupportedLanguage = 'th';
  supportedLanguages: LanguageConfig[] = [];
  isDropdownOpen = false;
  
  private subscriptions: Subscription[] = [];

  constructor(private languageService: LanguageService) {}

  ngOnInit(): void {
    console.log('🌐 Language Selector initialized with style:', this.style);
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    console.log('🧹 Language Selector cleanup');
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ===== INITIALIZATION ===== ✅

  private initializeComponent(): void {
    // Get current language
    this.currentLanguage = this.languageService.getCurrentLanguage();
    
    // Get supported languages
    this.supportedLanguages = this.languageService.getSupportedLanguages();
    
    // Subscribe to language changes
    const langSub = this.languageService.currentLanguage$.subscribe(lang => {
      console.log('🌐 Language changed to:', lang);
      this.currentLanguage = lang;
    });
    
    this.subscriptions.push(langSub);
    
    console.log('✅ Language Selector ready:', {
      currentLanguage: this.currentLanguage,
      supportedLanguages: this.supportedLanguages.length,
      style: this.style
    });
  }

  // ===== LANGUAGE SWITCHING ===== ✅

  /**
   * Switch to specific language
   */
  switchLanguage(language: SupportedLanguage, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (language === this.currentLanguage) {
      console.log('ℹ️ Language already selected:', language);
      return;
    }

    console.log('🌐 Switching language to:', language);
    
    // Update language through service
    this.languageService.setLanguage(language);
    
    // Emit change event
    this.languageChanged.emit(language);
    
    // Close dropdown if open
    this.closeDropdown();
  }

  /**
   * Toggle between languages (for toggle style)
   */
  toggleLanguage(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.languageService.toggleLanguage();
    this.languageChanged.emit(this.languageService.getCurrentLanguage());
  }

  // ===== DROPDOWN MANAGEMENT ===== ✅

  /**
   * Toggle dropdown state
   */
  toggleDropdown(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.isDropdownOpen = !this.isDropdownOpen;
    console.log('📋 Dropdown toggled:', this.isDropdownOpen);
  }

  /**
   * Close dropdown
   */
  closeDropdown(): void {
    if (this.isDropdownOpen) {
      this.isDropdownOpen = false;
      console.log('📋 Dropdown closed');
    }
  }

  /**
   * Handle click outside to close dropdown
   */
  onClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    const dropdown = target.closest('.language-selector');
    
    if (!dropdown && this.isDropdownOpen) {
      this.closeDropdown();
    }
  }

  // ===== HELPER METHODS ===== ✅

  /**
   * Get current language configuration
   */
  getCurrentLanguageConfig(): LanguageConfig | undefined {
    return this.languageService.getLanguageConfig(this.currentLanguage);
  }

  /**
   * Get current language flag
   */
  getCurrentFlag(): string {
    return this.languageService.getCurrentFlag();
  }

  /**
   * Get current language name
   */
  getCurrentLanguageName(): string {
    return this.languageService.getCurrentLanguageName();
  }

  /**
   * Check if language is selected
   */
  isLanguageSelected(language: SupportedLanguage): boolean {
    return this.currentLanguage === language;
  }

  /**
   * Get button class based on style and size
   */
  getButtonClass(): string {
    const classes: string[] = ['btn'];
    
    // Add style class
    switch (this.buttonStyle) {
      case 'primary':
        classes.push('btn-primary');
        break;
      case 'secondary':
        classes.push('btn-secondary');
        break;
      case 'outline':
        classes.push('btn-outline-secondary');
        break;
      case 'link':
        classes.push('btn-link');
        break;
    }
    
    // Add size class
    switch (this.size) {
      case 'sm':
        classes.push('btn-sm');
        break;
      case 'lg':
        classes.push('btn-lg');
        break;
    }
    
    return classes.join(' ');
  }

  /**
   * Get dropdown menu class
   */
  getDropdownMenuClass(): string {
    const classes: string[] = ['dropdown-menu'];
    
    if (this.isDropdownOpen) {
      classes.push('show');
    }
    
    if (this.dropdownPosition === 'end') {
      classes.push('dropdown-menu-end');
    }
    
    return classes.join(' ');
  }

  /**
   * Get component wrapper class
   */
  getWrapperClass(): string {
    const classes: string[] = ['language-selector'];
    
    classes.push(`language-selector-${this.style}`);
    classes.push(`language-selector-${this.size}`);
    
    if (this.customClass) {
      classes.push(this.customClass);
    }
    
    return classes.join(' ');
  }

  // ===== ACCESSIBILITY ===== ✅

  /**
   * Get aria-label for language button
   */
  getLanguageAriaLabel(language: LanguageConfig): string {
    return `Switch to ${language.name} (${language.nativeName})`;
  }

  /**
   * Get aria-label for toggle button
   */
  getToggleAriaLabel(): string {
    const languageNames = this.supportedLanguages
      .map(lang => lang.nativeName)
      .join(' and ');
    return `Toggle between ${languageNames}`;
  }

  /**
   * Get aria-pressed state
   */
  getAriaPressed(language: SupportedLanguage): boolean {
    return this.isLanguageSelected(language);
  }

  /**
   * Handle keyboard navigation
   */
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isDropdownOpen) {
      this.closeDropdown();
      event.preventDefault();
    }
  }

  // ===== DEBUG METHODS ===== ✅

  /**
   * Log component state for debugging
   */
  debugState(): void {
    console.group('🌐 Language Selector Debug');
    console.log('Current Language:', this.currentLanguage);
    console.log('Supported Languages:', this.supportedLanguages);
    console.log('Style:', this.style);
    console.log('Size:', this.size);
    console.log('Dropdown Open:', this.isDropdownOpen);
    console.log('Show Name:', this.showLanguageName);
    console.log('Show Flag:', this.showFlag);
    console.groupEnd();
  }
}