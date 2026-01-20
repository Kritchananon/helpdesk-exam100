import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

// ✅ เพิ่ม imports ใหม่
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { permissionEnum } from '../../models/permission.model';
import { PERMISSION_DIRECTIVES } from '../../directives/permission.directive';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule,
    ...PERMISSION_DIRECTIVES
  ],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private subscriptions: Subscription[] = [];

  // ✅ Inject Services
  protected authService = inject(AuthService);
  protected languageService = inject(LanguageService);
  
  // ✅ Export permissionEnum เพื่อใช้ใน template
  protected readonly permissionEnum = permissionEnum;
  
  // State for dropdown menus
  isReportDropdownOpen = false;
  isSettingDropdownOpen = false;

  ngOnInit() {
    // Auto-open appropriate dropdown based on current route
    const routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateDropdownState(event.urlAfterRedirects || event.url);
      });
    
    this.subscriptions.push(routerSub);

    // Set initial dropdown state
    this.updateDropdownState(this.router.url);

    // Subscribe to language changes
    const langSub = this.languageService.currentLanguage$.subscribe(lang => {
      console.log('🌐 Sidebar language changed to:', lang);
    });
    
    this.subscriptions.push(langSub);
  }

  ngOnDestroy() {
    console.log('🧹 Sidebar cleanup');
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Update dropdown state based on current route
   */
  private updateDropdownState(url: string) {
    // Close all dropdowns first
    this.isReportDropdownOpen = false;
    this.isSettingDropdownOpen = false;

    // Open appropriate dropdown based on current route
    if (url.includes('/reports/')) {
      this.isReportDropdownOpen = true;
    } else if (url.includes('/settings/')) {
      this.isSettingDropdownOpen = true;
    }
  }

  /**
   * Toggle Report dropdown menu
   */
  toggleReportDropdown() {
    console.log('Toggling Report dropdown:', this.isReportDropdownOpen);
    this.isReportDropdownOpen = !this.isReportDropdownOpen;
    // Close other dropdowns
    if (this.isReportDropdownOpen) {
      this.isSettingDropdownOpen = false;
    }
  }

  /**
   * Toggle Setting dropdown menu
   */
  toggleSettingDropdown() {
    console.log('Toggling Setting dropdown:', this.isSettingDropdownOpen);
    this.isSettingDropdownOpen = !this.isSettingDropdownOpen;
    // Close other dropdowns
    if (this.isSettingDropdownOpen) {
      this.isReportDropdownOpen = false;
    }
  }

  /**
   * Close all dropdowns
   */
  closeAllDropdowns() {
    console.log('Closing all dropdowns');
    this.isReportDropdownOpen = false;
    this.isSettingDropdownOpen = false;
  }

  /**
   * Handle navigation and close dropdowns
   */
  navigateTo(route: string) {
    this.router.navigate([route]);
    this.closeAllDropdowns();
  }

  /**
   * Handle menu item click (prevents event bubbling)
   */
  onMenuItemClick(event: Event) {
    event.stopPropagation();
  }

  /**
   * Check if current route is active
   */
  isRouteActive(route: string): boolean {
    return this.router.url === route || this.router.url.startsWith(route + '/');
  }

  /**
   * Check if any child route is active (for parent menu highlighting)
   */
  isParentRouteActive(parentPath: string): boolean {
    return this.router.url.startsWith(parentPath);
  }

  /**
   * Check if settings route is active
   */
  isSettingsRouteActive(): boolean {
    const settingsRoutes = [
      '/settings/general',
      '/settings/user-account', 
      '/settings/project',
      '/settings/ticket-categories',
      '/settings/customers',
      '/settings/customer-for-project'
    ];
    return settingsRoutes.some(route => this.router.url.startsWith(route));
  }

  /**
   * Check if reports route is active
   */
  isReportsRouteActive(): boolean {
    const reportsRoutes = [
      '/reports/weekly',
      '/reports/monthly', 
      '/reports/export'
    ];
    return reportsRoutes.some(route => this.router.url.startsWith(route));
  }

  /**
   * Get translated text
   */
  t(key: string): string {
    return this.languageService.translate(key);
  }
}