import { Component, OnInit, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, HostListener, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs';

// ✅ เพิ่มบรรทัดนี้ - import TicketData จาก ticket-detail component
import { TicketData } from '../ticket-detail.component';

// API Services
import {
  ApiService,
  StatusDDLItem,
  StatusDDLResponse,
  GetTicketDataRequest,    // ✅ เพิ่ม
  GetTicketDataResponse     // ✅ เพิ่ม
} from '../../../../shared/services/api.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { TicketService } from '../../../../shared/services/ticket.service';

// Business Hours Calculator
import { BusinessHoursCalculator } from '../../../../shared/services/business-hours-calculator.service';

// Models
import {
  SaveSupporterFormData,
  SaveSupporterResponse,
  TICKET_STATUS_IDS,
  canChangeStatus,
  statusIdToActionType,
  actionTypeToStatusId,
  PriorityDDLItem, // ✅ เพิ่ม
  PriorityDDLResponse // ✅ เพิ่ม
} from '../../../../shared/models/ticket.model';

import {
  SupporterFormState,
  FileUploadProgress,
  SupporterFormValidation
} from '../../../../shared/models/common.model';

import {
  AssignTicketPayload,
  AssignTicketResponse,
  Role9UsersResponse,
  UserListItem,
  getUserFullName,
} from '../../../../shared/models/user.model';

// ✅ เพิ่มบรรทัดนี้หลัง user.model import
import {
  permissionEnum // ✅ เพิ่มสำหรับตรวจสอบ ASSIGNEE permission
} from '../../../../shared/models/permission.model';

// Environment
import { environment } from '../../../../../environments/environment';

// import preview and list
import { FileListComponent } from '../../../../shared/components/file-list/file-list.component';
import { FilePreviewModalComponent } from '../../../../shared/components/file-preview-modal/file-preview-modal.component';

// ===== Fix Issue Attachment Interfaces =====
interface UploadFixIssueAttachmentResponse {
  success: boolean;
  message: string;
  data: {
    uploaded_files: Array<{
      id: number;
      filename: string;
      original_name: string;
      file_size: number;
      file_url: string;
      extension: string;
    }>;
    total_uploaded: number;
    total_files: number;
    errors?: Array<{
      filename: string;
      error: string;
    }>;
  };
}

// เพิ่ม interface สำหรับ existing attachments
interface ExistingAttachment {
  attachment_id: number;
  path: string;
  filename?: string;
  file_type?: string;
  file_size?: number;
  is_image?: boolean;
  preview_url?: string;
  download_url?: string;
}

// ===== 🆕 NEW: Support Form Persistence Interface =====
interface SupportFormPersistenceData {
  ticket_no: string;
  formData: {
    action: string;
    estimate_time: number | null;
    due_date: string;
    lead_time: number | null;
    close_estimate: string;
    fix_issue_description: string;
    related_ticket_id: string;
  };
  selectedAssigneeId: number | null;
  existingAttachments: ExistingAttachment[];
  timestamp: number;
  userId: number;
}

// Interfaces
interface ActionDropdownOption {
  value: string;
  label: string;
  statusId: number;
  disabled?: boolean;
}

@Component({
  selector: 'app-support-information-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    FileListComponent,
    FilePreviewModalComponent
  ],
  templateUrl: './support-information-form.component.html',
  styleUrls: ['./support-information-form.component.css'],
})
export class SupportInformationFormComponent implements OnInit, OnChanges, OnDestroy {
  estimateTime: number = 0;
  leadTime: number = 0;

  // ===== ✅ NEW: Role-Based Access Control (RBAC) Properties =====
  isAdmin: boolean = false;
  isSupporter: boolean = false;

  canEditAssignee = false;

  // === Drag & drop state ===
  isDraggingFiles = false;
  private dragCounter = 0; // helps with nested dragenter/leave

  // === Deletion state for existing attachments ===
  private deletingAttachmentIds = new Set<number>();

  isDeletingAttachment(id: number | null | undefined): boolean {
    return !!id && this.deletingAttachmentIds.has(id);
  }

  // Dependency Injection
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  public ticketService = inject(TicketService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  // ✅ NEW: Inject ChangeDetectorRef
  private cdr = inject(ChangeDetectorRef);

  // API URL
  public apiUrl = environment.apiUrl;

  // Business Hours Calculator
  private businessHoursCalculator: BusinessHoursCalculator;

  // Input Properties
  @Input() ticketData: TicketData | null = null;
  @Input() ticket_no: string = '';
  @Input() isLoadingTicketData: boolean = false;

  // Output Events
  @Output() supporterDataSaved = new EventEmitter<SaveSupporterResponse>();
  @Output() ticketAssigned = new EventEmitter<AssignTicketResponse>();
  @Output() refreshRequired = new EventEmitter<void>();

  // Component State
  isComponentInitialized = false;
  hasTicketDataChanged = false;

  // Form Properties
  supporterForm!: FormGroup;
  supporterFormState: SupporterFormState = {
    isVisible: true,
    isLoading: false,
    isSaving: false,
    error: null,
    successMessage: null
  };

  // Action Dropdown Properties
  actionDropdownOptions: ActionDropdownOption[] = [];
  statusList: StatusDDLItem[] = [];
  isLoadingActions = false;
  actionError = '';

  // Assignee Properties
  isLoadingAssignees: boolean = false;
  assigneeError: string = '';
  selectedAssigneeId: number | null = null;
  assigneeList: UserListItem[] = [];

  // ✅ เพิ่มบรรทัดนี้หลัง selectedAssigneeId
  private originalAssigneeId: number | null = null; // ✅ เก็บค่า assignee เดิมจาก ticket data

  // ✅ เพิ่มโค้ดนี้ทันทีหลัง Assignee Properties
  // ===== ✅ Priority Properties =====
  priorityDropdownOptions: PriorityDDLItem[] = [];
  isLoadingPriorities = false;
  priorityError = '';
  canUserChangePriority = false;

  // File Upload Properties
  selectedFiles: File[] = [];
  fileUploadProgress: FileUploadProgress[] = [];
  existingFixAttachments: ExistingAttachment[] = [];
  maxFiles = 5;
  maxFileSize = 10 * 1024 * 1024; // 10MB

  // File Preview URLs
  private filePreviewUrls: { [key: string]: string } = {};

  // Form Validation
  supporterFormValidation: SupporterFormValidation = {
    estimate_time: { isValid: true },
    due_date: { isValid: true },
    lead_time: { isValid: true },
    close_estimate: { isValid: true },
    fix_issue_description: { isValid: true },
    related_ticket_id: { isValid: true },
    attachments: { isValid: true }
  };

  // Permission Properties
  canUserSaveSupporter = false;

  // Enhanced Form State Management Properties
  justSaved = false;
  formDataBeforeRefresh: any = null;
  formStateSnapshot: any = null;
  isRefreshing = false;
  private formPersistenceKey = 'support-form-data';
  private lastFormSnapshot: any = null;
  private formChangeSubscription: any = null;

  // ===== 🆕 NEW: Persistence Properties =====
  private readonly PERSISTENCE_KEY_PREFIX = 'support_form_';
  private currentUserId: number | null = null;

  // ===== Fix Issue Attachment Properties =====
  isUploadingFixAttachment = false;
  fixAttachmentUploadError = '';

  // File Analysis Properties
  attachmentTypes: {
    [key: number]: {
      type: 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file';
      extension: string;
      filename: string;
      isLoading?: boolean;
      isAnalyzed?: boolean;
    }
  } = {};

  // ✅ NEW: Rich Text Editor Properties (เหมือนใน ticket-create)
  @ViewChild('fixIssueEditor') fixIssueEditor!: ElementRef;
  @ViewChild('richImgInput') richImgInput!: ElementRef;

  // ✅ Toolbar State (เหมือน Word)
  toolbarState = {
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: true,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    insertUnorderedList: false,
    insertOrderedList: false
  };

  constructor() {
    this.businessHoursCalculator = new BusinessHoursCalculator();
    this.initializeHolidays();
  }

  private initializeHolidays(): void {
    const holidays2025 = [
      new Date('2025-01-01'),
      new Date('2025-02-12'),
      new Date('2025-04-06'),
      new Date('2025-04-13'),
      new Date('2025-04-14'),
      new Date('2025-04-15'),
      new Date('2025-05-01'),
      new Date('2025-05-05'),
      new Date('2025-05-12'),
      new Date('2025-06-03'),
      new Date('2025-07-10'),
      new Date('2025-07-28'),
      new Date('2025-08-12'),
      new Date('2025-10-13'),
      new Date('2025-10-23'),
      new Date('2025-12-05'),
      new Date('2025-12-10'),
      new Date('2025-12-31'),
    ];

    this.businessHoursCalculator.setHolidays(holidays2025);
    console.log('Initialized holidays:', holidays2025.length, 'days');
  }

  ngOnInit(): void {
    console.log('SupportInformationFormComponent initialized');
    console.log('Initial ticketData:', this.ticketData);
    console.log('Initial ticket_no:', this.ticket_no);
    console.log('Initial isLoadingTicketData:', this.isLoadingTicketData);

    // ✅ ดึง userId
    this.currentUserId = this.authService.getCurrentUser()?.id || null;
    console.log('Current user ID:', this.currentUserId);

    this.initializeSupporterForm();
    this.checkUserPermissions();
    this.loadActionDropdownOptions();
    this.initializeAssigneeList();

    // ✅ เพิ่มบรรทัดนี้หลัง initializeAssigneeList()
    this.loadPriorityDropdownOptions(); // ✅ เพิ่ม

    // ✅ NEW: ลบการ restore persisted data ออก - ให้โหลดจาก ticket data เสมอ
    // this.restoreAllPersistedData(); // ❌ ลบบรรทัดนี้

    this.setupFormPersistence();
    this.setupAutoCalculation();

    // ✅ CRITICAL: ถ้ามี ticketData อยู่แล้ว ให้โหลดทันที
    if (this.ticketData?.ticket) {
      console.log('📋 Ticket data available, loading to form immediately');
      this.updateFormWithTicketData();
      this.loadExistingFixAttachments();
    } else if (this.ticket_no) {
      // ถ้ามีแค่ ticket_no ให้โหลดจาก backend
      console.log('📋 Only ticket_no available, loading from backend');
      this.loadTicketDataFromBackend();
    }

    this.isComponentInitialized = true;
    console.log('Form component initialization complete');

    // ✅ ตรวจสอบสิทธิ์การแก้ไข Assign
    const roleIds = this.authService.getCurrentUser()?.roleIds || [];
    this.canEditAssignee = roleIds.includes(19); // Admin(13)
    console.log('🔐 canEditAssignee:', this.canEditAssignee);

  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log('=== NgOnChanges Debug ===');
    console.log('Changes detected:', Object.keys(changes));

    // ✅ เพิ่ม: ตรวจสอบการเปลี่ยนแปลงของ ticket_no
    if (changes['ticket_no'] && this.isComponentInitialized) {
      const ticketNoChange = changes['ticket_no'];
      console.log('ticket_no changed:', {
        previousValue: ticketNoChange.previousValue,
        currentValue: ticketNoChange.currentValue,
        isFirstChange: ticketNoChange.isFirstChange()
      });

      // ถ้า ticket_no เปลี่ยนและไม่ใช่ครั้งแรก ให้โหลดข้อมูลใหม่
      if (!ticketNoChange.isFirstChange() && ticketNoChange.currentValue) {
        this.loadTicketDataFromBackend();
        return; // ออกจาก method เพื่อไม่ให้ทำงานซ้ำกับ ticketData changes
      }
    }

    if (changes['ticketData'] && this.isComponentInitialized) {
      const change = changes['ticketData'];
      console.log('TicketData change details:', {
        previousValue: !!change.previousValue?.ticket,
        currentValue: !!change.currentValue?.ticket,
        isFirstChange: change.isFirstChange(),
        justSaved: this.justSaved,
        isRefreshing: this.isRefreshing
      });

      if (!this.isRefreshing) {
        this.isRefreshing = true;
        this.hasTicketDataChanged = true;
        this.onTicketDataChanged();

        setTimeout(() => {
          this.isRefreshing = false;
        }, 100);
      }
    }

    if (changes['isLoadingTicketData']) {
      const loadingChange = changes['isLoadingTicketData'];
      console.log('Loading state changed:', {
        from: loadingChange.previousValue,
        to: loadingChange.currentValue
      });

      if (loadingChange.currentValue === true && !this.isRefreshing) {
        this.takeFormSnapshot();
      }
    }

    setTimeout(() => {
      console.log('🔍 Delayed check - ticketData:', this.ticketData);
      console.log('🔍 Delayed check - fix_attachment:', this.ticketData?.fix_attachment);

      if (this.ticketData?.fix_attachment) {
        console.log('✅ Found fix_attachment, loading...');
        this.loadExistingFixAttachments();
      } else {
        console.log('❌ No fix_attachment found');
      }
      
      // ✅ NEW: อัปเดต Editor Content อีกครั้ง (กรณีมีข้อมูล Ticket Data)
      if (this.fixIssueEditor?.nativeElement && this.ticketData?.ticket?.fix_issue_description) {
        console.log('📝 Setting Editor innerHTML from ticketData');
        this.fixIssueEditor.nativeElement.innerHTML = this.ticketData.ticket.fix_issue_description;
      }
    }, 500);
  }

  // 🆕 HostListener - บันทึกก่อนออกจากหน้า
  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: Event): void {
    if (this.hasFormData()) {
      this.persistAllFormData();
      console.log('💾 Form data saved before page unload');
    }
  }

  ngOnDestroy(): void {
    // 🆕 บันทึกข้อมูลก่อน destroy
    if (this.hasFormData()) {
      this.persistAllFormData();
    }

    // Revoke blob URLs
    Object.values(this.filePreviewUrls).forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    if (this.formChangeSubscription) {
      this.formChangeSubscription.unsubscribe();
    }
  }

  // ===== ✅ NEW: Rich Text Editor Logic =====

  /**
   * 1. เช็คสถานะปุ่ม (Active State)
   */
  checkToolbarStatus(): void {
    this.toolbarState.bold = document.queryCommandState('bold');
    this.toolbarState.italic = document.queryCommandState('italic');
    this.toolbarState.underline = document.queryCommandState('underline');
    this.toolbarState.insertUnorderedList = document.queryCommandState('insertUnorderedList');
    this.toolbarState.insertOrderedList = document.queryCommandState('insertOrderedList');
    this.toolbarState.justifyLeft = document.queryCommandState('justifyLeft');
    this.toolbarState.justifyCenter = document.queryCommandState('justifyCenter');
    this.toolbarState.justifyRight = document.queryCommandState('justifyRight');
    this.toolbarState.justifyFull = document.queryCommandState('justifyFull');

    // Default to justifyLeft if no other alignment is active
    if (!this.toolbarState.justifyCenter && !this.toolbarState.justifyRight && !this.toolbarState.justifyFull) {
      this.toolbarState.justifyLeft = true;
    }
    this.cdr.detectChanges(); // Force update UI after state change
  }

  /**
   * 2. จัดรูปแบบข้อความ
   */
  formatText(command: string): void {
    document.execCommand(command, false);
    this.checkToolbarStatus();
    this.updateFormContent();
  }

  insertList(ordered: boolean): void {
    const command = ordered ? 'insertOrderedList' : 'insertUnorderedList';
    document.execCommand(command, false);
    this.checkToolbarStatus();
    this.updateFormContent();
  }

  insertLink(): void {
    // Note: ใช้ prompt ง่ายๆ แทน UI Complex
    const url = prompt('Enter the URL:'); 
    if (url) {
      document.execCommand('createLink', false, url);
      this.checkToolbarStatus();
      this.updateFormContent();
    }
  }
  
  /**
   * 3. จัดการ event ต่างๆ จาก Editor (click, keyup, mouseup)
   */
  onEditorEvent(): void {
    this.checkToolbarStatus();
  }

  /**
   * 4. จัดการ Input และอัปเดต Form Control
   */
  onDescriptionInput(event: Event): void {
    const target = event.target as HTMLElement;
    // ใช้ innerHTML เพื่อเก็บ rich text content
    const content = target.innerHTML;
    this.supporterForm.patchValue({ fix_issue_description: content });
    this.checkToolbarStatus();

    // Check validation for error message (optional, but good practice)
    if (content && content.trim().length >= 1) {
      this.supporterFormValidation.fix_issue_description = { isValid: true };
    }
  }

  /**
   * 5. Helper สำหรับดึง HTML content ไปใส่ใน Form Control
   */
  private updateFormContent(): void {
    if (this.fixIssueEditor && this.fixIssueEditor.nativeElement) {
      this.supporterForm.patchValue({ fix_issue_description: this.fixIssueEditor.nativeElement.innerHTML }, { emitEvent: false });
    }
  }

  /**
   * 6. จัดการอัปโหลดรูปภาพ (ใช้ Base64 Data URL)
   */
  onRichTextConfigImage(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: any) => {
        document.execCommand('insertImage', false, e.target.result);
        this.updateFormContent();
      };
      reader.readAsDataURL(file);
    }
    event.target.value = ''; // Reset input
  }

  // ===== End Rich Text Editor Logic =====

  // ===== 🆕 NEW: Persistence Methods (Section 1) =====

  /**
   * 🆕 โหลดข้อมูลทั้งหมดที่เก็บไว้
   */
  private restoreAllPersistedData(): void {
    try {
      if (!this.ticket_no || !this.currentUserId) {
        console.log('Cannot restore: no ticket_no or userId');
        return;
      }

      const storageKey = this.getStorageKey();
      const savedDataStr = localStorage.getItem(storageKey);

      if (!savedDataStr) {
        console.log('No persisted data found for ticket:', this.ticket_no);
        return;
      }

      const savedData: SupportFormPersistenceData = JSON.parse(savedDataStr);

      // ตรวจสอบความเก่าของข้อมูล
      const age = Date.now() - savedData.timestamp;
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      if (age > maxAge) {
        console.log('Persisted data too old, removing');
        localStorage.removeItem(storageKey);
        return;
      }

      // ตรวจสอบว่าเป็น ticket เดียวกันและ user เดียวกัน
      if (savedData.ticket_no !== this.ticket_no || savedData.userId !== this.currentUserId) {
        console.log('Persisted data for different ticket or user');
        return;
      }

      console.log('✅ Restoring persisted support form data:', savedData);

      // Restore form data
      if (savedData.formData) {
        this.supporterForm.patchValue(savedData.formData, { emitEvent: false });

        // Restore calculated values
        if (savedData.formData.estimate_time) {
          this.estimateTime = savedData.formData.estimate_time;
        }
        if (savedData.formData.lead_time) {
          this.leadTime = savedData.formData.lead_time;
        }

        // ✅ NEW: Restore rich editor content
        if (this.fixIssueEditor?.nativeElement && savedData.formData.fix_issue_description) {
          this.fixIssueEditor.nativeElement.innerHTML = savedData.formData.fix_issue_description;
        }
      }

      // Restore assignee selection
      if (savedData.selectedAssigneeId) {
        this.selectedAssigneeId = savedData.selectedAssigneeId;
      }

      // Restore existing attachments info
      if (savedData.existingAttachments && savedData.existingAttachments.length > 0) {
        this.existingFixAttachments = savedData.existingAttachments;
        // วิเคราะห์ไฟล์ที่เก็บไว้
        setTimeout(() => {
          this.analyzeAllExistingAttachments();
        }, 100);
      }

      console.log('✅ Support form data restored successfully');

    } catch (error) {
      console.error('Error restoring persisted data:', error);
      // ลบข้อมูลที่เสียหาย
      if (this.ticket_no && this.currentUserId) {
        localStorage.removeItem(this.getStorageKey());
      }
    }
  }

  /**
 * 🆕 บันทึกข้อมูลทั้งหมดลง LocalStorage
 * ⚠️ เปลี่ยนเป็น public เพราะถูกเรียกจาก template
 */
  public persistAllFormData(): void {  // ✅ เปลี่ยนจาก private เป็น public
    try {
      if (!this.ticket_no || !this.currentUserId) {
        console.log('Cannot persist: no ticket_no or userId');
        return;
      }

      if (!this.hasFormData()) {
        // ถ้าไม่มีข้อมูลในฟอร์ม ให้ลบที่เก็บไว้
        localStorage.removeItem(this.getStorageKey());
        console.log('🗑️ Removed empty form data from storage');
        return;
      }

      const dataToSave: SupportFormPersistenceData = {
        ticket_no: this.ticket_no,
        formData: {
          action: this.supporterForm.value.action || '',
          estimate_time: this.estimateTime || this.supporterForm.value.estimate_time,
          due_date: this.supporterForm.value.due_date || '',
          lead_time: this.leadTime || this.supporterForm.value.lead_time,
          close_estimate: this.supporterForm.value.close_estimate || '',
          fix_issue_description: this.supporterForm.value.fix_issue_description || '',
          related_ticket_id: this.supporterForm.value.related_ticket_id || ''
        },
        selectedAssigneeId: this.selectedAssigneeId,
        existingAttachments: this.existingFixAttachments || [],
        timestamp: Date.now(),
        userId: this.currentUserId
      };

      const storageKey = this.getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));

      console.log('💾 Support form data persisted:', {
        ticket_no: this.ticket_no,
        hasFormData: true,
        timestamp: new Date(dataToSave.timestamp).toLocaleString()
      });

    } catch (error) {
      console.error('❌ Error persisting form data:', error);
      // ถ้า localStorage เต็ม ให้ลบข้อมูลเก่า
      this.cleanupOldPersistedData();
    }
  }

  /**
   * 🆕 สร้าง storage key ที่ unique
   */
  private getStorageKey(): string {
    return `${this.PERSISTENCE_KEY_PREFIX}${this.ticket_no}_${this.currentUserId}`;
  }

  /**
   * 🆕 ลบข้อมูลเก่าที่ไม่ใช้แล้ว
   */
  private cleanupOldPersistedData(): void {
    try {
      const keysToRemove: string[] = [];
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.PERSISTENCE_KEY_PREFIX)) {
          try {
            const dataStr = localStorage.getItem(key);
            if (dataStr) {
              const data: SupportFormPersistenceData = JSON.parse(dataStr);
              const age = Date.now() - data.timestamp;

              if (age > maxAge) {
                keysToRemove.push(key);
              }
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('🗑️ Removed old persisted data:', key);
      });

      if (keysToRemove.length > 0) {
        console.log(`✅ Cleaned up ${keysToRemove.length} old storage entries`);
      }

    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }

  /**
   * 🆕 ตรวจสอบว่ามีข้อมูลที่บันทึกไว้สำหรับ ticket นี้หรือไม่
   */
  private hasPersistedDataForCurrentTicket(): boolean {
    if (!this.ticket_no || !this.currentUserId) {
      return false;
    }

    const storageKey = this.getStorageKey();
    const savedDataStr = localStorage.getItem(storageKey);

    if (!savedDataStr) {
      return false;
    }

    try {
      const savedData: SupportFormPersistenceData = JSON.parse(savedDataStr);
      return savedData.ticket_no === this.ticket_no &&
        savedData.userId === this.currentUserId;
    } catch {
      return false;
    }
  }

  /**
 * 🆕 ดูข้อมูลที่บันทึกไว้ทั้งหมด (สำหรับ debug)
 * ⚠️ เป็น public เพราะถูกเรียกจาก template
 */
  public getPersistedDataInfo(): any {  // ✅ เปลี่ยนจาก private เป็น public (ถ้ายังไม่ได้เปลี่ยน)
    if (!this.ticket_no || !this.currentUserId) {
      return null;
    }

    const storageKey = this.getStorageKey();
    const savedDataStr = localStorage.getItem(storageKey);

    if (!savedDataStr) {
      return null;
    }

    try {
      const savedData: SupportFormPersistenceData = JSON.parse(savedDataStr);
      return {
        ticket_no: savedData.ticket_no,
        userId: savedData.userId,
        hasFormData: !!savedData.formData,
        hasAssignee: !!savedData.selectedAssigneeId,
        attachmentCount: savedData.existingAttachments?.length || 0,
        timestamp: new Date(savedData.timestamp).toLocaleString(),
        ageInMinutes: Math.floor((Date.now() - savedData.timestamp) / (1000 * 60))
      };
    } catch {
      return null;
    }
  }

  // ===== Backend Data Loading Methods (✅ ส่วนใหม่) =====

  /**
 * 🔄 โหลดข้อมูล ticket จาก backend API
 * ⚠️ เปลี่ยนเป็น public เพื่อให้เรียกจาก debug button ได้
 */
  public loadTicketDataFromBackend(): void {  // ✅ เปลี่ยนจาก private เป็น public
    if (!this.ticket_no) {
      console.warn('No ticket_no provided');
      return;
    }

    this.isLoadingTicketData = true;
    this.supporterFormState.error = null;

    const request: GetTicketDataRequest = {
      ticket_no: this.ticket_no
    };

    console.log('📥 Loading ticket data from backend:', request);

    this.apiService.getTicketData(request).subscribe({
      next: (response: GetTicketDataResponse) => {
        console.log('✅ Loaded ticket data from backend:', response);

        if (response.code === 1 && response.data) {
          this.ticketData = this.transformBackendTicketData(response.data);

          console.log('📦 Transformed ticket data:', this.ticketData);

          // โหลด existing fix attachments
          this.loadExistingFixAttachments();

          // 🆕 ตรวจสอบว่ามีข้อมูลที่บันทึกไว้หรือไม่
          const hasPersistedData = this.hasPersistedDataForCurrentTicket();

          if (hasPersistedData) {
            console.log('📂 Found persisted data, restoring...');
            this.restoreAllPersistedData();
          } else {
            console.log('📝 No persisted data, loading from ticket');
            this.updateFormWithTicketData();
          }

        } else {
          console.warn('⚠️ Backend returned error:', response.message);
          this.supporterFormState.error = response.message || 'ไม่สามารถโหลดข้อมูล ticket ได้';
        }
      },
      error: (error) => {
        console.error('❌ Error loading ticket data:', error);
        this.supporterFormState.error = 'เกิดข้อผิดพลาดในการโหลดข้อมูล ticket';

        // 🆕 ลองโหลดจาก persisted data
        const hasPersistedData = this.hasPersistedDataForCurrentTicket();
        if (hasPersistedData) {
          console.log('📂 Loading from persisted data due to API error');
          this.restoreAllPersistedData();
        }
      },
      complete: () => {
        this.isLoadingTicketData = false;
        console.log('✅ Ticket data loading complete');
      }
    });
  }

  /**
   * ✅ NEW: แปลงข้อมูลจาก backend API response เป็น format ของ component
   */
  private transformBackendTicketData(backendData: any): TicketData {
    console.log('🔄 Transforming backend data:', backendData);

    return {
      ticket: backendData.ticket || null,
      issue_attachment: backendData.issue_attachment || [],
      fix_attachment: backendData.fix_attachment || [],
      status_history: backendData.status_history || [],
      assign: backendData.assign || []
    };
  }

  /**
   * ✅ NEW: รีเฟรช ticket data จาก backend
   */
  private refreshTicketData(): void {
    console.log('🔄 Refreshing ticket data from backend');
    this.loadTicketDataFromBackend();
  }

  // ===== Public Methods for Parent Component (✅ ส่วนใหม่) =====

  /**
   * ✅ NEW: โหลดข้อมูล ticket ใหม่จาก backend (เรียกจาก parent component)
   * @param ticketNo - หมายเลข ticket ที่ต้องการโหลด
   */
  public loadTicket(ticketNo: string): void {
    console.log('📥 Loading ticket:', ticketNo);
    this.ticket_no = ticketNo;
    this.loadTicketDataFromBackend();
  }

  /**
   * ✅ NEW: รีเฟรช ticket data ปัจจุบัน (เรียกจาก parent component)
   */
  public refreshCurrentTicket(): void {
    console.log('🔄 Refreshing current ticket');
    if (this.ticket_no) {
      this.refreshTicketData();
    } else {
      console.warn('⚠️ No ticket_no available to refresh');
    }
  }

  /**
   * ✅ NEW: ดึงสถานะการโหลด
   */
  public isLoading(): boolean {
    return this.isLoadingTicketData;
  }

  /**
   * ✅ NEW: ดึงข้อมูล ticket ปัจจุบัน
   */
  public getCurrentTicketData(): TicketData | null {
    return this.ticketData;
  }

  /**
   * ✅ NEW: ตรวจสอบว่ามีข้อมูล ticket หรือไม่
   */
  public hasTicketData(): boolean {
    return !!this.ticketData?.ticket;
  }

  // ===== Fix Issue Attachment Methods =====

  /**
   * อัปโหลดไฟล์แนบ fix issue
   */
  private async uploadFixIssueAttachments(ticketId: number, files: File[]): Promise<boolean> {
    if (!files || files.length === 0) return true;

    try {
      this.isUploadingFixAttachment = true;
      this.fixAttachmentUploadError = '';

      const formData = new FormData();
      formData.append('ticket_id', ticketId.toString());
      files.forEach(file => formData.append('files', file));

      const token = this.authService.getToken();
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`
      });

      const response = await this.http.patch<UploadFixIssueAttachmentResponse>(
        `${this.apiUrl}/fix_issue/attachment`,
        formData,
        { headers }
      ).toPromise();

      if (response && response.success) {
        console.log('✅ Fix attachments uploaded:', response.data.total_uploaded, 'files');

        if (response.data.errors && response.data.errors.length > 0) {
          console.warn('Upload errors:', response.data.errors);
        }

        return true;
      } else {
        this.fixAttachmentUploadError = response?.message || 'ไม่สามารถอัปโหลดไฟล์ได้';
        return false;
      }

    } catch (error: any) {
      console.error('Error uploading fix attachments:', error);
      this.fixAttachmentUploadError = error?.error?.message || 'เกิดข้อผิดพลาดในการอัปโหลด';
      return false;

    } finally {
      this.isUploadingFixAttachment = false;
    }
  }

  /**
   * โหลด existing attachments และวิเคราะห์ไฟล์
   */
  private loadExistingFixAttachments(): void {
    if (!this.ticketData?.fix_attachment) {
      this.existingFixAttachments = [];
      return;
    }

    console.log('=== Fix Attachment Data ===');
    console.log('API URL:', this.apiUrl);
    console.log('Raw fix_attachment data:', this.ticketData.fix_attachment);

    this.existingFixAttachments = this.ticketData.fix_attachment.map(att => {
      console.log('Processing attachment:', att);

      // ✅ Backend ส่ง path มาเป็น full URL หรือ relative path
      let previewUrl: string | undefined = undefined;
      let isImage = false;

      // ตรวจสอบ extension
      const extension = att.filename
        ? att.filename.split('.').pop()?.toLowerCase()
        : att.path.split('.').pop()?.toLowerCase();

      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
      isImage = imageExtensions.includes(extension || '');

      // ✅ สร้าง preview URL
      if (isImage) {
        // ถ้า path เป็น absolute URL ใช้เลย
        if (att.path.startsWith('http://') || att.path.startsWith('https://')) {
          previewUrl = att.path;
        } else {
          // ถ้าเป็น relative path ให้ใส่ apiUrl ข้างหน้า
          previewUrl = `${this.apiUrl}${att.path.startsWith('/') ? '' : '/'}${att.path}`;
        }
      }

      const mappedAttachment: ExistingAttachment = {
        ...att,
        is_image: isImage,
        preview_url: previewUrl,
        download_url: this.getAttachmentDownloadUrl(att)
      };

      console.log('Mapped attachment:', mappedAttachment);
      return mappedAttachment;
    });

    console.log('✅ Loaded existing fix attachments:', this.existingFixAttachments.length, 'files');

    // วิเคราะห์ไฟล์ทั้งหมด
    setTimeout(() => {
      this.analyzeAllExistingAttachments();
    }, 100);
  }

  /**
   * ได้รับ URL สำหรับดาวน์โหลด attachment
   */
  getAttachmentDownloadUrl(attachment: any): string {
    if (!attachment || !attachment.path) {
      return '#';
    }

    const path = attachment.path;

    // ถ้า path เป็น full URL อยู่แล้ว (ขึ้นต้นด้วย http:// หรือ https://)
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // ถ้า path เป็น data URL
    if (path.startsWith('data:')) {
      return path;
    }

    // ถ้าเป็น relative path ให้เพิ่ม apiUrl
    return `${this.apiUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  /**
   * วิเคราะห์ไฟล์ existing attachments ทั้งหมด
   */
  private analyzeAllExistingAttachments(): void {
    if (!this.existingFixAttachments || this.existingFixAttachments.length === 0) {
      console.log('No existing attachments to analyze');
      return;
    }

    console.log('🔍 Starting analysis of existing attachments:', this.existingFixAttachments.length);

    this.existingFixAttachments.forEach((attachment, index) => {
      console.log(`🔍 Analyzing attachment ${index + 1}:`, {
        id: attachment.attachment_id,
        path: attachment.path,
        filename: attachment.filename
      });

      this.analyzeExistingAttachment(attachment);
    });
  }

  /**
   * วิเคราะห์ไฟล์ existing attachment แต่ละไฟล์
   */
  private async analyzeExistingAttachment(attachment: any): Promise<void> {
    if (!attachment || !attachment.attachment_id) {
      console.warn('Invalid attachment data:', attachment);
      return;
    }

    const attachmentId = attachment.attachment_id;

    if (this.attachmentTypes[attachmentId]?.isAnalyzed) {
      console.log('✅ Attachment already analyzed:', attachmentId);
      return;
    }

    this.attachmentTypes[attachmentId] = {
      type: 'file',
      extension: '',
      filename: 'Loading...',
      isLoading: true,
      isAnalyzed: false
    };

    try {
      // ✅ เรียก API เพื่อดึงข้อมูลไฟล์จริง
      const response = await fetch(attachment.path, { method: 'HEAD' });
      const contentDisposition = response.headers.get('Content-Disposition');
      const contentType = response.headers.get('Content-Type') || '';

      let realFilename = `attachment_${attachmentId}`;

      // ดึงชื่อไฟล์จริงจาก Content-Disposition header
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          realFilename = filenameMatch[1].replace(/['"]/g, '');
          realFilename = decodeURIComponent(realFilename);
        }
      }

      const extension = this.getFileExtensionHelper(realFilename) ||
        this.getExtensionFromMimeType(contentType);

      this.attachmentTypes[attachmentId] = {
        type: this.determineFileCategoryByMimeType(contentType),
        extension: extension,
        filename: realFilename,
        isLoading: false,
        isAnalyzed: true
      };

      console.log('✅ File analyzed from HTTP headers:', {
        id: attachmentId,
        contentType,
        filename: realFilename,
        category: this.attachmentTypes[attachmentId].type
      });

    } catch (error) {
      console.error('Error analyzing attachment:', error);

      // Fallback
      this.attachmentTypes[attachmentId] = {
        type: 'file',
        extension: '',
        filename: `attachment_${attachmentId}`,
        isLoading: false,
        isAnalyzed: true
      };
    }
  }

  /**
   * แปลง MIME type เป็น file extension
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'application/json': 'json',
      'application/zip': 'zip',
      'application/x-rar-compressed': 'rar'
    };

    return mimeMap[mimeType.toLowerCase()] || '';
  }

  /**
   * กำหนดประเภทไฟล์จาก MIME type
   */
  private determineFileCategoryByMimeType(mimeType: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const type = mimeType.toLowerCase();

    if (type.startsWith('image/')) return 'image';
    if (type === 'application/pdf') return 'pdf';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'excel';
    if (type.includes('word') || type.includes('document')) return 'word';
    if (type.startsWith('text/')) return 'text';
    if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return 'archive';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';

    return 'file';
  }

  /**
   * แยกชื่อไฟล์จาก path
   */
  private extractFilenameFromPath(path: string): string {
    if (!path || typeof path !== 'string') {
      console.warn('Invalid path provided:', path);
      return 'unknown';
    }

    try {
      if (path.startsWith('data:')) {
        return 'data_file';
      }

      const parts = path.split('/');
      const lastPart = parts[parts.length - 1];
      const cleanFilename = lastPart.split('?')[0];

      try {
        return decodeURIComponent(cleanFilename) || 'unknown';
      } catch {
        return cleanFilename || 'unknown';
      }
    } catch (error) {
      console.warn('Error extracting filename from path:', path, error);
      return 'unknown';
    }
  }

  /**
   * ได้รับ file extension
   */
  private getFileExtensionHelper(filename: string): string {
    if (!filename || filename === 'unknown' || typeof filename !== 'string') {
      return '';
    }

    try {
      const parts = filename.split('.');
      if (parts.length > 1) {
        const extension = parts[parts.length - 1].toLowerCase();
        return /^[a-z0-9]+$/i.test(extension) ? extension : '';
      }
      return '';
    } catch (error) {
      console.warn('Error getting file extension:', filename, error);
      return '';
    }
  }

  private getFileTypeFromFilename(filename: string): string {
    const extension = this.getFileExtensionHelper(filename);
    return extension || 'unknown';
  }

  /**
   * กำหนดประเภทไฟล์
   */
  private determineFileCategory(fileType: string, filename: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const type = (fileType || '').toLowerCase();
    const ext = this.getFileExtensionHelper(filename).toLowerCase();

    // Image files
    if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico'].includes(ext)) {
      return 'image';
    }

    // PDF files
    if (type.includes('pdf') || ext === 'pdf') {
      return 'pdf';
    }

    // Excel files
    if (type.includes('excel') || type.includes('spreadsheet') || ['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
      return 'excel';
    }

    // Word files
    if (type.includes('word') || type.includes('document') || ['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
      return 'word';
    }

    // Text files
    if (type.includes('text') || ['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'csv'].includes(ext)) {
      return 'text';
    }

    // Archive files
    if (type.includes('archive') || type.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return 'archive';
    }

    // Video files
    if (type.includes('video') || ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) {
      return 'video';
    }

    // Audio files
    if (type.includes('audio') || ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma'].includes(ext)) {
      return 'audio';
    }

    return 'file';
  }

  private determineFileCategoryByExtension(extension: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const ext = extension.toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico'].includes(ext)) {
      return 'image';
    }

    if (ext === 'pdf') {
      return 'pdf';
    }

    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
      return 'excel';
    }

    if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
      return 'word';
    }

    if (['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) {
      return 'text';
    }

    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
      return 'archive';
    }

    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(ext)) {
      return 'video';
    }

    if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma'].includes(ext)) {
      return 'audio';
    }

    return 'file';
  }

  /**
   * ตรวจสอบว่า existing attachment เป็นไฟล์รูปภาพหรือไม่
   */
  isExistingAttachmentImage(attachment: any): boolean {
    if (!attachment) {
      return false;
    }

    const attachmentId = attachment.attachment_id;

    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].type === 'image';
    }

    // Fallback
    if (attachment.path && attachment.path.startsWith('data:image/')) {
      return true;
    }

    const filename = attachment.filename || '';
    const fileType = attachment.file_type || '';

    const isImageByType = fileType.toLowerCase().includes('image');
    const isImageByExtension = /\.(jpg|jpeg|png|gif|webp|bmp|svg|tiff|ico)$/i.test(filename);

    return isImageByType || isImageByExtension;
  }

  /**
 * ดึง preview URL สำหรับ existing attachment
 */
  getExistingAttachmentPreviewUrl(attachment: any): string {
    if (!attachment) return '';

    if (attachment.preview_url) {
      return attachment.preview_url;
    }

    const path = attachment.path;
    if (!path) return '';

    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    return `${this.apiUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  /**
   * ได้รับ icon สำหรับ existing attachment
   */
  getExistingAttachmentIcon(attachment: any): string {
    if (!attachment) return 'bi-file-earmark-fill';

    const attachmentId = attachment.attachment_id;

    if (attachmentId && this.attachmentTypes[attachmentId]) {
      const fileInfo = this.attachmentTypes[attachmentId];

      switch (fileInfo.type) {
        case 'image': return 'bi-image-fill';
        case 'pdf': return 'bi-file-earmark-pdf-fill';
        case 'excel': return 'bi-file-earmark-excel-fill';
        case 'word': return 'bi-file-earmark-word-fill';
        case 'text': return 'bi-file-earmark-text-fill';
        case 'archive': return 'bi-file-earmark-zip-fill';
        case 'video': return 'bi-file-earmark-play-fill';
        case 'audio': return 'bi-file-earmark-music-fill';
        default: return 'bi-file-earmark-fill';
      }
    }

    // Fallback
    const filename = attachment.filename || '';
    const fileType = attachment.file_type || '';

    if (fileType.includes('image') || filename.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
      return 'bi-image-fill';
    }

    if (fileType.includes('pdf') || filename.match(/\.pdf$/i)) {
      return 'bi-file-earmark-pdf-fill';
    }

    if (fileType.includes('excel') || fileType.includes('spreadsheet') || filename.match(/\.(xls|xlsx|csv)$/i)) {
      return 'bi-file-earmark-excel-fill';
    }

    if (fileType.includes('word') || fileType.includes('document') || filename.match(/\.(doc|docx|rtf)$/i)) {
      return 'bi-file-earmark-word-fill';
    }

    if (fileType.includes('text') || filename.match(/\.(txt|log|md|json|xml)$/i)) {
      return 'bi-file-earmark-text-fill';
    }

    return 'bi-file-earmark-fill';
  }

  /**
   * ได้รับชื่อไฟล์ที่แสดงสำหรับ existing attachment
   */
  getExistingAttachmentDisplayName(attachment: any): string {
    if (!attachment) return 'Unknown file';

    const attachmentId = attachment.attachment_id;

    if (attachmentId && this.attachmentTypes[attachmentId]) {
      return this.attachmentTypes[attachmentId].filename;
    }

    return attachment.filename || this.extractFilenameFromPath(attachment.path) || 'Unknown file';
  }

  /**
   * ได้รับข้อมูลไฟล์สำหรับ existing attachment
   */
  getExistingAttachmentFileInfo(attachmentId: number): {
    type: string;
    extension: string;
    filename: string;
    isLoading: boolean;
    icon: string;
  } {
    const fileInfo = this.attachmentTypes[attachmentId];

    if (fileInfo) {
      return {
        type: fileInfo.type,
        extension: fileInfo.extension,
        filename: fileInfo.filename,
        isLoading: fileInfo.isLoading || false,
        icon: this.getExistingAttachmentIcon({ attachment_id: attachmentId })
      };
    }

    return {
      type: 'unknown',
      extension: '',
      filename: 'Unknown file',
      isLoading: false,
      icon: 'bi-file-earmark-fill'
    };
  }

  /**
   * Format file size สำหรับ existing attachments
   */
  formatExistingAttachmentSize(attachment: any): string {
    if (attachment && attachment.file_size) {
      return this.formatFileSize(attachment.file_size);
    }
    return '';
  }

  /**
   * จัดการข้อผิดพลาดการโหลดรูปภาพ
   */
  onExistingAttachmentImageError(attachmentId: number): void {
    console.log(`❌ Image failed to load for existing attachment ${attachmentId}`);

    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'file';
      this.attachmentTypes[attachmentId].isAnalyzed = true;
      console.log(`📄 Changed attachment ${attachmentId} from image to file type`);
    }
  }

  /**
   * จัดการการโหลดรูปภาพสำเร็จ
   */
  onExistingAttachmentImageLoad(attachmentId: number): void {
    console.log(`✅ Image loaded successfully for existing attachment ${attachmentId}`);

    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'image';
      this.attachmentTypes[attachmentId].isAnalyzed = true;
      console.log(`✅ Confirmed attachment ${attachmentId} as image type`);
    }
  }

  async onRemoveExistingAttachment(attachment: { attachment_id: number;[k: string]: any; }): Promise<void> {
    if (!attachment?.attachment_id) return;
    if (!this.isFormReady() || this.supporterFormState.isSaving) return;

    // ✅ NEW: RBAC Check
    if (!this.isSupporter) {
      this.supporterFormState.error = 'คุณไม่มีสิทธิ์ลบไฟล์แนบ';
      setTimeout(() => (this.supporterFormState.error = ''), 2500);
      return;
    }

    const ok = window.confirm('ยืนยันการลบไฟล์แนบนี้หรือไม่?');
    if (!ok) return;


    const id = attachment.attachment_id;
    this.deletingAttachmentIds.add(id);


    try {
      // If you already have an ApiService.delete<T>, use it.
      // Otherwise see the tiny addition for api.service.ts below.
      await this.apiService
        .delete<any>(`fix_issue/${id}`)
        .toPromise();


      // Remove from local list
      this.existingFixAttachments = this.existingFixAttachments.filter(a => a.attachment_id !== id);


      // Optional success message
      this.supporterFormState.successMessage = 'ลบไฟล์แนบเรียบร้อย';
      setTimeout(() => (this.supporterFormState.successMessage = ''), 2000);
    } catch (err: any) {
      this.supporterFormState.error = err?.message || 'ไม่สามารถลบไฟล์ได้';
      setTimeout(() => (this.supporterFormState.error = ''), 2500);
    } finally {
      this.deletingAttachmentIds.delete(id);
    }
  }

  /**
   * ได้รับสีตามประเภทไฟล์
   */
  getFileTypeColor(fileType: string): string {
    switch (fileType) {
      case 'image': return '#6f42c1'; // Purple
      case 'pdf': return '#dc3545';   // Red
      case 'excel': return '#198754'; // Green
      case 'word': return '#0d6efd';  // Blue
      case 'text': return '#6c757d';  // Gray
      case 'archive': return '#ffc107'; // Yellow
      case 'video': return '#e83e8c'; // Pink
      case 'audio': return '#fd7e14'; // Orange
      default: return '#6c757d';      // Gray
    }
  }

  /**
   * สร้าง preview URL สำหรับไฟล์ใหม่
   */
  getFilePreview(file: File): string {
    if (!this.filePreviewUrls[file.name]) {
      if (this.ticketService.isImageFile(file)) {
        this.filePreviewUrls[file.name] = URL.createObjectURL(file);
      }
    }
    return this.filePreviewUrls[file.name] || '';
  }

  /**
   * ได้รับ file type จาก extension
   */
  getFileTypeFromExtension(filename: string): string {
    const extension = this.getFileExtensionHelper(filename).toLowerCase();

    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
      return 'image';
    }
    if (extension === 'pdf') return 'pdf';
    if (['xls', 'xlsx', 'csv'].includes(extension)) return 'excel';
    if (['doc', 'docx', 'rtf'].includes(extension)) return 'word';
    if (['txt', 'log', 'md', 'json'].includes(extension)) return 'text';
    if (['zip', 'rar', '7z'].includes(extension)) return 'archive';

    return 'file';
  }

  // ✅ trackBy function
  trackByAttachment(index: number, attachment: ExistingAttachment): number {
    return attachment.attachment_id;
  }

  trackByFile(index: number, file: File): string {
    return file.name + file.size + file.lastModified;
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number | undefined): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * ตรวจสอบไฟล์ก่อนอัปโหลด
   */
  private validateFixIssueFiles(files: File[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'image/webp', 'image/bmp', 'image/tiff',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv', 'application/json',
      'application/zip', 'application/x-rar-compressed'
    ];

    files.forEach(file => {
      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: ประเภทไฟล์ไม่รองรับ`);
      }
      if (file.size > maxSize) {
        errors.push(`${file.name}: ขนาดเกิน 10MB`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  // ===== Existing Methods Continue Below ===== 

  private setupAutoCalculation(): void {
    this.supporterForm.get('close_estimate')?.valueChanges.subscribe(() => {
      this.calculateEstimateTimeFromForm();
    });

    this.supporterForm.get('due_date')?.valueChanges.subscribe(() => {
      this.calculateLeadTimeFromForm();
    });
  }

  private calculateEstimateTimeFromForm(): void {
    const closeEstimate = this.supporterForm.get('close_estimate')?.value;

    if (!closeEstimate) {
      this.estimateTime = 0;
      return;
    }

    const openTicketDate = this.getOpenTicketDate();
    if (!openTicketDate) {
      console.warn('Cannot calculate estimate time: No open ticket date found');
      this.estimateTime = 0;
      return;
    }

    try {
      const closeEstimateDate = new Date(closeEstimate);
      this.estimateTime = this.businessHoursCalculator.calculateEstimateTime(
        openTicketDate,
        closeEstimateDate
      );

      console.log('Estimate Time calculated:', {
        from: openTicketDate,
        to: closeEstimateDate,
        hours: this.estimateTime
      });

      this.supporterForm.patchValue({
        estimate_time: Math.round(this.estimateTime)
      }, { emitEvent: false });

    } catch (error) {
      console.error('Error calculating estimate time:', error);
      this.estimateTime = 0;
    }
  }

  private calculateLeadTimeFromForm(): void {
    const dueDate = this.supporterForm.get('due_date')?.value;

    if (!dueDate) {
      this.leadTime = 0;
      return;
    }

    const openTicketDate = this.getOpenTicketDate();
    if (!openTicketDate) {
      console.warn('Cannot calculate lead time: No open ticket date found');
      this.leadTime = 0;
      return;
    }

    try {
      const dueDateObj = new Date(dueDate);
      this.leadTime = this.businessHoursCalculator.calculateLeadTime(
        openTicketDate,
        dueDateObj
      );

      console.log('Lead Time calculated:', {
        from: openTicketDate,
        to: dueDateObj,
        hours: this.leadTime
      });

      this.supporterForm.patchValue({
        lead_time: Math.round(this.leadTime)
      }, { emitEvent: false });

    } catch (error) {
      console.error('Error calculating lead time:', error);
      this.leadTime = 0;
    }
  }

  private getOpenTicketDate(): Date | null {
    if (!this.ticketData?.status_history) {
      return null;
    }

    const openTicketHistory = this.ticketData.status_history.find(
      history => history.status_id === 2
    );

    if (!openTicketHistory?.create_date) {
      console.warn('Open ticket date not found in status history');
      return null;
    }

    try {
      return new Date(openTicketHistory.create_date);
    } catch (error) {
      console.error('Error parsing open ticket date:', error);
      return null;
    }
  }

  /**
   * 🔄 ปรับปรุง setupFormPersistence - เพิ่มการบันทึกอัตโนมัติ
   */
  private setupFormPersistence(): void {
    let saveTimeout: any = null;

    this.formChangeSubscription = this.supporterForm.valueChanges.subscribe((formValue) => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      // 🆕 Auto-save หลังจาก 2 วินาที
      saveTimeout = setTimeout(() => {
        this.persistAllFormData();
      }, 2000);
    });
  }

  /**
   * 🆕 เมื่อเลือก assignee
   */
  onAssigneeChanged(): void {
    setTimeout(() => {
      this.persistAllFormData();
    }, 100);
  }

  private persistFormData(): void {
    if (!this.hasFormData()) {
      localStorage.removeItem(this.formPersistenceKey);
      return;
    }

    try {
      const dataToSave = {
        formValue: { ...this.supporterForm.value },
        selectedAssigneeId: this.selectedAssigneeId,
        selectedFiles: this.selectedFiles.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified
        })),
        timestamp: Date.now(),
        ticketNo: this.ticket_no
      };

      localStorage.setItem(this.formPersistenceKey, JSON.stringify(dataToSave));
      this.lastFormSnapshot = dataToSave;

      console.log('Form data persisted to localStorage:', {
        hasData: this.hasFormData(),
        ticketNo: this.ticket_no,
        timestamp: new Date(dataToSave.timestamp).toLocaleTimeString()
      });
    } catch (error) {
      console.warn('Failed to persist form data:', error);
    }
  }

  private restorePersistedFormData(): void {
    try {
      const savedData = localStorage.getItem(this.formPersistenceKey);
      if (!savedData) {
        console.log('No persisted form data found');
        return;
      }

      const parsedData = JSON.parse(savedData);

      const age = Date.now() - parsedData.timestamp;
      const maxAge = 60 * 60 * 1000;

      if (age > maxAge) {
        console.log('Persisted data too old, removing');
        localStorage.removeItem(this.formPersistenceKey);
        return;
      }

      if (parsedData.ticketNo && this.ticket_no && parsedData.ticketNo !== this.ticket_no) {
        console.log('Persisted data for different ticket, ignoring');
        return;
      }

      if (parsedData.formValue) {
        console.log('Restoring persisted form data:', parsedData.formValue);
        this.supporterForm.patchValue(parsedData.formValue);
      }

      if (parsedData.selectedAssigneeId) {
        this.selectedAssigneeId = parsedData.selectedAssigneeId;
      }

      if (parsedData.selectedFiles && parsedData.selectedFiles.length > 0) {
        console.log('Previous files were selected (need to re-select):',
          parsedData.selectedFiles.map((f: any) => f.name));
      }

      console.log('Form data restored successfully');
    } catch (error) {
      console.warn('Failed to restore persisted form data:', error);
      localStorage.removeItem(this.formPersistenceKey);
    }
  }

  private takeFormSnapshot(): void {
    if (this.supporterForm && this.hasFormData()) {
      this.formStateSnapshot = {
        formValue: { ...this.supporterForm.value },
        selectedAssigneeId: this.selectedAssigneeId,
        selectedFiles: [...this.selectedFiles],
        fileUploadProgress: [...this.fileUploadProgress],
        timestamp: Date.now()
      };

      console.log('Form snapshot taken:', {
        hasData: this.hasFormData(),
        formValue: this.formStateSnapshot.formValue,
        fileCount: this.formStateSnapshot.selectedFiles.length
      });
    }
  }

  private restoreFormSnapshot(): boolean {
    if (!this.formStateSnapshot) {
      console.log('No form snapshot to restore');
      return false;
    }

    const age = Date.now() - this.formStateSnapshot.timestamp;
    const maxAge = 30000;

    if (age > maxAge) {
      console.log('Form snapshot too old, discarding');
      this.formStateSnapshot = null;
      return false;
    }

    console.log('Restoring form snapshot:', this.formStateSnapshot.formValue);

    this.supporterForm.patchValue(this.formStateSnapshot.formValue);
    this.selectedAssigneeId = this.formStateSnapshot.selectedAssigneeId;

    if (this.formStateSnapshot.selectedFiles.length > 0) {
      this.selectedFiles = [...this.formStateSnapshot.selectedFiles];
      this.fileUploadProgress = [...this.formStateSnapshot.fileUploadProgress];
    }

    this.formStateSnapshot = null;
    return true;
  }

  // 9️⃣ แก้ไข onTicketDataChanged() - เพิ่มการโหลด assignee
  private onTicketDataChanged(): void {
    console.log('📄 onTicketDataChanged called');

    this.supporterFormState.error = null;
    if (!this.justSaved) {
      this.supporterFormState.successMessage = null;
    }

    // ✅ โหลด existing attachments
    this.loadExistingFixAttachments();

    // ✅ Build action dropdown
    if (this.ticketData?.ticket && this.statusList.length > 0) {
      this.buildActionDropdownOptions();
    }

    // ✅ Calculate real-time values
    this.calculateRealtime();

    if (this.ticketData?.ticket) {
      if (this.justSaved) {
        console.log('📝 Just saved - updating form after save');
        this.updateFormAfterSave();
      } else {
        // ✅ โหลดข้อมูลจาก ticket data เสมอ
        console.log('📥 Loading data from ticket');
        this.updateFormWithTicketData();
      }
    }

    // ✅ เพิ่ม Debug Log เพื่อดูว่า Action ถูก set อย่างไร
    setTimeout(() => {
      console.log('🔍 Current form value after onTicketDataChanged:', {
        action: this.supporterForm.value.action,
        priority: this.supporterForm.value.priority,
        ticket_status_id: this.ticketData?.ticket?.status_id,
        ticket_status_name: this.ticketData?.ticket?.status_name
      });
    }, 100);

    if (this.justSaved) {
      setTimeout(() => {
        this.justSaved = false;
        this.formDataBeforeRefresh = null;
      }, 150);
    }
  }

  private updateFormAfterSave(): void {
    // ✅ แก้ไข - ให้โหลดจาก ticket data เสมอ ไม่ใช้ formDataBeforeRefresh
    console.log('🔄 updateFormAfterSave - loading from current ticket data');
    this.updateFormWithTicketData();
  }

  // 1️⃣ แก้ไข updateFormWithTicketData() - เพิ่มการดึง action และ assignee
  public updateFormWithTicketData(): void {
    if (!this.ticketData?.ticket) {
      console.warn('No ticket data to load');
      return;
    }

    const ticket = this.ticketData.ticket;

    console.log('📋 Loading ticket data into form:', {
      ticket_no: ticket.ticket_no,
      status_id: ticket.status_id,
      status_name: ticket.status_name,
      close_estimate: ticket.close_estimate,
      due_date: ticket.due_date,
      estimate_time: ticket.estimate_time,
      lead_time: ticket.lead_time,
      fix_issue_description: ticket.fix_issue_description,
      related_ticket_id: ticket.related_ticket_id,
      assign_data: this.ticketData.assign // ✅ เพิ่ม
    });

    // ✅ แปลง dates
    const closeEstimateFormatted = this.formatDateTimeForInput(ticket.close_estimate);
    const dueDateFormatted = this.formatDateTimeForInput(ticket.due_date);

    // ✅ Parse numbers
    const estimateTime = this.parseNumberField(ticket.estimate_time);
    const leadTime = this.parseNumberField(ticket.lead_time);

    // ✅ NEW: ดึง current status_id มาตั้งค่าใน action dropdown
    const currentStatusId = ticket.status_id;

    console.log('🎯 Setting action value to:', currentStatusId);

    // ✅ สร้าง form value พร้อม status_id
    const formValue = {
      action: currentStatusId ? currentStatusId.toString() : '', // ✅ ตั้งค่า action ตาม status_id ปัจจุบัน
      priority: ticket.priority_id || null, // ✅ เพิ่มบรรทัดนี้
      estimate_time: estimateTime,
      due_date: dueDateFormatted,
      lead_time: leadTime,
      close_estimate: closeEstimateFormatted,
      fix_issue_description: ticket.fix_issue_description || '',
      related_ticket_id: ticket.related_ticket_id?.toString() || ''
    };

    console.log('📋 Form value to patch (with action):', formValue);

    // ✅ Patch form
    this.supporterForm.patchValue(formValue, { emitEvent: false });

    // ✅ Set calculated values
    if (estimateTime !== null && estimateTime !== undefined) {
      this.estimateTime = estimateTime;
    }
    if (leadTime !== null && leadTime !== undefined) {
      this.leadTime = leadTime;
    }

    // ✅ NEW: ดึงข้อมูล assignee จาก assign array
    this.loadAssigneeFromTicketData();

    // ✅ เพิ่ม Debug Log หลัง patch
    console.log('✅ Form patched successfully:', {
      formValue: this.supporterForm.value,
      action: this.supporterForm.value.action,
      priority: this.supporterForm.value.priority,
      estimateTime: this.estimateTime,
      leadTime: this.leadTime
    });

    // ✅ Validate form
    this.validateSupporterForm();

    // ✅ NEW: อัปเดต Editor content (Issue Resolution)
    if (this.fixIssueEditor?.nativeElement) {
      this.fixIssueEditor.nativeElement.innerHTML = ticket.fix_issue_description || '';
      this.checkToolbarStatus();
    }

    // ✅ เพิ่มบรรทัดนี้ไว้ "ท้ายสุด" ของ updateFormWithTicketData()
    // ✅ เพิ่มท้ายฟังก์ชัน updateFormWithTicketData()
    const dueControl = this.supporterForm.get('due_date');

    // ถ้าเป็น supporter (role_id = 8) เท่านั้นให้กรอกได้
    if (this.isSupporter && !this.isAdmin) {
      dueControl?.enable({ emitEvent: false });
      console.log('✅ Re-enabled due_date for supporter');
    } else {
      dueControl?.disable({ emitEvent: false });
      console.log('🚫 Disabled due_date for admin or other roles');
    }

    const closeEstimateControl = this.supporterForm.get('close_estimate');

    // ถ้าเป็น supporter (role_id = 8) เท่านั้นให้กรอกได้
    if (this.isAdmin && !this.isSupporter) {
      closeEstimateControl?.enable({ emitEvent: false });
      console.log('✅ Re-enabled close_estimate for supporter');
    } else {
      closeEstimateControl?.disable({ emitEvent: false });
      console.log('🚫 Disabled close_estimate for admin or other roles');
    }

  }

  // 2️⃣ NEW: เพิ่ม method สำหรับดึงข้อมูล assignee
  private loadAssigneeFromTicketData(): void {
    if (!this.ticketData?.assign || this.ticketData.assign.length === 0) {
      console.log('📋 No assignee data found');
      this.selectedAssigneeId = null;
      this.originalAssigneeId = null; // ✅ เพิ่มบรรทัดนี้
      return;
    }

    // ✅ ดึงข้อมูล assignee ล่าสุด (อันสุดท้ายใน array)
    const latestAssign = this.ticketData.assign[this.ticketData.assign.length - 1];
    const assignToName = latestAssign.assignTo;

    console.log('📋 Found assignee from ticket data:', {
      assignTo: assignToName,
      assignBy: latestAssign.assignBy,
      ticket_no: latestAssign.ticket_no
    });

    // ✅ หา user ID จากชื่อใน assignee list
    if (this.assigneeList && this.assigneeList.length > 0) {
      const matchedUser = this.assigneeList.find(user => {
        const fullName = this.getUserFullName(user);
        return fullName === assignToName || user.username === assignToName;
      });

      if (matchedUser) {
        this.selectedAssigneeId = matchedUser.id;
        this.originalAssigneeId = matchedUser.id; // ✅ เพิ่มบรรทัดนี้ - บันทึกค่าเดิม
        console.log('✅ Matched assignee:', {
          id: matchedUser.id,
          name: this.getUserFullName(matchedUser),
          username: matchedUser.username
        });
      } else {
        console.warn('⚠️ Could not find matching user in assignee list for:', assignToName);
        // ✅ เก็บชื่อไว้ใน temporary variable สำหรับแสดง
        this.tempAssigneeName = assignToName;
        this.originalAssigneeId = null; // ✅ เพิ่มบรรทัดนี้
      }
    } else {
      console.log('⏳ Assignee list not loaded yet, will retry later');
      // ✅ เก็บชื่อไว้ใน temporary variable
      this.tempAssigneeName = assignToName;
      this.originalAssigneeId = null; // ✅ เพิ่มบรรทัดนี้

      // ✅ ลองโหลด assignee list อีกครั้ง
      this.retryLoadAssignee();
    }
  }

  // 3️⃣ NEW: เพิ่ม property สำหรับเก็บชื่อ assignee ชั่วคระ
  private tempAssigneeName: string | null = null;

  // 4️⃣ NEW: Helper method สำหรับดึงชื่อเต็มของ user
  private getUserFullName(user: any): string {
    // ลองดึงจาก full_name ก่อน
    if (user.full_name) {
      return user.full_name;
    }

    // ลองดึงจาก name (สำหรับ Role9User)
    if (user.name) {
      return user.name;
    }

    // สร้างจาก firstname + lastname
    const parts: string[] = [];
    if (user.firstname) parts.push(user.firstname);
    if (user.lastname) parts.push(user.lastname);

    if (parts.length > 0) {
      return parts.join(' ');
    }

    // Fallback ไปที่ username หรือ ID
    return user.username || `User ${user.id}`;
  }

  // 5️⃣ NEW: Retry logic สำหรับโหลด assignee
  private retryLoadAssignee(): void {
    // ✅ รอให้ assignee list โหลดเสร็จก่อน
    setTimeout(() => {
      if (this.assigneeList && this.assigneeList.length > 0 && this.tempAssigneeName) {
        console.log('🔄 Retrying assignee matching with loaded list');
        this.loadAssigneeFromTicketData();
      }
    }, 500);
  }

  /**
 * ✅ Parse number field จาก backend
 */
  private parseNumberField(value: any): number | null {
    // ✅ Handle null, undefined, empty string
    if (value === null || value === undefined || value === '' || value === 'null') {
      console.log('Empty number field:', value);
      return null;
    }

    // ✅ Parse เป็น number
    const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);

    if (isNaN(parsed)) {
      console.warn('Invalid number:', value);
      return null;
    }

    console.log('Parsed number:', {
      input: value,
      output: parsed
    });

    return parsed;
  }

  /**
 * 🔄 ปรับปรุง: แปลง date string จาก backend เป็น format สำหรับ input[type="datetime-local"]
 * Format ที่ต้องการ: YYYY-MM-DDTHH:mm
 */
  private formatDateTimeForInput(dateString: string | null | undefined): string {
    if (!dateString || dateString === 'null' || dateString === 'undefined') {
      console.log('Empty date string:', dateString);
      return '';
    }

    try {
      let date: Date;

      if (typeof dateString === 'string') {
        // ✅ รองรับทั้ง ISO format และ format ที่มี space
        const normalizedDateString = dateString.replace(' ', 'T');
        date = new Date(normalizedDateString);
      } else {
        date = new Date(dateString);
      }

      // ✅ ตรวจสอบว่า date ถูกต้อง
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return '';
      }

      // ✅ แปลงเป็น local time zone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      const formatted = `${year}-${month}-${day}T${hours}:${minutes}`;

      console.log('Formatted date:', {
        input: dateString,
        output: formatted
      });

      return formatted;

    } catch (error) {
      console.error('Error formatting date for input:', dateString, error);
      return '';
    }
  }

  hasFormData(): boolean {
    if (!this.supporterForm) return false;

    const formValue = this.supporterForm.value;

    return !!(
      formValue.action ||
      (formValue.estimate_time !== null && formValue.estimate_time !== '') ||
      formValue.due_date ||
      (formValue.lead_time !== null && formValue.lead_time !== '') ||
      formValue.close_estimate ||
      (formValue.fix_issue_description && formValue.fix_issue_description.trim() && formValue.fix_issue_description.trim() !== '<br>') || // ✅ เพิ่มการตรวจสอบ HTML Empty
      (formValue.related_ticket_id && formValue.related_ticket_id.trim()) ||
      this.selectedFiles.length > 0 ||
      this.selectedAssigneeId
    );
  }

  refreshForm(): void {
    console.log('Manual form refresh requested');

    if (this.hasFormData()) {
      this.takeFormSnapshot();
    }

    this.refreshRequired.emit();
  }

  manualSaveFormData(): void {
    this.persistFormData();
    console.log('Manual form data save triggered');
  }

  getFormPersistenceStatus(): {
    hasPersistedData: boolean;
    lastSaved: Date | null;
    dataAge: number;
    isValidForCurrentTicket: boolean;
  } {
    try {
      const savedData = localStorage.getItem(this.formPersistenceKey);
      if (!savedData) {
        return {
          hasPersistedData: false,
          lastSaved: null,
          dataAge: 0,
          isValidForCurrentTicket: false
        };
      }

      const parsedData = JSON.parse(savedData);
      const age = Date.now() - parsedData.timestamp;
      const isValid = parsedData.ticketNo === this.ticket_no;

      return {
        hasPersistedData: true,
        lastSaved: new Date(parsedData.timestamp),
        dataAge: Math.floor(age / 1000),
        isValidForCurrentTicket: isValid
      };
    } catch {
      return {
        hasPersistedData: false,
        lastSaved: null,
        dataAge: 0,
        isValidForCurrentTicket: false
      };
    }
  }

  trackByActionOption(index: number, option: ActionDropdownOption): string | number {
    return option.statusId;
  }

  trackByUser(index: number, user: UserListItem): number {
    return user.id;
  }

  debugLog(message: string, data?: any): void {
    console.log(message, data);
  }

  get isJustSaved(): boolean {
    return this.justSaved;
  }

  get debugInfo() {
    return {
      isComponentInitialized: this.isComponentInitialized,
      hasTicketDataChanged: this.hasTicketDataChanged,
      ticketData: !!this.ticketData,
      hasTicket: !!this.ticketData?.ticket,
      ticketId: this.ticketData?.ticket?.id,
      ticketNo: this.ticketData?.ticket?.ticket_no,
      isLoadingTicketData: this.isLoadingTicketData,
      canShowForm: this.canShowSupporterForm(),
      canSave: this.canSaveAll(),
      hasPermission: this.canUserSaveSupporter
    };
  }

  private initializeSupporterForm(): void {
    this.supporterForm = this.fb.group({
      action: ['', [Validators.required]],
      // ✅ เพิ่มบรรทัดนี้หลัง action
      priority: [null], // ✅ เพิ่ม
      estimate_time: [null, [Validators.min(0), Validators.max(1000)]],
      due_date: [''],
      lead_time: [null, [Validators.min(0), Validators.max(10000)]],
      close_estimate: [''],
      fix_issue_description: ['', [Validators.maxLength(5000)]], // ✅ แก้ไข: ลบ Validators.required ออก (ตาม Logic TicketService)
      related_ticket_id: ['']
    });

    this.supporterForm.valueChanges.subscribe(() => {
      this.validateSupporterForm();
    });
  }

  private checkUserPermissions(): void {
    const userPermissions = this.authService.getEffectivePermissions();

    // === 1. ตรรกะ "รวมสิทธิ์" (สำหรับปุ่ม Save) ===
    this.canUserSaveSupporter = userPermissions.includes(8) ||
      userPermissions.includes(19) ||
      this.authService.isAdmin() ||
      this.authService.isSupporter();

    // === 2. ตรรกะ "แยกสิทธิ์" (สำหรับ [disabled] ใน HTML) ===

    // ดึงค่าดิบจาก Service
    const isUserAdmin = this.authService.isAdmin();
    const isUserSupporter = this.authService.isSupporter();

    // --- 🕵️‍♂️ LOG ค่าดิบ ---
    console.log('AuthService Raw Values:', {
      isAdmin: isUserAdmin,
      isSupporter: isUserSupporter
    });

    // this.isAdmin คือ Admin เท่านั้น
    this.isAdmin = isUserAdmin;

    // this.isSupporter คือ Supporter แท้ๆ ที่ *ไม่ใช่* Admin
    this.isSupporter = isUserSupporter && !isUserAdmin;

    // --- 🕵️‍♂️ LOG ค่าที่ใช้จริงใน Component ---
    console.log('Component Final RBAC Values:', {
      this_isAdmin: this.isAdmin,
      this_isSupporter: this.isSupporter
    });

    // === 3. ตรรกะส่วนที่เหลือ ===
    this.canUserChangePriority = userPermissions.includes(permissionEnum.ASSIGNEE) ||
      this.isAdmin;

    // === 4. Log สรุป (อันเดิม) ===
    console.log('User permissions checked (Summary):', {
      canUserSaveSupporter: this.canUserSaveSupporter,
      canChangePriority: this.canUserChangePriority,
      isAdmin: this.isAdmin,
      isSupporter: this.isSupporter
    });
  }

  canEditSupportInformation(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();

    return userPermissions.includes(8) ||
      userPermissions.includes(19) ||
      this.authService.isAdmin() ||
      this.authService.isSupporter();
  }

  canShowSupporterForm(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();

    const hasRequiredPermission = userPermissions.includes(5) ||
      userPermissions.includes(8) ||
      userPermissions.includes(19);

    const shouldShow = hasRequiredPermission && !this.isLoadingTicketData;

    console.log('canShowSupporterForm debug:', {
      userPermissions,
      hasRequiredPermission,
      isLoadingTicketData: this.isLoadingTicketData,
      shouldShow,
      ticketData: !!this.ticketData,
      hasTicket: !!this.ticketData?.ticket
    });

    return shouldShow;
  }

  canAssignTicket(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();

    return userPermissions.includes(19) ||
      userPermissions.includes(8) ||
      this.authService.isAdmin() ||
      this.authService.isSupporter();
  }

  isFormReady(): boolean {
    return this.isComponentInitialized &&
      !this.isLoadingTicketData &&
      !!this.ticketData?.ticket;
  }

  getFormStatusMessage(): string {
    if (this.isLoadingTicketData) {
      return 'กำลังโหลดข้อมูล ticket...';
    }

    if (!this.ticketData?.ticket) {
      return 'รอข้อมูล ticket';
    }

    if (!this.isComponentInitialized) {
      return 'กำลังเตรียมฟอร์ม...';
    }

    return 'พร้อมใช้งาน';
  }

  private async loadActionDropdownOptions(): Promise<void> {
    console.log('Loading action dropdown options...');
    this.isLoadingActions = true;
    this.actionError = '';

    try {
      const response = await new Promise<StatusDDLResponse>((resolve, reject) => {
        this.apiService.getStatusDDL('th').subscribe({
          next: (data) => resolve(data),
          error: (err) => reject(err)
        });
      });

      if (response && response.code === 1 && response.data) {
        this.statusList = response.data;
        this.buildActionDropdownOptions();
        console.log('Action dropdown options loaded:', this.actionDropdownOptions.length, 'options');
      } else {
        console.warn('Invalid response from getStatusDDL:', response);
        this.actionError = response?.message || 'ไม่สามารถโหลดข้อมูล Status ได้';
        this.buildDefaultActionOptions();
      }
    } catch (error) {
      console.error('Error loading action dropdown:', error);
      this.actionError = 'เกิดข้อผิดพลาดในการโหลดข้อมูล Status';
      this.buildDefaultActionOptions();
    } finally {
      this.isLoadingActions = false;
    }
  }

  // ✅ UPDATED: กรองตัวเลือกตาม Role (Admin/Supporter)
  private buildActionDropdownOptions(): void {
    if (!this.statusList || this.statusList.length === 0) {
      this.buildDefaultActionOptions();
      return;
    }

    const currentStatusId = this.getCurrentStatusId();
    console.log('Building action options for current status:', currentStatusId);

    // ✅ FIXED: เพิ่ม current status เข้าไปใน options ด้วย (แต่ disabled)
    const currentStatus = this.statusList.find(s => s.id === currentStatusId);

    this.actionDropdownOptions = this.statusList
      .map(status => {
        const canChange = canChangeStatus(currentStatusId, status.id);
        const isCurrent = status.id === currentStatusId;

        // ✅ NEW: RBAC Logic
        let isDisabledByRole = false;
        if (this.isAdmin) {
          // Admin: เลือกได้แค่ Open Ticket (2) และ Cancel (6)
          if (status.id !== TICKET_STATUS_IDS.OPEN_TICKET && status.id !== TICKET_STATUS_IDS.CANCEL) {
            isDisabledByRole = true;
          }
        } else if (this.isSupporter) {
          // Supporter: เลือกได้แค่ In Progress (3), Resolved (4), Completed (5)
          const supporterActions: number[] = [
            TICKET_STATUS_IDS.IN_PROGRESS,
            TICKET_STATUS_IDS.RESOLVED,
            TICKET_STATUS_IDS.COMPLETED
          ];
          if (!supporterActions.includes(status.id)) {
            isDisabledByRole = true;
          }
        } else {
          // ถ้าไม่ใช่ทั้ง Admin และ Supporter, disable ทั้งหมด
          isDisabledByRole = true;
        }
        // =======================

        return {
          value: status.id.toString(),
          label: status.name + (isCurrent ? '' : ''),
          statusId: status.id,
          // ✅ disable current status, status ที่เปลี่ยนไม่ได้, และ status ที่ไม่มีสิทธิ์ตาม Role
          disabled: !canChange || isCurrent || isDisabledByRole
        };
      });

    this.sortActionOptions();

    console.log('✅ Action dropdown built with options:', this.actionDropdownOptions);
  }

  private buildDefaultActionOptions(): void {
    console.log('Using default action options');
    this.actionDropdownOptions = [
      { value: '5', label: 'Complete', statusId: 5 },
      { value: '1', label: 'Pending', statusId: 1 },
      { value: '2', label: 'Open Ticket', statusId: 2 },
      { value: '3', label: 'In Progress', statusId: 3 },
      { value: '4', label: 'Resolved', statusId: 4 },
      { value: '6', label: 'Cancel', statusId: 6 }
    ];
  }

  private sortActionOptions(): void {
    const order = [2, 3, 4, 5, 1, 6];
    this.actionDropdownOptions.sort((a, b) => {
      const aIndex = order.indexOf(a.statusId);
      const bIndex = order.indexOf(b.statusId);
      return aIndex - bIndex;
    });
  }

  refreshActionDropdown(): void {
    if (this.statusList && this.statusList.length > 0) {
      this.buildActionDropdownOptions();
    } else {
      this.loadActionDropdownOptions();
    }
  }

  calculateRealtime(): void {
    if (!this.ticketData?.ticket) {
      this.estimateTime = 0;
      this.leadTime = 0;
      return;
    }

    const openTicketDate = this.getOpenTicketDate();
    if (!openTicketDate) {
      console.warn('Cannot calculate real-time: No open ticket date found');
      this.estimateTime = 0;
      this.leadTime = 0;
      return;
    }

    try {
      if (this.ticketData.ticket.close_estimate) {
        const closeEstimateDate = new Date(this.ticketData.ticket.close_estimate);
        this.estimateTime = this.businessHoursCalculator.calculateEstimateTime(
          openTicketDate,
          closeEstimateDate
        );
      } else {
        this.estimateTime = 0;
      }

      if (this.ticketData.ticket.due_date) {
        const dueDateObj = new Date(this.ticketData.ticket.due_date);
        this.leadTime = this.businessHoursCalculator.calculateLeadTime(
          openTicketDate,
          dueDateObj
        );
      } else {
        this.leadTime = 0;
      }

      console.log('Real-time calculations updated:', {
        openTicketDate,
        estimateTime: this.estimateTime,
        leadTime: this.leadTime
      });
    } catch (error) {
      console.error('Error in calculateRealtime:', error);
      this.estimateTime = 0;
      this.leadTime = 0;
    }
  }

  // 6️⃣ แก้ไข initializeAssigneeList() - เรียก loadAssigneeFromTicketData หลังโหลดเสร็จ
  private initializeAssigneeList(): void {
    if (this.canAssignTicket()) {
      console.log('📋 Initializing assignee list...');

      this.isLoadingAssignees = true;
      this.assigneeError = '';
      this.assigneeList = [];

      this.apiService.getRole9Users().subscribe({
        next: (response: Role9UsersResponse) => {
          if (response && response.users && Array.isArray(response.users)) {
            this.assigneeList = response.users.map(user => ({
              id: user.id,
              username: user.username || user.name || `user_${user.id}`,
              firstname: user.firstname || '',
              lastname: user.lastname || '',
              email: user.email || '',
              isenabled: true,
              full_name: user.name || this.getUserFullName(user)
            }));

            console.log('✅ Assignee list loaded:', this.assigneeList.length, 'users');

            // ✅ NEW: หลังโหลด assignee list เสร็จ ให้ลองจับคู่กับ ticket data อีกครั้ง
            if (this.ticketData?.assign && this.ticketData.assign.length > 0) {
              this.loadAssigneeFromTicketData();
            }

            if (this.assigneeList.length === 0) {
              this.assigneeError = 'ไม่พบรายชื่อผู้รับมอบหมาย';
            }
          } else {
            this.assigneeError = 'รูปแบบข้อมูลจาก API ไม่ถูกต้อง';
          }
        },
        error: (error) => {
          console.error('Error loading assignees:', error);
          this.assigneeError = 'เกิดข้อผิดพลาดในการโหลดรายชื่อผู้รับมอบหมาย';
        },
        complete: () => {
          this.isLoadingAssignees = false;
        }
      });
    }
  }

  /**
 * ✅ โหลด Priority dropdown options จาก Backend
 */
  private async loadPriorityDropdownOptions(): Promise<void> {
    // ถ้าไม่มีสิทธิ์ ไม่ต้องโหลด
    if (!this.canUserChangePriority) {
      console.log('ℹ️ User does not have permission to change priority');
      return;
    }

    console.log('Loading priority dropdown options...');
    this.isLoadingPriorities = true;
    this.priorityError = '';

    try {
      const response = await new Promise<PriorityDDLResponse>((resolve, reject) => {
        this.ticketService.getPriorityDDL().subscribe({
          next: (data) => resolve(data),
          error: (err) => reject(err)
        });
      });

      if (response && response.success && response.data) {
        this.priorityDropdownOptions = response.data;
        console.log('✅ Priority dropdown options loaded:', this.priorityDropdownOptions.length, 'options');
      } else {
        console.warn('⚠️ Invalid response from getPriorityDDL:', response);
        this.priorityError = response?.message || 'ไม่สามารถโหลดข้อมูล Priority ได้';
        this.buildDefaultPriorityOptions();
      }
    } catch (error) {
      console.error('❌ Error loading priority dropdown:', error);
      this.priorityError = 'เกิดข้อผิดพลาดในการโหลดข้อมูล Priority';
      this.buildDefaultPriorityOptions();
    } finally {
      this.isLoadingPriorities = false;
    }
  }

  /**
   * ✅ สร้าง Priority options เริ่มต้น (fallback)
   */
  private buildDefaultPriorityOptions(): void {
    console.log('Using default priority options');
    this.priorityDropdownOptions = [
      { id: 1, name: 'Low' },
      { id: 2, name: 'Medium' },
      { id: 3, name: 'High' }
    ];
  }

  /**
   * ✅ Refresh Priority dropdown (สำหรับ retry button)
   */
  refreshPriorityDropdown(): void {
    if (this.priorityDropdownOptions && this.priorityDropdownOptions.length > 0) {
      console.log('Priority options already loaded');
      return;
    }
    this.loadPriorityDropdownOptions();
  }

  /**
   * ✅ TrackBy function สำหรับ Priority dropdown
   */
  trackByPriorityOption(index: number, option: PriorityDDLItem): number {
    return option.id;
  }

  refreshAssigneeList(): void {
    console.log('Refreshing assignee list...');

    this.isLoadingAssignees = true;
    this.assigneeError = '';
    this.assigneeList = [];
    this.selectedAssigneeId = null;

    this.apiService.getRole9Users().subscribe({
      next: (response: Role9UsersResponse) => {
        if (response && response.users && Array.isArray(response.users)) {
          this.assigneeList = response.users.map(user => ({
            id: user.id,
            username: user.username || user.name || `user_${user.id}`,
            firstname: user.firstname || '',
            lastname: user.lastname || '',
            email: user.email || '',
            isenabled: true,
            full_name: user.name || getUserFullName(user)
          }));

          if (this.assigneeList.length === 0) {
            this.assigneeError = 'ไม่พบรายชื่อผู้รับมอบหมาย';
          }
        } else {
          this.assigneeError = 'รูปแบบข้อมูลจาก API ไม่ถูกต้อง';
        }
      },
      error: (error) => {
        console.error('Error loading assignees:', error);
        this.assigneeError = 'เกิดข้อผิดพลาดในการโหลดรายชื่อผู้รับมอบหมาย';
      },
      complete: () => {
        this.isLoadingAssignees = false;
      }
    });
  }

  isAssigneeDropdownReady(): boolean {
    return !this.isLoadingAssignees &&
      !this.assigneeError &&
      this.assigneeList.length > 0;
  }

  getUserDisplayName(user: UserListItem): string {
    return `${getUserFullName(user)} (${user.id})`;
  }

  // 7️⃣ แก้ไข getSelectedAssigneeName() - รองรับ temp name
  getSelectedAssigneeName(): string {
    if (!this.selectedAssigneeId && !this.tempAssigneeName) {
      return '';
    }

    // ✅ ถ้ามี selectedAssigneeId ให้ใช้จาก assignee list
    if (this.selectedAssigneeId) {
      const selectedUser = this.assigneeList.find(u => u.id === this.selectedAssigneeId);
      return selectedUser ? this.getUserFullName(selectedUser) : '';
    }

    // ✅ ถ้าไม่มี ID แต่มี temp name ให้ใช้ temp name
    return this.tempAssigneeName || '';
  }

  onFileSelected(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    if (!input?.files?.length) return;

    const newFiles = Array.from(input.files);

    // ✅ ตรวจจำนวนรวมก่อนเพิ่ม
    const totalFiles = this.existingFixAttachments.length + this.selectedFiles.length + newFiles.length;
    if (totalFiles > this.maxFiles) {
      const availableSlots = this.maxFiles - (this.existingFixAttachments.length + this.selectedFiles.length);
      if (availableSlots <= 0) {
        console.warn('⚠️ จำนวนไฟล์แนบถึงขีดจำกัดแล้ว');
        return;
      }
      // ✅ ถ้าเกิน ให้ตัดเฉพาะจำนวนที่เหลือ
      this.addSelectedFiles(newFiles.slice(0, availableSlots));
    } else {
      this.addSelectedFiles(newFiles);
    }

    // ✅ clear input เพื่อให้เลือกไฟล์ซ้ำได้
    input.value = '';
  }

  onAttachmentsDrop(evt: DragEvent): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.dragCounter = 0;
    this.isDraggingFiles = false;

    if (!this.isFormReady() || this.supporterFormState.isSaving) return;
    if (!evt.dataTransfer || !evt.dataTransfer.files?.length) return;

    const droppedFiles = Array.from(evt.dataTransfer.files);

    // ✅ ตรวจจำนวนรวมก่อนเพิ่ม
    const totalFiles = this.existingFixAttachments.length + this.selectedFiles.length + droppedFiles.length;
    if (totalFiles > this.maxFiles) {
      const availableSlots = this.maxFiles - (this.existingFixAttachments.length + this.selectedFiles.length);
      if (availableSlots <= 0) {
        console.warn('⚠️ จำนวนไฟล์แนบถึงขีดจำกัดแล้ว');
        return;
      }
      this.addSelectedFiles(droppedFiles.slice(0, availableSlots));
    } else {
      this.addSelectedFiles(droppedFiles);
    }
  }

  /**
 * ✅ ตรวจว่าจำนวนไฟล์รวมถึงขีดจำกัดแล้วหรือยัง
 */
  isFileLimitReached(): boolean {
    const total = (this.existingFixAttachments?.length || 0) + (this.selectedFiles?.length || 0);
    return total >= this.maxFiles;
  }

  /** Handle drag over */
  onAttachmentsDragOver(evt: DragEvent): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.dragCounter++;
    this.isDraggingFiles = true;
  }

  /** Handle drag leave */
  onAttachmentsDragLeave(evt: DragEvent): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.dragCounter = Math.max(0, this.dragCounter - 1);
    if (this.dragCounter === 0) {
      this.isDraggingFiles = false;
    }
  }

  /** Add files to selectedFiles with basic validation and maxFiles guard */
  private addSelectedFiles(files: File[] | FileList): void {
    const list = Array.isArray(files) ? files : Array.from(files);


    const allowedExt = [
      'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'txt', 'xlsx', 'csv'
    ];


    for (const file of list) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!allowedExt.includes(ext)) {
        // keep UX simple: we just skip invalid ones; you can surface a toast if you want
        continue;
      }


      if (this.maxFiles && this.selectedFiles.length >= this.maxFiles) {
        break; // reached the limit
      }


      // avoid obvious duplicates (same name+size)
      if (this.selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
        continue;
      }


      this.selectedFiles.push(file);
    }
  }

  removeSelectedFile(index: number): void {
    // ✅ NEW: RBAC Check (ป้องกันการลบผ่าน console)
    if (!this.isSupporter) {
      console.warn('User does not have permission to remove files.');
      return;
    }

    const file = this.selectedFiles[index];

    // Revoke blob URL if exists
    if (this.filePreviewUrls[file.name] && this.filePreviewUrls[file.name].startsWith('blob:')) {
      URL.revokeObjectURL(this.filePreviewUrls[file.name]);
      delete this.filePreviewUrls[file.name];
    }

    this.selectedFiles.splice(index, 1);
    this.fileUploadProgress.splice(index, 1);

    if (this.selectedFiles.length === 0) {
      this.supporterFormState.error = null;
    }

    console.log('File removed. Remaining files:', this.selectedFiles.length);
  }

  private validateSupporterForm(): void {
    const formValue = this.supporterForm.value;

    // ✅ Due date validation - เฉพาะเมื่อ dirty/touched
    if (formValue.due_date && this.supporterForm.get('due_date')?.dirty) {
      const dueDate = new Date(formValue.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        this.supporterFormValidation.due_date = {
          isValid: false,
          error: 'วันครบกำหนดต้องไม่เป็นวันที่ผ่านมาแล้ว'
        };
      } else {
        this.supporterFormValidation.due_date = { isValid: true };
      }
    } else {
      this.supporterFormValidation.due_date = { isValid: true };
    }

    // ✅ Close estimate validation - เฉพาะเมื่อ dirty/touched
    if (formValue.close_estimate && this.supporterForm.get('close_estimate')?.dirty) {
      const closeDate = new Date(formValue.close_estimate);
      const now = new Date();

      if (closeDate < now) {
        this.supporterFormValidation.close_estimate = {
          isValid: false,
          error: 'เวลาประมาณการปิดต้องไม่เป็นเวลาที่ผ่านมาแล้ว'
        };
      } else {
        this.supporterFormValidation.close_estimate = { isValid: true };
      }
    } else {
      this.supporterFormValidation.close_estimate = { isValid: true };
    }

    // ✅ Fix Issue Description validation - เช็คเมื่อมีการเลือก Action ที่ต้องการ Issue Resolution (3, 4, 5)
    const currentActionId = parseInt(formValue.action.toString());
    
    // 💡 แก้ไข: ใช้การเปรียบเทียบแบบ OR condition แทน .includes() เพื่อแก้ Type Error
    const needsResolution = (
        currentActionId === TICKET_STATUS_IDS.IN_PROGRESS ||
        currentActionId === TICKET_STATUS_IDS.RESOLVED ||
        currentActionId === TICKET_STATUS_IDS.COMPLETED
    );
    
    // หากต้องการ Issue Resolution แต่เนื้อหาว่างเปล่า (หรือเป็นแค่ <br>)
    if (needsResolution && (!formValue.fix_issue_description || formValue.fix_issue_description.trim() === '' || formValue.fix_issue_description.trim() === '<br>')) {
        this.supporterFormValidation.fix_issue_description = {
            isValid: false,
            error: 'เมื่อเปลี่ยนสถานะเป็น In Progress/Resolved/Completed ต้องกรอก Issue Resolution'
        };
    } else {
        this.supporterFormValidation.fix_issue_description = { isValid: true };
    }
  }

  hasFieldError(fieldName: keyof SupporterFormValidation): boolean {
    return !this.supporterFormValidation[fieldName].isValid;
  }

  getFieldError(fieldName: keyof SupporterFormValidation): string {
    return this.supporterFormValidation[fieldName].error || '';
  }

  onSaveAll(): void {
    console.log('Unified save started');

    if (!this.canUserSaveSupporter && !this.canAssignTicket()) {
      this.supporterFormState.error = 'คุณไม่มีสิทธิ์ในการบันทึกข้อมูล';
      return;
    }

    if (!this.ticketData?.ticket) {
      this.supporterFormState.error = 'ไม่พบข้อมูล ticket';
      return;
    }

    const hasSupporterChanges = this.hasSupporterFormChanges();
    const hasAssigneeChanged = this.selectedAssigneeId !== null &&
      this.selectedAssigneeId !== this.originalAssigneeId; // ✅ ใหม่

    if (!hasSupporterChanges && !hasAssigneeChanged) { // ✅ แก้จาก hasAssigneeSelected เป็น hasAssigneeChanged
      this.supporterFormState.error = 'ไม่มีการเปลี่ยนแปลงข้อมูล';
      return;
    }

    // ✅ CRITICAL: Force validation before saving
    this.validateSupporterForm();
    if (!this.supporterForm.valid || !this.supporterFormValidation.fix_issue_description.isValid) {
        this.markFormGroupTouched();
        this.supporterFormState.error = 'กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง (รวมถึง Issue Resolution)';
        return;
    }

    this.supporterFormState.isSaving = true;
    this.supporterFormState.error = null;

    this.executeSaveSequence(hasSupporterChanges, hasAssigneeChanged); // ✅ แก้จาก hasAssigneeSelected
  }

  private async executeSaveSequence(
    hasSupporterChanges: boolean,
    hasAssigneeChanged: boolean // ✅ แก้ชื่อ parameter จาก hasAssigneeSelected
  ): Promise<void> {
    try {
      let supporterSuccess = false;
      let assignSuccess = false;

      if (hasSupporterChanges && this.canUserSaveSupporter) {
        console.log('Saving supporter data...');
        supporterSuccess = await this.saveSupporterData();
        if (!supporterSuccess) {
          this.supporterFormState.isSaving = false;
          return;
        }
      } else {
        supporterSuccess = true;
      }

      // ✅ แก้ไขเงื่อนไขนี้
      if (hasAssigneeChanged && this.canAssignTicket()) { // ✅ แก้จาก hasAssigneeSelected
        console.log('Assigning ticket...');
        assignSuccess = await this.assignTicketData();
      } else {
        assignSuccess = true;
      }

      this.handleUnifiedSaveResult(
        supporterSuccess,
        assignSuccess,
        hasSupporterChanges,
        hasAssigneeChanged // ✅ แก้จาก hasAssigneeSelected
      );

    } catch (error) {
      console.error('Error in save sequence:', error);
      this.supporterFormState.error = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
    } finally {
      this.supporterFormState.isSaving = false;
    }
  }

  private saveSupporterData(): Promise<boolean> {
    return new Promise((resolve) => {
      // ⚠️ Note: Form validation ถูกเรียกแล้วใน onSaveAll()

      const formData = this.createSupporterFormData();

      if (!formData.status_id) {
        this.supporterFormState.error = 'กรุณาเลือก Action ที่ต้องการดำเนินการ';
        resolve(false);
        return;
      }

      // Validate files ก่อน
      if (this.selectedFiles.length > 0) {
        const fileValidation = this.validateFixIssueFiles(this.selectedFiles);
        if (!fileValidation.valid) {
          this.supporterFormState.error = fileValidation.errors.join(', ');
          resolve(false);
          return;
        }
      }

      const validation = this.ticketService.validateSupporterData(formData, this.selectedFiles);
      if (!validation.isValid) {
        this.supporterFormState.error = validation.errors.join(', ');
        resolve(false);
        return;
      }

      // ส่งไฟล์เป็น [] เพราะจะอัปโหลดแยก
      this.ticketService.saveSupporter(this.ticket_no, formData, [])
        .subscribe({
          next: async (response: SaveSupporterResponse) => {
            if (response.success) {
              console.log('✅ Supporter data saved');

              // ✅ เพิ่ม Debug Log เพื่อดู response จาก Backend
              console.log('🔍 Backend Response:', {
                ticket: response.data?.ticket,
                status_id: response.data?.ticket?.status_id,
                status_name: response.data?.ticket?.status_name,
                priority_id: response.data?.ticket?.priority_id
              });

              // อัปโหลดไฟล์แนบหลังจากบันทึกสำเร็จ
              let filesUploaded = true;
              if (this.selectedFiles.length > 0 && this.ticketData?.ticket?.id) {
                filesUploaded = await this.uploadFixIssueAttachments(
                  this.ticketData.ticket.id,
                  this.selectedFiles
                );

                if (!filesUploaded) {
                  console.warn('⚠️ Some files failed to upload');
                  this.supporterFormState.successMessage =
                    'บันทึกข้อมูลสำเร็จ แต่มีไฟล์บางไฟล์อัปโหลดไม่สำเร็จ';
                }
              }

              // Emit event พร้อมข้อมูลไฟล์
              this.supporterDataSaved.emit({
                ...response,
              });

              resolve(true);
            } else {
              this.supporterFormState.error = response.message || 'ไม่สามารถบันทึกข้อมูล Supporter ได้';
              resolve(false);
            }
          },
          error: (error) => {
            console.error('Error saving supporter data:', error);
            this.supporterFormState.error = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล Supporter';
            resolve(false);
          }
        });
    });
  }

  private assignTicketData(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.selectedAssigneeId) {
        resolve(false);
        return;
      }

      const selectedUser = this.assigneeList.find(u => u.id === this.selectedAssigneeId);
      if (!selectedUser) {
        this.assigneeError = 'ผู้รับมอบหมายที่เลือกไม่ถูกต้อง';
        resolve(false);
        return;
      }

      const payload: AssignTicketPayload = {
        ticketNo: this.ticketData!.ticket!.ticket_no,
        assignTo: selectedUser.id
      };

      this.apiService.assignTicket(payload).subscribe({
        next: (response: AssignTicketResponse) => {
          if (response && response.ticket_no && response.assigned_to) {
            this.ticketAssigned.emit(response);
            resolve(true);
          } else {
            this.assigneeError = (response as any)?.message || 'ไม่สามารถมอบหมาย ticket ได้';
            resolve(false);
          }
        },
        error: (error) => {
          console.error('Error assigning ticket:', error);
          this.assigneeError = 'เกิดข้อผิดพลาดในการมอบหมาย ticket';
          resolve(false);
        }
      });
    });
  }

  /**
   * 🔄 ปรับปรุง handleUnifiedSaveResult - ลบ persisted data เมื่อบันทึกสำเร็จ
   */
  private handleUnifiedSaveResult(
    supporterSuccess: boolean,
    assignSuccess: boolean,
    hadSupporterChanges: boolean,
    hadAssigneeChanged: boolean // ✅ แก้ชื่อ parameter จาก hadAssigneeSelected
  ): void {
    const allSuccess = (!hadSupporterChanges || supporterSuccess) &&
      (!hadAssigneeChanged || assignSuccess); // ✅ แก้จาก hadAssigneeSelected

    if (allSuccess) {
      console.log('✅ Save successful - refreshing form data');

      // ✅ Reset original assignee เป็นค่าใหม่
      this.originalAssigneeId = this.selectedAssigneeId;

      // ✅ NEW: ลบข้อมูลที่บันทึกไว้เมื่อบันทึกสำเร็จ
      if (this.ticket_no && this.currentUserId) {
        const storageKey = this.getStorageKey();
        localStorage.removeItem(storageKey);
        console.log('🗑️ Cleared persisted data after successful save');
      }

      localStorage.removeItem(this.formPersistenceKey);
      this.lastFormSnapshot = null;

      this.formDataBeforeRefresh = { ...this.supporterForm.value };
      this.justSaved = true;

      this.selectedFiles = [];
      this.fileUploadProgress = [];

      // ✅ เพิ่มบรรทัดนี้แทน - Clear formDataBeforeRefresh
      this.formDataBeforeRefresh = null;

      // ✅ CRITICAL: รีเฟรชข้อมูล ticket หลังบันทึก
      this.refreshRequired.emit();

      this.supporterFormState.successMessage = 'บันทึกข้อมูลสำเร็จแล้ว';
      setTimeout(() => {
        this.supporterFormState.successMessage = null;
      }, 3000);
    }

    console.log('Unified save completed:', { supporterSuccess, assignSuccess, allSuccess });
  }

  private createSupporterFormData(): SaveSupporterFormData {
    const formValue = this.supporterForm.value;
    const formData: SaveSupporterFormData = {};

    if (formValue.action !== null && formValue.action !== '' && formValue.action !== undefined) {
      const statusId = parseInt(formValue.action.toString());
      if (!isNaN(statusId) && statusId > 0) {
        formData.status_id = statusId;
      }
    }

    // ✅ เพิ่มโค้ดนี้ทันทีหลัง status_id mapping
    // ✅ เพิ่ม priority mapping
    if (formValue.priority !== null && formValue.priority !== undefined && formValue.priority !== '') {
      const priorityId = parseInt(formValue.priority.toString());
      if (!isNaN(priorityId) && priorityId > 0) {
        formData.priority = priorityId;
        console.log('✅ Adding priority to form data:', priorityId);
      }
    }

    if (this.estimateTime > 0) {
      formData.estimate_time = Math.round(this.estimateTime);
    }

    if (formValue.due_date) {
      formData.due_date = formValue.due_date;
    }

    if (this.leadTime > 0) {
      formData.lead_time = Math.round(this.leadTime);
    }

    if (formValue.close_estimate) {
      formData.close_estimate = formValue.close_estimate;
    }

    // ✅ NEW: ใช้ formValue.fix_issue_description โดยตรง (เป็น HTML)
    if (formValue.fix_issue_description) {
      formData.fix_issue_description = formValue.fix_issue_description.trim();
    }

    if (formValue.related_ticket_id) {
      formData.related_ticket_id = formValue.related_ticket_id.trim();
    }

    return formData;
  }

  hasSupporterFormChanges(): boolean {
    if (!this.supporterForm) return false;

    const formValue = this.supporterForm.value;

    if (formValue.action && formValue.action !== '') {
      return true;
    }

    // ✅ แก้ไข: ตรวจสอบ fix_issue_description ที่เป็น HTML ด้วย
    const isFixIssueDescriptionChanged = formValue.fix_issue_description && 
      formValue.fix_issue_description.trim() !== '' && 
      formValue.fix_issue_description.trim() !== '<br>'; // ตรวจสอบ <br> ที่เกิดจาก contenteditable

    const hasOptionalChanges =
      (formValue.priority !== null && formValue.priority !== '') || // ✅ เพิ่มบรรทัดนี้
      (formValue.estimate_time && formValue.estimate_time !== '') ||
      (formValue.due_date && formValue.due_date !== '') ||
      (formValue.lead_time && formValue.lead_time !== '') ||
      (formValue.close_estimate && formValue.close_estimate !== '') ||
      isFixIssueDescriptionChanged ||
      (formValue.related_ticket_id && formValue.related_ticket_id.trim() !== '') ||
      (this.selectedFiles && this.selectedFiles.length > 0);

    return hasOptionalChanges;
  }

  canSaveAll(): boolean {
    const hasPermission = this.canUserSaveSupporter || this.canAssignTicket();

    // ✅ แก้ไขเงื่อนไข - ตรวจสอบว่า Assignee เปลี่ยนแปลงจริงหรือไม่
    const hasAssigneeChanged = this.selectedAssigneeId !== null &&
      this.selectedAssigneeId !== this.originalAssigneeId;

    const hasChanges = this.hasSupporterFormChanges() || hasAssigneeChanged; // ✅ แก้จาก (this.selectedAssigneeId !== null)

    const notLoading = !this.supporterFormState.isSaving;
    const hasTicket = !!this.ticketData?.ticket;
    const formReady = this.isFormReady();

    // ✅ CRITICAL: เพิ่มการตรวจสอบ form.valid และ fix_issue_description validation
    const formValid = this.supporterForm?.valid && this.supporterFormValidation.fix_issue_description.isValid;

    return hasPermission && hasChanges && notLoading && hasTicket && formReady && formValid;
  }

  getSaveAllButtonText(): string {
    if (this.supporterFormState.isSaving) {
      return 'กำลังบันทึก...';
    }

    if (!this.isFormReady()) {
      return 'รอข้อมูล';
    }

    if (!this.canUserSaveSupporter && !this.canAssignTicket()) {
      return 'ไม่มีสิทธิ์';
    }

    const hasSupporterChanges = this.hasSupporterFormChanges();
    // ✅ แก้ไขเงื่อนไข
    const hasAssigneeChanged = this.selectedAssigneeId !== null &&
      this.selectedAssigneeId !== this.originalAssigneeId;

    if (hasSupporterChanges && hasAssigneeChanged) { // ✅ แก้จาก hasAssigneeSelected
      return 'Save & Assign';
    } else if (hasSupporterChanges) {
      return 'Save';
    } else if (hasAssigneeChanged) { // ✅ แก้จาก hasAssigneeSelected
      return 'Assign';
    }

    return 'Save';
  }

  getSaveAllButtonClass(): string {
    const baseClass = 'save-btn';

    if (!this.canSaveAll()) {
      return `${baseClass} disabled`;
    }

    if (this.supporterFormState.isSaving) {
      return `${baseClass} loading`;
    }

    return baseClass;
  }

  getSaveAllButtonTooltip(): string {
    if (this.supporterFormState.isSaving) {
      return 'กำลังดำเนินการ...';
    }

    if (!this.isFormReady()) {
      return this.getFormStatusMessage();
    }

    if (!this.canUserSaveSupporter && !this.canAssignTicket()) {
      return 'คุณไม่มีสิทธิ์ในการบันทึกหรือมอบหมาย';
    }

    // ✅ แก้ไขเงื่อนไข
    const hasAssigneeChanged = this.selectedAssigneeId !== null &&
      this.selectedAssigneeId !== this.originalAssigneeId;

    if (!this.hasSupporterFormChanges() && !hasAssigneeChanged) { // ✅ แก้จาก selectedAssigneeId === null
      return 'ไม่มีการเปลี่ยนแปลงข้อมูล';
    }

    const actions = [];
    if (this.hasSupporterFormChanges()) {
      actions.push('บันทึกข้อมูล Supporter');
    }
    if (hasAssigneeChanged) { // ✅ แก้จาก this.selectedAssigneeId !== null
      const selectedUser = this.assigneeList.find(u => u.id === this.selectedAssigneeId);
      const userName = selectedUser ? getUserFullName(selectedUser) : 'ผู้ใช้ที่เลือก';
      actions.push(`มอบหมายให้กับ ${userName}`);
    }

    return actions.join(' และ ');
  }

  private resetSupporterForm(): void {
    this.supporterForm.patchValue({
      action: '',
      priority: null // ✅ เพิ่ม
    });

    this.selectedFiles = [];
    this.fileUploadProgress = [];

    // ✅ เพิ่มบรรทัดนี้
    this.originalAssigneeId = this.selectedAssigneeId; // Reset original เป็นค่าปัจจุบัน

    this.supporterFormValidation = {
      estimate_time: { isValid: true },
      due_date: { isValid: true },
      lead_time: { isValid: true },
      close_estimate: { isValid: true },
      fix_issue_description: { isValid: true },
      related_ticket_id: { isValid: true },
      attachments: { isValid: true }
    };

    // ✅ NEW: Clear Rich Editor Content
    if (this.fixIssueEditor?.nativeElement) {
      this.fixIssueEditor.nativeElement.innerHTML = '';
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.supporterForm.controls).forEach(key => {
      this.supporterForm.get(key)?.markAsTouched();
    });
  }

  private getCurrentStatusId(): number {
    return this.ticketData?.ticket?.status_id || 1;
  }

  getFormDebugInfo() {
    const persistenceStatus = this.getFormPersistenceStatus();

    return {
      hasFormData: this.hasFormData(),
      justSaved: this.justSaved,
      hasSnapshot: !!this.formStateSnapshot,
      hasBeforeRefreshData: !!this.formDataBeforeRefresh,
      isRefreshing: this.isRefreshing,
      formValue: this.supporterForm?.value,
      persistence: persistenceStatus,
      ticketNo: this.ticket_no,
      estimateTime: this.estimateTime,
      leadTime: this.leadTime,
      openTicketDate: this.getOpenTicketDate()
    };
  }

  // ✅ สำหรับระบบพรีวิวไฟล์
  selectedAttachment: any = null;
  showFileModal = false;

  onAttachmentClick(file: any) {
    console.log('📎 เปิดพรีวิวไฟล์แนบจาก supporter form:', file);
    this.selectedAttachment = file;
    this.showFileModal = true;
  }

  // support-information-form.component.ts
  onExistingAttachmentDelete(file: any): void {
    console.log('📩 EVENT มาถึง parent แล้ว:', file);

    const fileId = file.attachment_id || file.id;
    if (!fileId) {
      console.warn('⚠️ ไม่มี id หรือ attachment_id:', file);
      return;
    }

    const confirmDelete = confirm('ต้องการลบไฟล์นี้หรือไม่?');
    if (!confirmDelete) return;

    this.ticketService.deleteFixIssueAttachment(fileId).subscribe({
      next: () => {
        const updatedList = this.existingFixAttachments.filter(
          (f) => f.attachment_id !== fileId
        );

        // ✅ บังคับ Angular ให้ refresh UI ทันที
        this.existingFixAttachments = [...updatedList];

        console.log('✅ ลบไฟล์สำเร็จ:', fileId);
      },
      error: (err) => {
        console.error('❌ ลบไฟล์ไม่สำเร็จ:', err);
      },
    });
  }

  getPriorityName(id: number): string {
    const option = this.priorityDropdownOptions?.find(o => o.id === id);
    return option ? option.name : '-';
  }

  // ปิด modal แสดงไฟล์แนบ
  closeModal(): void {
    this.showFileModal = false;
    this.selectedAttachment = null;
  }

  /**
 * 🆕 เพิ่ม method สำหรับ debug form state
 */
  public debugFormState(): void {
    console.log('=== FORM STATE DEBUG ===');
    console.log('Ticket Data:', this.ticketData);
    console.log('Form Value:', this.supporterForm?.value);
    console.log('Form Valid:', this.supporterForm?.valid);
    console.log('Form Errors:', this.supporterForm?.errors);
    console.log('Estimate Time:', this.estimateTime);
    console.log('Lead Time:', this.leadTime);
    console.log('Selected Assignee:', this.selectedAssigneeId);
    console.log('Has Persisted Data:', this.hasPersistedDataForCurrentTicket());
    console.log('======================');
  }
}