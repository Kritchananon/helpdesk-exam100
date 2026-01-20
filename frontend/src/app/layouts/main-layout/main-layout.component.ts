import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, HeaderComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.css']
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  isMobileMenuOpen = false;

  ngOnInit(): void {
    // Add any initialization logic here
    this.setupEventListeners();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
    this.removeEventListeners();
  }

  // Listen for escape key to close mobile menu
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.isMobileMenuOpen) {
      this.closeMobileMenu();
    }
  }

  // Listen for window resize to handle responsive behavior
  @HostListener('window:resize', ['$event'])
  onResize(event: any): void {
    const width = event.target.innerWidth;
    
    // Close mobile menu when resizing to desktop
    if (width >= 768 && this.isMobileMenuOpen) {
      this.closeMobileMenu();
    }
  }

  toggleMobileMenu(): void {
    if (this.isMobileMenuOpen) {
      this.closeMobileMenu();
    } else {
      this.openMobileMenu();
    }
  }

  openMobileMenu(): void {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const body = document.body;
    
    if (sidebar) {
      sidebar.classList.add('show');
    }
    
    if (overlay) {
      overlay.classList.add('show');
    }
    
    // Prevent body scroll when mobile menu is open
    body.classList.add('mobile-menu-open');
    
    this.isMobileMenuOpen = true;
  }

  closeMobileMenu(): void {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.mobile-overlay');
    const body = document.body;
    
    if (sidebar) {
      sidebar.classList.remove('show');
    }
    
    if (overlay) {
      overlay.classList.remove('show');
    }
    
    // Restore body scroll
    body.classList.remove('mobile-menu-open');
    
    this.isMobileMenuOpen = false;
  }

  // Handle clicks outside sidebar on mobile
  onOverlayClick(event: Event): void {
    event.preventDefault();
    this.closeMobileMenu();
  }

  private setupEventListeners(): void {
    // Add any additional event listeners here
  }

  private removeEventListeners(): void {
    // Remove event listeners to prevent memory leaks
    const body = document.body;
    body.classList.remove('mobile-menu-open');
  }
}
