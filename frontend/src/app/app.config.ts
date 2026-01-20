import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { routes } from './app.routes';
import { AuthInterceptor } from './shared/services/api.service';

// ✅ Import Permission Directives
import { PERMISSION_DIRECTIVES } from './shared/directives/permission.directive';

// ✅ Import Services (for dependency injection)
import { AuthService } from './shared/services/auth.service';
import { ApiService } from './shared/services/api.service';
import { NotificationService } from './shared/services/notification.service'; // ✅ NEW

export const appConfig: ApplicationConfig = {
  providers: [
    // ✅ Zone.js configuration for performance
    provideZoneChangeDetection({ eventCoalescing: true }),
    
    // ✅ Router configuration
    provideRouter(routes),
    
    // ✅ HTTP Client configuration
    provideHttpClient(
      withInterceptors([]) // ✅ Modern interceptor approach
    ),
    
    // ✅ Legacy HTTP Interceptor for backward compatibility
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    
    // ✅ Import FormsModule for template-driven forms
    importProvidersFrom(FormsModule),
    
    // ✅ Core Services (explicitly provided for better DI)
    AuthService,
    ApiService,
    NotificationService, // ✅ NEW: Register NotificationService
    
    // ✅ Permission Directives (available globally)
    ...PERMISSION_DIRECTIVES.map(directive => ({
      provide: directive,
      useClass: directive
    })),
    
    // ✅ หมายเหตุ: Service Worker จะถูกจัดการใน main.ts แทน
    // เพื่อหลีกเลี่ยงปัญหา import ใน development mode
  ]
};