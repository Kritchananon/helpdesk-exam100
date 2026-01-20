/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideHttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { importProvidersFrom, isDevMode } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { AuthInterceptor } from './app/shared/services/api.service';

// ✅ Bootstrap application โดยตรง (แบบง่าย)
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    
    // ✅ เพิ่ม AuthInterceptor สำหรับจัดการ JWT token อัตโนมัติ
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    },
    
    // ✅ เพิ่ม FormsModule และ ReactiveFormsModule
    importProvidersFrom(FormsModule, ReactiveFormsModule)
  ]
}).then(() => {
  console.log('Application started successfully');
  
  // ✅ Manual Service Worker Registration (วิธีที่ปลอดภัยที่สุด)
  if (!isDevMode() && 'serviceWorker' in navigator) {
    // รอให้แอปโหลดเสร็จก่อน
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('ngsw-worker.js')
        .then(registration => {
          console.log('ServiceWorker registered successfully:', registration);
          
          // ตรวจสอบการอัปเดต
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New content is available; please refresh.');
                  // แสดง notification หรือ prompt ให้ user refresh
                  if (confirm('มีการอัปเดตใหม่ กรุณา refresh หน้าเพื่อใช้ฟีเจอร์ใหม่')) {
                    window.location.reload();
                  }
                }
              });
            }
          });
        })
        .catch(error => {
          console.log('ServiceWorker registration failed:', error);
        });
    });
  } else {
    console.log('ServiceWorker not supported or in development mode');
  }
}).catch(err => {
  console.error('Application bootstrap failed:', err);
});