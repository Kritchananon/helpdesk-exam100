import { Component, OnInit, Input, Output, EventEmitter, OnDestroy, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ProjectService } from '../../services/project.service';
import { ProjectDDL, ProjectStatus, isProjectStatus } from '../../models/project.model';

@Component({
  selector: 'app-project-dropdown',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-dropdown.component.html',
  styleUrls: ['./project-dropdown.component.css']
})
export class ProjectDropdownComponent implements OnInit, OnDestroy, OnChanges {
  private projectService = inject(ProjectService);
  
  @Input() label: string = 'เลือกโปรเจค';
  @Input() placeholder: string = '-- เลือกโปรเจค --';
  @Input() selectedProjectId: number | string = '';
  @Input() status: string = 'active';
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;
  @Input() showCode: boolean = false;
  @Input() errorText: string = '';
  
  @Output() selectionChange = new EventEmitter<{
    project: ProjectDDL | null, 
    projectId: number | string
  }>();

  projects: ProjectDDL[] = [];
  loading = false;
  error: string = '';
  hasError = false;
  
  private destroy$ = new Subject<void>();
  private isDataLoaded = false; // ✅ ติดตามว่าโหลดข้อมูลเสร็จแล้วหรือยัง

  ngOnInit(): void {
    this.loadProjects();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ✅ เพิ่ม ngOnChanges เพื่อตรวจจับการเปลี่ยนแปลงของ @Input
  ngOnChanges(changes: SimpleChanges): void {
    // ตรวจสอบว่ามีการเปลี่ยนแปลง selectedProjectId หรือไม่
    if (changes['selectedProjectId']) {
      const currentValue = changes['selectedProjectId'].currentValue;
      const previousValue = changes['selectedProjectId'].previousValue;
      
      // ถ้าไม่ใช่ครั้งแรก และค่าเปลี่ยน
      if (!changes['selectedProjectId'].firstChange && currentValue !== previousValue) {
        console.log('🔄 Project ID changed:', previousValue, '->', currentValue);
        
        // ถ้าโหลดข้อมูลเสร็จแล้ว ให้ sync selection ทันที
        if (this.isDataLoaded && this.projects.length > 0) {
          this.syncSelection();
        }
      }
    }

    // ตรวจสอบว่ามีการเปลี่ยนแปลง status หรือไม่
    if (changes['status'] && !changes['status'].firstChange) {
      console.log('🔄 Status changed, reloading projects...');
      this.loadProjects();
    }
  }

  loadProjects(): void {
    this.loading = true;
    this.error = '';
    this.hasError = false;
    this.isDataLoaded = false; // ✅ รีเซ็ต flag

    // ✅ Fix: Type guard เพื่อให้แน่ใจว่า status เป็น ProjectStatus
    const statusValue: ProjectStatus = isProjectStatus(this.status) ? this.status : 'active';

    this.projectService.getProjectDDLWithCache({ status: statusValue })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Project DDL Response:', response);
          if (response.code === 1) {
            this.projects = response.data;
            this.error = '';
            this.isDataLoaded = true; // ✅ เซ็ต flag เมื่อโหลดเสร็จ

            // ✅ หลังจากโหลดเสร็จ ให้ sync selection ทันที
            this.syncSelection();
          } else {
            this.error = response.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
            this.projects = [];
          }
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading projects:', err);
          
          // ✅ PWA: ลองใช้ cached data ถ้า API ล้มเหลว
          this.projectService.getCachedProjects(statusValue)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (cachedData) => {
                if (cachedData && cachedData.length > 0) {
                  console.log('✅ Using cached projects:', cachedData.length);
                  this.projects = cachedData;
                  this.error = ''; // Clear error ถ้ามี cached data
                  this.isDataLoaded = true; // ✅ เซ็ต flag
                  this.showOfflineIndicator();
                  
                  // ✅ Sync selection หลังได้ cache data
                  this.syncSelection();
                } else {
                  this.error = typeof err === 'string' ? err : 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
                  this.projects = [];
                }
                this.loading = false;
              },
              error: () => {
                this.error = typeof err === 'string' ? err : 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้';
                this.projects = [];
                this.loading = false;
              }
            });
        }
      });
  }

  // ✅ Method ใหม่: Sync selection หลังจากโหลดข้อมูลเสร็จ
  private syncSelection(): void {
    if (!this.selectedProjectId || this.selectedProjectId === '') {
      return;
    }

    // ตรวจสอบว่า selectedProjectId มีอยู่ใน projects หรือไม่
    const selectedProject = this.projects.find(p => p.id === +this.selectedProjectId);
    
    if (selectedProject) {
      console.log('✅ Synced project selection:', this.selectedProjectId, selectedProject);
      
      // อัพเดท DOM โดยตรงเพื่อให้แน่ใจว่า dropdown แสดงค่าที่ถูกต้อง
      setTimeout(() => {
        const selectElement = document.getElementById('projectSelect') as HTMLSelectElement;
        if (selectElement) {
          selectElement.value = String(this.selectedProjectId);
        }
      }, 0);
    } else {
      console.warn('⚠️ Selected project ID not found in loaded projects:', this.selectedProjectId);
    }
  }

  private showOfflineIndicator(): void {
    // แสดง indicator ว่าใช้ cached data
    const offlineMsg = 'ใช้ข้อมูลที่เก็บไว้ (ออฟไลน์)';
    console.log('📱 PWA:', offlineMsg);
    
    // อาจจะแสดง toast notification หรือ indicator ใน UI
    setTimeout(() => {
      const event = new CustomEvent('pwa-offline-data', {
        detail: { component: 'project-dropdown', message: offlineMsg }
      });
      window.dispatchEvent(event);
    }, 100);
  }

  onSelectionChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const projectId = target.value;
    let selectedProject: ProjectDDL | null = null;
    
    if (projectId) {
      selectedProject = this.projects.find(p => p.id === +projectId) || null;
    }

    // Reset validation error when user selects something
    if (projectId && this.hasError) {
      this.hasError = false;
    }

    this.selectedProjectId = projectId;
    this.selectionChange.emit({
      project: selectedProject,
      projectId: projectId
    });
  }

  refresh(): void {
    this.loadProjects();
  }

  // Method สำหรับ validation จากภายนอก
  validate(): boolean {
    if (this.required && !this.selectedProjectId) {
      this.hasError = true;
      return false;
    }
    this.hasError = false;
    return true;
  }

  getProjectDisplayName(project: ProjectDDL): string {
    // รองรับทั้ง format จาก API ใหม่ (projectName) และ API เก่า (name)
    return project.projectName || project.name || 'Unknown Project';
  }

  // Method สำหรับ reset
  reset(): void {
    this.selectedProjectId = '';
    this.hasError = false;
    this.selectionChange.emit({
      project: null,
      projectId: ''
    });
  }

  // ✅ Method สำหรับ parent component เรียกเพื่อ force sync
  public forceSync(): void {
    if (this.isDataLoaded && this.projects.length > 0) {
      this.syncSelection();
    }
  }

  // Method สำหรับตรวจสอบว่ามี validation error จาก parent component หรือไม่
  get isInvalid(): boolean {
    return this.hasError;
  }
}