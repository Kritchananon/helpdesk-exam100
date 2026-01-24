import { Component, OnInit, Input, Output, EventEmitter, inject, OnChanges, SimpleChanges, HostListener, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, Subscription, takeUntil, debounceTime } from 'rxjs'; // ✅ Import debounceTime

// ✅ เรียกใช้ LanguageService โดยตรง
import { LanguageService } from '../../../../shared/services/language.service';

// Import TicketData จาก ticket-detail component
import { TicketData } from '../ticket-detail.component';

// API Services
import {
  ApiService,
  StatusDDLItem,
  StatusDDLResponse,
  GetTicketDataRequest,
  GetTicketDataResponse,
  RelatedTicketItem // ✅ 1. เพิ่ม Import RelatedTicketItem
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
  PriorityDDLItem,
  PriorityDDLResponse
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

import {
  permissionEnum
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

  isAdmin: boolean = false;
  isSupporter: boolean = false;
  canEditAssignee = false;

  isDraggingFiles = false;
  private dragCounter = 0;

  private deletingAttachmentIds = new Set<number>();

  isDeletingAttachment(id: number | null | undefined): boolean {
    return !!id && this.deletingAttachmentIds.has(id);
  }

  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  public ticketService = inject(TicketService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private languageService = inject(LanguageService);

  public apiUrl = environment.apiUrl;
  private businessHoursCalculator: BusinessHoursCalculator;

  @Input() ticketData: TicketData | null = null;
  @Input() ticket_no: string = '';
  @Input() isLoadingTicketData: boolean = false;

  @Output() supporterDataSaved = new EventEmitter<SaveSupporterResponse>();
  @Output() ticketAssigned = new EventEmitter<AssignTicketResponse>();
  @Output() refreshRequired = new EventEmitter<void>();

  isComponentInitialized = false;
  hasTicketDataChanged = false;

  supporterForm!: FormGroup;
  supporterFormState: SupporterFormState = {
    isVisible: true,
    isLoading: false,
    isSaving: false,
    error: null,
    successMessage: null
  };

  actionDropdownOptions: ActionDropdownOption[] = [];
  statusList: StatusDDLItem[] = [];
  isLoadingActions = false;
  actionError = '';

  isLoadingAssignees: boolean = false;
  assigneeError: string = '';
  selectedAssigneeId: number | null = null;
  assigneeList: UserListItem[] = [];

  // ✅ 2. เพิ่มตัวแปรสำหรับ Related Tickets
  relatedTicketsList: RelatedTicketItem[] = [];
  isLoadingRelatedTickets = false;

  private originalAssigneeId: number | null = null;

  // ===== Priority Properties (Updated) =====
  priorityDropdownOptions: PriorityDDLItem[] = [];
  isLoadingPriorities = false;
  priorityError = '';
  canUserChangePriority = false;
  
  // ✅ เก็บข้อมูลดิบจาก API
  private rawPriorityList: PriorityDDLItem[] = [];
  
  // ✅ Map ID เข้ากับ Translation Key
  private readonly PRIORITY_TRANSLATION_MAP: { [key: number]: string } = {
    1: 'tickets.priorityLow',
    2: 'tickets.priorityMedium',
    3: 'tickets.priorityHigh'
  };

  selectedFiles: File[] = [];
  fileUploadProgress: FileUploadProgress[] = [];
  existingFixAttachments: ExistingAttachment[] = [];
  maxFiles = 5;
  maxFileSize = 10 * 1024 * 1024; // 10MB

  private filePreviewUrls: { [key: string]: string } = {};

  supporterFormValidation: SupporterFormValidation = {
    estimate_time: { isValid: true },
    due_date: { isValid: true },
    lead_time: { isValid: true },
    close_estimate: { isValid: true },
    fix_issue_description: { isValid: true },
    related_ticket_id: { isValid: true },
    attachments: { isValid: true }
  };

  canUserSaveSupporter = false;

  justSaved = false;
  formDataBeforeRefresh: any = null;
  formStateSnapshot: any = null;
  isRefreshing = false;
  private formPersistenceKey = 'support-form-data';
  private lastFormSnapshot: any = null;
  private formChangeSubscription: any = null;

  private readonly PERSISTENCE_KEY_PREFIX = 'support_form_';
  private currentUserId: number | null = null;

  isUploadingFixAttachment = false;
  fixAttachmentUploadError = '';

  attachmentTypes: {
    [key: number]: {
      type: 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file';
      extension: string;
      filename: string;
      isLoading?: boolean;
      isAnalyzed?: boolean;
    }
  } = {};

  @ViewChild('fixIssueEditor') fixIssueEditor!: ElementRef;
  @ViewChild('richImgInput') richImgInput!: ElementRef;

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

  private langSubscription: Subscription | null = null;

  constructor() {
    this.businessHoursCalculator = new BusinessHoursCalculator();
    this.initializeHolidays();
  }

  // ✅ Getter สำหรับตรวจสอบว่าเลือก Action เป็น Resolved หรือไม่
  get isResolvedActionSelected(): boolean {
    const actionVal = this.supporterForm.get('action')?.value;
    if (!actionVal) return false;
    
    // แปลงค่าเป็น Int เพื่อเทียบกับ ID ของ Resolved
    const actionId = parseInt(actionVal.toString());
    
    // TICKET_STATUS_IDS.RESOLVED คือ 4
    return actionId === TICKET_STATUS_IDS.RESOLVED; 
  }

  // ✅ 3. เพิ่ม Getter ตรวจสอบว่า Action ที่เลือกคือ In Progress หรือไม่
  get isInProgressActionSelected(): boolean {
    const actionVal = this.supporterForm.get('action')?.value;
    if (!actionVal) return false;
    
    const actionId = parseInt(actionVal.toString());
    // ID 3 = In Progress
    return actionId === 3; 
  }

  translate(key: string, params?: any): string {
    return this.languageService.translate(key, params);
  }

  private initializeHolidays(): void {
    const holidays2025 = [
      new Date('2025-01-01'), new Date('2025-02-12'), new Date('2025-04-06'),
      new Date('2025-04-13'), new Date('2025-04-14'), new Date('2025-04-15'),
      new Date('2025-05-01'), new Date('2025-05-05'), new Date('2025-05-12'),
      new Date('2025-06-03'), new Date('2025-07-10'), new Date('2025-07-28'),
      new Date('2025-08-12'), new Date('2025-10-13'), new Date('2025-10-23'),
      new Date('2025-12-05'), new Date('2025-12-10'), new Date('2025-12-31'),
    ];

    this.businessHoursCalculator.setHolidays(holidays2025);
  }

  ngOnInit(): void {
    console.log('SupportInformationFormComponent initialized');
    
    this.currentUserId = this.authService.getCurrentUser()?.id || null;

    this.initializeSupporterForm();
    this.checkUserPermissions();
    this.initializeAssigneeList();

    this.setupFormPersistence();
    this.setupAutoCalculation();

    if (this.ticketData?.ticket) {
      this.updateFormWithTicketData();
      this.loadExistingFixAttachments();
    } else if (this.ticket_no) {
      this.loadTicketDataFromBackend();
    }

    this.isComponentInitialized = true;

    const roleIds = this.authService.getCurrentUser()?.roleIds || [];
    this.canEditAssignee = roleIds.includes(19);

    // ✅ ใช้ translationsLoaded$ เพื่อรอให้ภาษาโหลดเสร็จก่อน (แก้ Race Condition)
    this.langSubscription = this.languageService.translationsLoaded$.subscribe((isLoaded) => {
        if (isLoaded) {
            // --- จัดการ Priority ---
            if (this.rawPriorityList.length === 0 && !this.isLoadingPriorities) {
                this.loadPriorityDropdownOptions(); 
            } else {
                this.buildPriorityDropdownOptions();
            }

            // --- จัดการ Action Status ---
            if (this.statusList.length === 0 && !this.isLoadingActions) {
                this.loadActionDropdownOptions();
            } else {
                this.buildActionDropdownOptions();
            }
            
            this.cdr.markForCheck(); 
        }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ticket_no'] && this.isComponentInitialized) {
      const ticketNoChange = changes['ticket_no'];
      if (!ticketNoChange.isFirstChange() && ticketNoChange.currentValue) {
        this.loadTicketDataFromBackend();
        return;
      }
    }

    if (changes['ticketData'] && this.isComponentInitialized) {
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
      if (changes['isLoadingTicketData'].currentValue === true && !this.isRefreshing) {
        this.takeFormSnapshot();
      }
    }

    setTimeout(() => {
      if (this.ticketData?.fix_attachment) {
        this.loadExistingFixAttachments();
      }
      if (this.fixIssueEditor?.nativeElement && this.ticketData?.ticket?.fix_issue_description) {
        this.fixIssueEditor.nativeElement.innerHTML = this.ticketData.ticket.fix_issue_description;
      }
    }, 500);
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnloadHandler(event: Event): void {
    if (this.hasFormData()) {
      this.persistAllFormData();
    }
  }

  ngOnDestroy(): void {
    if (this.hasFormData()) {
      this.persistAllFormData();
    }

    Object.values(this.filePreviewUrls).forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    if (this.formChangeSubscription) {
      this.formChangeSubscription.unsubscribe();
    }

    if (this.langSubscription) {
        this.langSubscription.unsubscribe();
    }
  }

  // ... (Rich Text Editor methods) ...
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

    if (!this.toolbarState.justifyCenter && !this.toolbarState.justifyRight && !this.toolbarState.justifyFull) {
      this.toolbarState.justifyLeft = true;
    }
    this.cdr.detectChanges();
  }

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
    const url = prompt('Enter the URL:'); 
    if (url) {
      document.execCommand('createLink', false, url);
      this.checkToolbarStatus();
      this.updateFormContent();
    }
  }
  
  onEditorEvent(): void {
    this.checkToolbarStatus();
  }

  // ✅ FIX 1: ปรับ onDescriptionInput ให้ Force patch ค่า
  onDescriptionInput(event: Event): void {
    const target = event.target as HTMLElement;
    const content = target.innerHTML;
    
    // บังคับ Patch ค่าและ Mark Dirty
    this.supporterForm.controls['fix_issue_description'].setValue(content);
    this.supporterForm.controls['fix_issue_description'].markAsDirty();
    
    this.checkToolbarStatus();

    if (content && content.trim().length >= 1) {
      this.supporterFormValidation.fix_issue_description = { isValid: true };
    }
  }

  private updateFormContent(): void {
    if (this.fixIssueEditor && this.fixIssueEditor.nativeElement) {
      this.supporterForm.patchValue({ fix_issue_description: this.fixIssueEditor.nativeElement.innerHTML }, { emitEvent: false });
    }
  }

  onRichTextConfigImage(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(this.translate('supportInformation.selectImageError'));
        return;
      }
      const reader = new FileReader();
      reader.onload = (e: any) => {
        document.execCommand('insertImage', false, e.target.result);
        this.updateFormContent();
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  }

  // ... (Persistence and other helper methods) ...
  private restoreAllPersistedData(): void {
    try {
      if (!this.ticket_no || !this.currentUserId) return;
      const storageKey = this.getStorageKey();
      const savedDataStr = localStorage.getItem(storageKey);
      if (!savedDataStr) return;
      const savedData: SupportFormPersistenceData = JSON.parse(savedDataStr);
      const age = Date.now() - savedData.timestamp;
      const maxAge = 30 * 24 * 60 * 60 * 1000;
      if (age > maxAge) { localStorage.removeItem(storageKey); return; }
      if (savedData.ticket_no !== this.ticket_no || savedData.userId !== this.currentUserId) return;
      if (savedData.formData) {
        this.supporterForm.patchValue(savedData.formData, { emitEvent: false });
        if (savedData.formData.estimate_time) this.estimateTime = savedData.formData.estimate_time;
        if (savedData.formData.lead_time) this.leadTime = savedData.formData.lead_time;
        if (this.fixIssueEditor?.nativeElement && savedData.formData.fix_issue_description) {
          this.fixIssueEditor.nativeElement.innerHTML = savedData.formData.fix_issue_description;
        }
      }
      if (savedData.selectedAssigneeId) this.selectedAssigneeId = savedData.selectedAssigneeId;
      if (savedData.existingAttachments && savedData.existingAttachments.length > 0) {
        this.existingFixAttachments = savedData.existingAttachments;
        setTimeout(() => { this.analyzeAllExistingAttachments(); }, 100);
      }
    } catch (error) { console.error('Error restoring persisted data:', error); if (this.ticket_no && this.currentUserId) { localStorage.removeItem(this.getStorageKey()); } }
  }

  public persistAllFormData(): void {
    try {
      if (!this.ticket_no || !this.currentUserId) return;
      if (!this.hasFormData()) { localStorage.removeItem(this.getStorageKey()); return; }
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
    } catch (error) { this.cleanupOldPersistedData(); }
  }

  private getStorageKey(): string {
    return `${this.PERSISTENCE_KEY_PREFIX}${this.ticket_no}_${this.currentUserId}`;
  }

  private cleanupOldPersistedData(): void {
    try {
      const keysToRemove: string[] = [];
      const maxAge = 30 * 24 * 60 * 60 * 1000;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.PERSISTENCE_KEY_PREFIX)) {
          try {
            const dataStr = localStorage.getItem(key);
            if (dataStr) {
              const data: SupportFormPersistenceData = JSON.parse(dataStr);
              const age = Date.now() - data.timestamp;
              if (age > maxAge) keysToRemove.push(key);
            }
          } catch { keysToRemove.push(key); }
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) { console.error('Error cleaning up old data:', error); }
  }

  private hasPersistedDataForCurrentTicket(): boolean {
    if (!this.ticket_no || !this.currentUserId) return false;
    const storageKey = this.getStorageKey();
    const savedDataStr = localStorage.getItem(storageKey);
    if (!savedDataStr) return false;
    try {
      const savedData: SupportFormPersistenceData = JSON.parse(savedDataStr);
      return savedData.ticket_no === this.ticket_no && savedData.userId === this.currentUserId;
    } catch { return false; }
  }

  public getPersistedDataInfo(): any {
    if (!this.ticket_no || !this.currentUserId) return null;
    const storageKey = this.getStorageKey();
    const savedDataStr = localStorage.getItem(storageKey);
    if (!savedDataStr) return null;
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
    } catch { return null; }
  }

  public loadTicketDataFromBackend(): void {
    if (!this.ticket_no) return;
    this.isLoadingTicketData = true;
    this.supporterFormState.error = null;
    const request: GetTicketDataRequest = { ticket_no: this.ticket_no };
    this.apiService.getTicketData(request).subscribe({
      next: (response: GetTicketDataResponse) => {
        if (response.code === 1 && response.data) {
          this.ticketData = this.transformBackendTicketData(response.data);
          this.loadExistingFixAttachments();
          const hasPersistedData = this.hasPersistedDataForCurrentTicket();
          if (hasPersistedData) { this.restoreAllPersistedData(); } else { this.updateFormWithTicketData(); }
        } else { this.supporterFormState.error = response.message || this.translate('supportInformation.errors.noTicket'); }
      },
      error: (error) => {
        this.supporterFormState.error = this.translate('supportInformation.errors.noTicket');
        const hasPersistedData = this.hasPersistedDataForCurrentTicket();
        if (hasPersistedData) { this.restoreAllPersistedData(); }
      },
      complete: () => { this.isLoadingTicketData = false; }
    });
  }

  private transformBackendTicketData(backendData: any): TicketData {
    return {
      ticket: backendData.ticket || null,
      issue_attachment: backendData.issue_attachment || [],
      fix_attachment: backendData.fix_attachment || [],
      status_history: backendData.status_history || [],
      assign: backendData.assign || []
    };
  }

  private refreshTicketData(): void {
    this.loadTicketDataFromBackend();
  }

  public loadTicket(ticketNo: string): void {
    this.ticket_no = ticketNo;
    this.loadTicketDataFromBackend();
  }

  public refreshCurrentTicket(): void {
    if (this.ticket_no) {
      this.refreshTicketData();
    }
  }

  public isLoading(): boolean { return this.isLoadingTicketData; }
  public getCurrentTicketData(): TicketData | null { return this.ticketData; }
  public hasTicketData(): boolean { return !!this.ticketData?.ticket; }

  private async uploadFixIssueAttachments(ticketId: number, files: File[]): Promise<boolean> {
    if (!files || files.length === 0) return true;
    try {
      this.isUploadingFixAttachment = true;
      this.fixAttachmentUploadError = '';
      const formData = new FormData();
      formData.append('ticket_id', ticketId.toString());
      files.forEach(file => formData.append('files', file));
      const token = this.authService.getToken();
      const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });
      const response = await this.http.patch<UploadFixIssueAttachmentResponse>(`${this.apiUrl}/fix_issue/attachment`, formData, { headers }).toPromise();
      if (response && response.success) { return true; } else { this.fixAttachmentUploadError = response?.message || 'ไม่สามารถอัปโหลดไฟล์ได้'; return false; }
    } catch (error: any) { this.fixAttachmentUploadError = error?.error?.message || 'เกิดข้อผิดพลาดในการอัปโหลด'; return false; } finally { this.isUploadingFixAttachment = false; }
  }

  private loadExistingFixAttachments(): void {
    if (!this.ticketData?.fix_attachment) { this.existingFixAttachments = []; return; }
    this.existingFixAttachments = this.ticketData.fix_attachment.map(att => {
      let previewUrl: string | undefined = undefined;
      let isImage = false;
      const extension = att.filename ? att.filename.split('.').pop()?.toLowerCase() : att.path.split('.').pop()?.toLowerCase();
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
      isImage = imageExtensions.includes(extension || '');
      if (isImage) {
        if (att.path.startsWith('http://') || att.path.startsWith('https://')) { previewUrl = att.path; } else { previewUrl = `${this.apiUrl}${att.path.startsWith('/') ? '' : '/'}${att.path}`; }
      }
      return { ...att, is_image: isImage, preview_url: previewUrl, download_url: this.getAttachmentDownloadUrl(att) };
    });
    // ✅ เรียกเลย ไม่ต้องรอ setTimeout
    this.analyzeAllExistingAttachments();
  }

  getAttachmentDownloadUrl(attachment: any): string {
    if (!attachment || !attachment.path) return '#';
    const path = attachment.path;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('data:')) return path;
    return `${this.apiUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  private analyzeAllExistingAttachments(): void {
    if (!this.existingFixAttachments || this.existingFixAttachments.length === 0) return;
    this.existingFixAttachments.forEach((attachment) => { this.analyzeExistingAttachment(attachment); });
  }

  private async analyzeExistingAttachment(attachment: any): Promise<void> {
    if (!attachment || !attachment.attachment_id) return;
    const attachmentId = attachment.attachment_id;
    if (this.attachmentTypes[attachmentId]?.isAnalyzed) return;

    // ตั้งค่าเริ่มต้น
    this.attachmentTypes[attachmentId] = { 
        type: 'file', 
        extension: '', 
        filename: 'Loading...', 
        isLoading: true, 
        isAnalyzed: false 
    };

    // ✅ เพิ่ม Logic เช็คนามสกุลก่อนยิง Request
    let realFilename = attachment.filename || this.extractFilenameFromPath(attachment.path) || `attachment_${attachmentId}`;
    let extension = this.getFileExtensionHelper(realFilename);
    
    // ถ้ามีนามสกุลไฟล์ชัดเจน ให้สรุปผลเลย ไม่ต้องยิง fetch
    if (extension && extension !== 'unknown') {
        const mimeType = this.guessMimeTypeFromExtension(extension);
        this.attachmentTypes[attachmentId] = { 
            type: this.determineFileCategoryByMimeType(mimeType), 
            extension: extension, 
            filename: realFilename, 
            isLoading: false, 
            isAnalyzed: true 
        };
        return; 
    }

    // ถ้าไม่รู้นามสกุลจริงๆ ค่อยยิง Request
    try {
      const response = await fetch(attachment.path, { method: 'HEAD' });
      const contentDisposition = response.headers.get('Content-Disposition');
      const contentType = response.headers.get('Content-Type') || '';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) { 
            realFilename = filenameMatch[1].replace(/['"]/g, ''); 
            realFilename = decodeURIComponent(realFilename); 
        }
      }
      
      extension = this.getFileExtensionHelper(realFilename) || this.getExtensionFromMimeType(contentType);
      
      this.attachmentTypes[attachmentId] = { 
          type: this.determineFileCategoryByMimeType(contentType), 
          extension: extension, 
          filename: realFilename, 
          isLoading: false, 
          isAnalyzed: true 
      };
    } catch (error) { 
      this.attachmentTypes[attachmentId] = { 
          type: 'file', 
          extension: '', 
          filename: realFilename, 
          isLoading: false, 
          isAnalyzed: true 
      }; 
    }
  }

  // ✅ Helper Function ใหม่
  private guessMimeTypeFromExtension(ext: string): string {
      const map: {[key:string]: string} = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif',
          'pdf': 'application/pdf', 
          'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'txt': 'text/plain'
      };
      return map[ext.toLowerCase()] || 'application/octet-stream';
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: { [key: string]: string } = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
      'application/pdf': 'pdf', 'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt'
    };
    return mimeMap[mimeType.toLowerCase()] || '';
  }

  private determineFileCategoryByMimeType(mimeType: string): 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file' {
    const type = mimeType.toLowerCase();
    if (type.startsWith('image/')) return 'image';
    if (type === 'application/pdf') return 'pdf';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'excel';
    if (type.includes('word') || type.includes('document')) return 'word';
    if (type.startsWith('text/')) return 'text';
    return 'file';
  }

  private extractFilenameFromPath(path: string): string {
    if (!path || typeof path !== 'string') return 'unknown';
    try {
      if (path.startsWith('data:')) return 'data_file';
      const parts = path.split('/');
      const lastPart = parts[parts.length - 1];
      const cleanFilename = lastPart.split('?')[0];
      try { return decodeURIComponent(cleanFilename) || 'unknown'; } catch { return cleanFilename || 'unknown'; }
    } catch { return 'unknown'; }
  }

  private getFileExtensionHelper(filename: string): string {
    if (!filename || filename === 'unknown' || typeof filename !== 'string') return '';
    try {
      const parts = filename.split('.');
      if (parts.length > 1) {
        const extension = parts[parts.length - 1].toLowerCase();
        return /^[a-z0-9]+$/i.test(extension) ? extension : '';
      }
      return '';
    } catch { return ''; }
  }

  isExistingAttachmentImage(attachment: any): boolean {
    if (!attachment) return false;
    const attachmentId = attachment.attachment_id;
    if (attachmentId && this.attachmentTypes[attachmentId]) { return this.attachmentTypes[attachmentId].type === 'image'; }
    if (attachment.path && attachment.path.startsWith('data:image/')) return true;
    const filename = attachment.filename || '';
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(filename);
  }

  getExistingAttachmentPreviewUrl(attachment: any): string {
    if (!attachment) return '';
    if (attachment.preview_url) return attachment.preview_url;
    const path = attachment.path;
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${this.apiUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  getExistingAttachmentIcon(attachment: any): string {
    if (!attachment) return 'bi-file-earmark-fill';
    const attachmentId = attachment.attachment_id;
    if (attachmentId && this.attachmentTypes[attachmentId]) {
      const type = this.attachmentTypes[attachmentId].type;
      switch (type) {
        case 'image': return 'bi-image-fill';
        case 'pdf': return 'bi-file-earmark-pdf-fill';
        case 'excel': return 'bi-file-earmark-excel-fill';
        case 'word': return 'bi-file-earmark-word-fill';
        default: return 'bi-file-earmark-fill';
      }
    }
    return 'bi-file-earmark-fill';
  }

  getExistingAttachmentDisplayName(attachment: any): string {
    if (!attachment) return 'Unknown file';
    const attachmentId = attachment.attachment_id;
    if (attachmentId && this.attachmentTypes[attachmentId]) return this.attachmentTypes[attachmentId].filename;
    return attachment.filename || this.extractFilenameFromPath(attachment.path) || 'Unknown file';
  }

  getExistingAttachmentFileInfo(attachmentId: number): any {
    const fileInfo = this.attachmentTypes[attachmentId];
    if (fileInfo) {
      return {
        type: fileInfo.type, extension: fileInfo.extension, filename: fileInfo.filename,
        isLoading: fileInfo.isLoading || false, icon: this.getExistingAttachmentIcon({ attachment_id: attachmentId })
      };
    }
    return { type: 'unknown', extension: '', filename: 'Unknown file', isLoading: false, icon: 'bi-file-earmark-fill' };
  }

  formatExistingAttachmentSize(attachment: any): string {
    if (attachment && attachment.file_size) return this.formatFileSize(attachment.file_size);
    return '';
  }

  onExistingAttachmentImageError(attachmentId: number): void {
    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'file';
      this.attachmentTypes[attachmentId].isAnalyzed = true;
    }
  }

  onExistingAttachmentImageLoad(attachmentId: number): void {
    if (this.attachmentTypes[attachmentId]) {
      this.attachmentTypes[attachmentId].type = 'image';
      this.attachmentTypes[attachmentId].isAnalyzed = true;
    }
  }

  async onRemoveExistingAttachment(attachment: { attachment_id: number;[k: string]: any; }): Promise<void> {
    if (!attachment?.attachment_id) return;
    if (!this.isFormReady() || this.supporterFormState.isSaving) return;
    if (!this.isSupporter) {
      this.supporterFormState.error = this.translate('supportInformation.noPermissionDelete');
      setTimeout(() => (this.supporterFormState.error = ''), 2500);
      return;
    }
    const ok = window.confirm(this.translate('supportInformation.confirmDeleteAttachment'));
    if (!ok) return;
    const id = attachment.attachment_id;
    this.deletingAttachmentIds.add(id);
    try {
      await this.apiService.delete<any>(`fix_issue/${id}`).toPromise();
      this.existingFixAttachments = this.existingFixAttachments.filter(a => a.attachment_id !== id);
      this.supporterFormState.successMessage = this.translate('supportInformation.deleteAttachmentSuccess');
      setTimeout(() => (this.supporterFormState.successMessage = ''), 2000);
    } catch (err: any) {
      this.supporterFormState.error = err?.message || this.translate('supportInformation.deleteAttachmentError');
      setTimeout(() => (this.supporterFormState.error = ''), 2500);
    } finally {
      this.deletingAttachmentIds.delete(id);
    }
  }

  // ... (Other helper methods) ...

  getFileTypeColor(fileType: string): string {
    switch (fileType) {
      case 'image': return '#6f42c1';
      case 'pdf': return '#dc3545';
      case 'excel': return '#198754';
      default: return '#6c757d';
    }
  }

  getFilePreview(file: File): string {
    if (!this.filePreviewUrls[file.name]) {
      if (this.ticketService.isImageFile(file)) {
        this.filePreviewUrls[file.name] = URL.createObjectURL(file);
      }
    }
    return this.filePreviewUrls[file.name] || '';
  }

  getFileTypeFromExtension(filename: string): string {
    const extension = this.getFileExtensionHelper(filename).toLowerCase();
    if (['jpg', 'jpeg', 'png'].includes(extension)) return 'image';
    if (extension === 'pdf') return 'pdf';
    return 'file';
  }

  trackByAttachment(index: number, attachment: ExistingAttachment): number {
    return attachment.attachment_id;
  }

  trackByFile(index: number, file: File): string {
    return file.name + file.size + file.lastModified;
  }

  formatFileSize(bytes: number | undefined): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  private validateFixIssueFiles(files: File[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const maxSize = 10 * 1024 * 1024;
    files.forEach(file => {
      if (file.size > maxSize) errors.push(`${file.name}: ขนาดเกิน 10MB`);
    });
    return { valid: errors.length === 0, errors };
  }

  private setupAutoCalculation(): void {
    this.supporterForm.get('close_estimate')?.valueChanges.subscribe(() => { this.calculateEstimateTimeFromForm(); });
    this.supporterForm.get('due_date')?.valueChanges.subscribe(() => { this.calculateLeadTimeFromForm(); });
  }

  private calculateEstimateTimeFromForm(): void {
    const closeEstimate = this.supporterForm.get('close_estimate')?.value;
    if (!closeEstimate) { this.estimateTime = 0; return; }
    const openTicketDate = this.getOpenTicketDate();
    if (!openTicketDate) { this.estimateTime = 0; return; }
    try {
      const closeEstimateDate = new Date(closeEstimate);
      this.estimateTime = this.businessHoursCalculator.calculateEstimateTime(openTicketDate, closeEstimateDate);
      this.supporterForm.patchValue({ estimate_time: Math.round(this.estimateTime) }, { emitEvent: false });
    } catch { this.estimateTime = 0; }
  }

  private calculateLeadTimeFromForm(): void {
    const dueDate = this.supporterForm.get('due_date')?.value;
    if (!dueDate) { this.leadTime = 0; return; }
    const openTicketDate = this.getOpenTicketDate();
    if (!openTicketDate) { this.leadTime = 0; return; }
    try {
      const dueDateObj = new Date(dueDate);
      this.leadTime = this.businessHoursCalculator.calculateLeadTime(openTicketDate, dueDateObj);
      this.supporterForm.patchValue({ lead_time: Math.round(this.leadTime) }, { emitEvent: false });
    } catch { this.leadTime = 0; }
  }

  private getOpenTicketDate(): Date | null {
    if (!this.ticketData?.status_history) return null;
    const openTicketHistory = this.ticketData.status_history.find(h => h.status_id === 2);
    if (!openTicketHistory?.create_date) return null;
    try { return new Date(openTicketHistory.create_date); } catch { return null; }
  }

  private setupFormPersistence(): void {
    // ✅ ใช้ debounceTime 2 วินาทีแทน setTimeout แบบเดิม
    this.formChangeSubscription = this.supporterForm.valueChanges
      .pipe(debounceTime(2000))
      .subscribe(() => {
        this.persistAllFormData();
      });
  }

  onAssigneeChanged(): void {
    setTimeout(() => { this.persistAllFormData(); }, 100);
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
    }
  }

  // ✅ 4. เพิ่ม Method โหลดข้อมูล Related Tickets
  private loadRelatedTickets(): void {
    if (!this.ticketData?.ticket) return;

    const projectId = this.ticketData.ticket.project_id;
    const categoryId = this.ticketData.ticket.categories_id;

    if (!projectId || !categoryId) return;

    this.isLoadingRelatedTickets = true;
    this.apiService.getRelatedTickets(projectId, categoryId).subscribe({
      next: (res) => {
        if (res.code === 1 && res.data && res.data.related_ticket) {
          this.relatedTicketsList = res.data.related_ticket;
        } else {
          this.relatedTicketsList = [];
        }
      },
      error: (err) => {
        console.error('Failed to load related tickets', err);
        this.relatedTicketsList = [];
      },
      complete: () => {
        this.isLoadingRelatedTickets = false;
      }
    });
  }

  private onTicketDataChanged(): void {
    this.supporterFormState.error = null;
    if (!this.justSaved) this.supporterFormState.successMessage = null;
    this.loadExistingFixAttachments();
    if (this.ticketData?.ticket && this.statusList.length > 0) {
      this.buildActionDropdownOptions();
    }
    this.calculateRealtime();
    if (this.ticketData?.ticket) {
      if (this.justSaved) { this.updateFormAfterSave(); } else { this.updateFormWithTicketData(); }
    }
    if (this.justSaved) { setTimeout(() => { this.justSaved = false; this.formDataBeforeRefresh = null; }, 150); }
  }

  private updateFormAfterSave(): void {
    this.updateFormWithTicketData();
  }

  // ✅ เพิ่ม Method นี้สำหรับตรวจสอบและปรับสถานะของ Due Date
  private updateDueDateAccess(): void {
    const dueControl = this.supporterForm.get('due_date');
    if (!dueControl) return;

    // เงื่อนไข: ต้องเป็น Supporter + ไม่ใช่ Admin + เลือก Action เป็น Resolved เท่านั้น ถึงจะกรอกได้
    if (this.isSupporter && !this.isAdmin && this.isResolvedActionSelected) {
      dueControl.enable({ emitEvent: false });
    } else {
      dueControl.disable({ emitEvent: false });
    }
  }

  public updateFormWithTicketData(): void {
    if (!this.ticketData?.ticket) return;
    const ticket = this.ticketData.ticket;
    const closeEstimateFormatted = this.formatDateTimeForInput(ticket.close_estimate);
    const dueDateFormatted = this.formatDateTimeForInput(ticket.due_date);
    const estimateTime = this.parseNumberField(ticket.estimate_time);
    const leadTime = this.parseNumberField(ticket.lead_time);
    const currentStatusId = ticket.status_id;

    const formValue = {
      action: currentStatusId ? currentStatusId.toString() : '',
      priority: ticket.priority_id || null,
      estimate_time: estimateTime,
      due_date: dueDateFormatted,
      lead_time: leadTime,
      close_estimate: closeEstimateFormatted,
      fix_issue_description: ticket.fix_issue_description || '',
      // ✅ แก้ไข: แปลงเป็น string เพื่อให้ตรงกับ value ใน select option และ patch ค่าลงฟอร์ม
      related_ticket_id: ticket.related_ticket_id ? ticket.related_ticket_id.toString() : ''
    };

    this.supporterForm.patchValue(formValue, { emitEvent: false });
    if (estimateTime !== null && estimateTime !== undefined) this.estimateTime = estimateTime;
    if (leadTime !== null && leadTime !== undefined) this.leadTime = leadTime;
    this.loadAssigneeFromTicketData();
    this.validateSupporterForm();

    if (this.fixIssueEditor?.nativeElement) {
      this.fixIssueEditor.nativeElement.innerHTML = ticket.fix_issue_description || '';
      this.checkToolbarStatus();
    }

    // ✅ เรียกใช้ Logic ตรวจสอบสิทธิ์ Due Date
    this.updateDueDateAccess();
    
    // ✅ 5. เรียกใช้ function โหลดข้อมูล Related Tickets
    this.loadRelatedTickets();

    const closeEstimateControl = this.supporterForm.get('close_estimate');
    if (this.isAdmin && !this.isSupporter) closeEstimateControl?.enable({ emitEvent: false });
    else closeEstimateControl?.disable({ emitEvent: false });
  }

  private loadAssigneeFromTicketData(): void {
    if (!this.ticketData?.assign || this.ticketData.assign.length === 0) {
      this.selectedAssigneeId = null;
      this.originalAssigneeId = null;
      return;
    }
    const latestAssign = this.ticketData.assign[this.ticketData.assign.length - 1];
    const assignToName = latestAssign.assignTo;

    if (this.assigneeList && this.assigneeList.length > 0) {
      const matchedUser = this.assigneeList.find(user => {
        const fullName = this.getUserFullName(user);
        return fullName === assignToName || user.username === assignToName;
      });
      if (matchedUser) {
        this.selectedAssigneeId = matchedUser.id;
        this.originalAssigneeId = matchedUser.id;
      } else {
        this.tempAssigneeName = assignToName;
        this.originalAssigneeId = null;
      }
    } else {
      this.tempAssigneeName = assignToName;
      this.originalAssigneeId = null;
      this.retryLoadAssignee();
    }
  }

  private tempAssigneeName: string | null = null;

  private getUserFullName(user: any): string {
    if (user.full_name) return user.full_name;
    if (user.name) return user.name;
    const parts: string[] = [];
    if (user.firstname) parts.push(user.firstname);
    if (user.lastname) parts.push(user.lastname);
    if (parts.length > 0) return parts.join(' ');
    return user.username || `User ${user.id}`;
  }

  private retryLoadAssignee(): void {
    setTimeout(() => {
      if (this.assigneeList && this.assigneeList.length > 0 && this.tempAssigneeName) {
        this.loadAssigneeFromTicketData();
      }
    }, 500);
  }

  private parseNumberField(value: any): number | null {
    if (value === null || value === undefined || value === '' || value === 'null') return null;
    const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (isNaN(parsed)) return null;
    return parsed;
  }

  private formatDateTimeForInput(dateString: string | null | undefined): string {
    if (!dateString || dateString === 'null' || dateString === 'undefined') return '';
    try {
      let date: Date;
      if (typeof dateString === 'string') {
        const normalizedDateString = dateString.replace(' ', 'T');
        date = new Date(normalizedDateString);
      } else {
        date = new Date(dateString);
      }
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch { return ''; }
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
      (formValue.fix_issue_description && formValue.fix_issue_description.trim() && formValue.fix_issue_description.trim() !== '<br>') ||
      (formValue.related_ticket_id && formValue.related_ticket_id.trim()) ||
      this.selectedFiles.length > 0 ||
      this.selectedAssigneeId
    );
  }

  refreshForm(): void {
    if (this.hasFormData()) this.takeFormSnapshot();
    this.refreshRequired.emit();
  }

  manualSaveFormData(): void {
    this.persistAllFormData();
  }

  getFormPersistenceStatus(): any {
    try {
      const savedData = localStorage.getItem(this.formPersistenceKey);
      if (!savedData) return { hasPersistedData: false, lastSaved: null, dataAge: 0, isValidForCurrentTicket: false };
      const parsedData = JSON.parse(savedData);
      const age = Date.now() - parsedData.timestamp;
      const isValid = parsedData.ticketNo === this.ticket_no;
      return { hasPersistedData: true, lastSaved: new Date(parsedData.timestamp), dataAge: Math.floor(age / 1000), isValidForCurrentTicket: isValid };
    } catch { return { hasPersistedData: false, lastSaved: null, dataAge: 0, isValidForCurrentTicket: false }; }
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

  get isJustSaved(): boolean { return this.justSaved; }

  getFormDebugInfo() {
    return {
      hasFormData: this.hasFormData(),
      justSaved: this.justSaved,
      persistence: this.getFormPersistenceStatus(),
      ticketNo: this.ticket_no
    };
  }

  selectedAttachment: any = null;
  showFileModal = false;

  onAttachmentClick(file: any) {
    this.selectedAttachment = file;
    this.showFileModal = true;
  }

  onExistingAttachmentDelete(file: any): void {
    const fileId = file.attachment_id || file.id;
    if (!fileId) return;
    const confirmDelete = confirm('ต้องการลบไฟล์นี้หรือไม่?');
    if (!confirmDelete) return;
    this.ticketService.deleteFixIssueAttachment(fileId).subscribe({
      next: () => {
        const updatedList = this.existingFixAttachments.filter((f) => f.attachment_id !== fileId);
        this.existingFixAttachments = [...updatedList];
      },
      error: (err) => { console.error('❌ ลบไฟล์ไม่สำเร็จ:', err); },
    });
  }

  getPriorityName(id: number): string {
    const option = this.priorityDropdownOptions?.find(o => o.id === id);
    return option ? option.name : '-';
  }

  closeModal(): void {
    this.showFileModal = false;
    this.selectedAttachment = null;
  }

  public debugFormState(): void {
    console.log('=== FORM STATE DEBUG ===');
    console.log('Ticket Data:', this.ticketData);
    console.log('Form Value:', this.supporterForm?.value);
    console.log('Form Valid:', this.supporterForm?.valid);
    console.log('======================');
  }

  private initializeSupporterForm(): void {
    this.supporterForm = this.fb.group({
      action: ['', [Validators.required]],
      priority: [null],
      estimate_time: [null, [Validators.min(0), Validators.max(1000)]],
      due_date: [''],
      lead_time: [null, [Validators.min(0), Validators.max(10000)]],
      close_estimate: [''],
      fix_issue_description: ['', [Validators.maxLength(5000)]],
      related_ticket_id: ['']
    });

    // ✅ เพิ่มการ Subscribe Action เปลี่ยน
    this.supporterForm.get('action')?.valueChanges.subscribe(() => {
      this.updateDueDateAccess();
      this.validateSupporterForm();
    });

    this.supporterForm.valueChanges.subscribe(() => { this.validateSupporterForm(); });
  }

  private checkUserPermissions(): void {
    const userPermissions = this.authService.getEffectivePermissions();
    this.canUserSaveSupporter = userPermissions.includes(8) || userPermissions.includes(19) || this.authService.isAdmin() || this.authService.isSupporter();
    const isUserAdmin = this.authService.isAdmin();
    const isUserSupporter = this.authService.isSupporter();
    this.isAdmin = isUserAdmin;
    this.isSupporter = isUserSupporter && !isUserAdmin;
    this.canUserChangePriority = userPermissions.includes(permissionEnum.ASSIGNEE) || this.isAdmin;
  }

  canEditSupportInformation(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();
    return userPermissions.includes(8) || userPermissions.includes(19) || this.authService.isAdmin() || this.authService.isSupporter();
  }

  canShowSupporterForm(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();
    const hasRequiredPermission = userPermissions.includes(5) || userPermissions.includes(8) || userPermissions.includes(19);
    return hasRequiredPermission && !this.isLoadingTicketData;
  }

  canAssignTicket(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();
    return userPermissions.includes(19) || userPermissions.includes(8) || this.authService.isAdmin() || this.authService.isSupporter();
  }

  isFormReady(): boolean {
    return this.isComponentInitialized && !this.isLoadingTicketData && !!this.ticketData?.ticket;
  }

  getFormStatusMessage(): string {
    if (this.isLoadingTicketData) return this.translate('supportInformation.loading');
    if (!this.ticketData?.ticket) return this.translate('supportInformation.waitingForTicket');
    if (!this.isComponentInitialized) return 'กำลังเตรียมฟอร์ม...';
    return 'พร้อมใช้งาน';
  }

  private async loadActionDropdownOptions(): Promise<void> {
    this.isLoadingActions = true;
    this.actionError = '';
    try {
      const lang = this.languageService.getCurrentLanguage();
      const response = await new Promise<StatusDDLResponse>((resolve, reject) => {
        this.apiService.getStatusDDL(lang).subscribe({
          next: (data) => resolve(data),
          error: (err) => reject(err)
        });
      });

      if (response && response.code === 1 && response.data) {
        this.statusList = response.data;
        this.buildActionDropdownOptions();
      } else {
        this.actionError = response?.message || 'ไม่สามารถโหลดข้อมูล Status ได้';
        this.buildDefaultActionOptions();
      }
    } catch (error) {
      this.actionError = 'เกิดข้อผิดพลาดในการโหลดข้อมูล Status';
      this.buildDefaultActionOptions();
    } finally {
      this.isLoadingActions = false;
    }
  }

  private buildActionDropdownOptions(): void {
    if (!this.statusList || this.statusList.length === 0) {
      this.buildDefaultActionOptions();
      return;
    }

    const currentStatusId = this.getCurrentStatusId();
    const currentLang = this.languageService.getCurrentLanguage();

    // ✅ กรองรายการตามภาษาที่เลือก (Filter by selected language)
    // เช็คว่ามี property language_id หรือไม่ ถ้ามีให้กรอง
    let displayList = this.statusList;
    
    // ตรวจสอบว่าใน list มีข้อมูล language_id หรือไม่
    const hasLangInfo = this.statusList.some((s: any) => s.language_id);
    
    if (hasLangInfo) {
        displayList = this.statusList.filter((s: any) => s.language_id === currentLang);
    }

    // ถ้ากรองแล้วไม่เจอข้อมูลเลย (อาจจะเพราะ backend ส่งมาไม่ครบ) Fallback ไปที่ภาษาอังกฤษ
    if (displayList.length === 0 && this.statusList.length > 0) {
        displayList = this.statusList.filter((s: any) => s.language_id === 'en');
        // ถ้ายังไม่เจออีก ให้แสดงทั้งหมด
        if (displayList.length === 0) displayList = this.statusList;
    }

    this.actionDropdownOptions = displayList.map(status => {
      const canChange = canChangeStatus(currentStatusId, status.id);
      const isCurrent = status.id === currentStatusId;
      let isDisabledByRole = false;
      if (this.isAdmin) {
        if (status.id !== TICKET_STATUS_IDS.OPEN_TICKET && status.id !== TICKET_STATUS_IDS.CANCEL) isDisabledByRole = true;
      } else if (this.isSupporter) {
        const supporterActions: number[] = [TICKET_STATUS_IDS.IN_PROGRESS, TICKET_STATUS_IDS.RESOLVED, TICKET_STATUS_IDS.COMPLETED];
        if (!supporterActions.includes(status.id)) isDisabledByRole = true;
      } else { isDisabledByRole = true; }

      return {
        value: status.id.toString(), label: status.name, statusId: status.id,
        disabled: !canChange || isCurrent || isDisabledByRole
      };
    });
    this.sortActionOptions();
  }

  private buildDefaultActionOptions(): void {
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
    if (this.statusList && this.statusList.length > 0) this.buildActionDropdownOptions();
    else this.loadActionDropdownOptions();
  }

  // ... (Rest of the file remains unchanged) ...
  calculateRealtime(): void {
    if (!this.ticketData?.ticket) return;
    const openTicketDate = this.getOpenTicketDate();
    if (!openTicketDate) return;
    try {
      if (this.ticketData.ticket.close_estimate) {
        const closeEstimateDate = new Date(this.ticketData.ticket.close_estimate);
        this.estimateTime = this.businessHoursCalculator.calculateEstimateTime(openTicketDate, closeEstimateDate);
      }
      if (this.ticketData.ticket.due_date) {
        const dueDateObj = new Date(this.ticketData.ticket.due_date);
        this.leadTime = this.businessHoursCalculator.calculateLeadTime(openTicketDate, dueDateObj);
      }
    } catch { }
  }

  private initializeAssigneeList(): void {
    if (this.canAssignTicket()) {
      this.isLoadingAssignees = true;
      this.assigneeError = '';
      this.assigneeList = [];
      this.apiService.getRole9Users().subscribe({
        next: (response: Role9UsersResponse) => {
          if (response && response.users && Array.isArray(response.users)) {
            this.assigneeList = response.users.map(user => ({
              id: user.id, username: user.username || user.name || `user_${user.id}`,
              firstname: user.firstname || '', lastname: user.lastname || '', email: user.email || '',
              isenabled: true, full_name: user.name || this.getUserFullName(user)
            }));
            if (this.ticketData?.assign && this.ticketData.assign.length > 0) this.loadAssigneeFromTicketData();
            if (this.assigneeList.length === 0) this.assigneeError = 'ไม่พบรายชื่อผู้รับมอบหมาย';
          } else { this.assigneeError = 'รูปแบบข้อมูลจาก API ไม่ถูกต้อง'; }
        },
        error: () => { this.assigneeError = 'เกิดข้อผิดพลาดในการโหลดรายชื่อผู้รับมอบหมาย'; },
        complete: () => { this.isLoadingAssignees = false; }
      });
    }
  }

  // ✅ แก้ไข method นี้เพื่อใช้ข้อมูลดิบ + buildPriorityDropdownOptions
  private async loadPriorityDropdownOptions(): Promise<void> {
    if (!this.canUserChangePriority) return;
    this.isLoadingPriorities = true;
    this.priorityError = '';
    try {
      const response = await new Promise<PriorityDDLResponse>((resolve, reject) => {
        this.ticketService.getPriorityDDL().subscribe({
          next: (data) => resolve(data), error: (err) => reject(err)
        });
      });
      if (response && response.success && response.data) {
         // เก็บข้อมูลดิบ
         this.rawPriorityList = response.data;
         // สร้าง Dropdown โดยใช้ Translation
         this.buildPriorityDropdownOptions();
      } else { 
         this.priorityError = response?.message || 'ไม่สามารถโหลดข้อมูล Priority ได้'; 
         this.buildDefaultPriorityOptions(); 
      }
    } catch { 
      this.priorityError = 'เกิดข้อผิดพลาดในการโหลดข้อมูล Priority'; 
      this.buildDefaultPriorityOptions(); 
    } finally { 
      this.isLoadingPriorities = false; 
    }
  }

  // ✅ สร้าง method ใหม่เพื่อแปลงภาษา priority
  private buildPriorityDropdownOptions(): void {
    if (!this.rawPriorityList || this.rawPriorityList.length === 0) {
      this.buildDefaultPriorityOptions();
      return;
    }

    this.priorityDropdownOptions = this.rawPriorityList.map(item => {
      // หา Translation Key จาก ID
      const translationKey = this.PRIORITY_TRANSLATION_MAP[item.id];
      // ถ้ามี Key ให้แปล ถ้าไม่มีให้ใช้ชื่อเดิมจาก API
      const translatedName = translationKey ? this.translate(translationKey) : item.name;

      return {
        id: item.id,
        name: translatedName
      };
    });
  }

  private buildDefaultPriorityOptions(): void {
    this.priorityDropdownOptions = [
      { id: 1, name: this.translate('tickets.priorityLow') },
      { id: 2, name: this.translate('tickets.priorityMedium') },
      { id: 3, name: this.translate('tickets.priorityHigh') }
    ];
  }

  refreshPriorityDropdown(): void {
    if (!this.priorityDropdownOptions || this.priorityDropdownOptions.length === 0) this.loadPriorityDropdownOptions();
  }

  trackByPriorityOption(index: number, option: PriorityDDLItem): number {
    return option.id;
  }

  refreshAssigneeList(): void {
    this.initializeAssigneeList();
  }

  isAssigneeDropdownReady(): boolean {
    return !this.isLoadingAssignees && !this.assigneeError && this.assigneeList.length > 0;
  }

  getUserDisplayName(user: UserListItem): string {
    return `${getUserFullName(user)} (${user.id})`;
  }

  getSelectedAssigneeName(): string {
    if (!this.selectedAssigneeId && !this.tempAssigneeName) return '';
    if (this.selectedAssigneeId) {
      const selectedUser = this.assigneeList.find(u => u.id === this.selectedAssigneeId);
      return selectedUser ? this.getUserFullName(selectedUser) : '';
    }
    return this.tempAssigneeName || '';
  }

  onFileSelected(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    if (!input?.files?.length) return;
    const newFiles = Array.from(input.files);
    const totalFiles = this.existingFixAttachments.length + this.selectedFiles.length + newFiles.length;
    if (totalFiles > this.maxFiles) {
      const availableSlots = this.maxFiles - (this.existingFixAttachments.length + this.selectedFiles.length);
      if (availableSlots > 0) this.addSelectedFiles(newFiles.slice(0, availableSlots));
    } else {
      this.addSelectedFiles(newFiles);
    }
    input.value = '';
  }

  onAttachmentsDrop(evt: DragEvent): void {
    evt.preventDefault(); evt.stopPropagation();
    this.dragCounter = 0; this.isDraggingFiles = false;
    if (!this.isFormReady() || this.supporterFormState.isSaving) return;
    if (!evt.dataTransfer || !evt.dataTransfer.files?.length) return;
    const droppedFiles = Array.from(evt.dataTransfer.files);
    const totalFiles = this.existingFixAttachments.length + this.selectedFiles.length + droppedFiles.length;
    if (totalFiles > this.maxFiles) {
      const availableSlots = this.maxFiles - (this.existingFixAttachments.length + this.selectedFiles.length);
      if (availableSlots > 0) this.addSelectedFiles(droppedFiles.slice(0, availableSlots));
    } else {
      this.addSelectedFiles(droppedFiles);
    }
  }

  isFileLimitReached(): boolean {
    const total = (this.existingFixAttachments?.length || 0) + (this.selectedFiles?.length || 0);
    return total >= this.maxFiles;
  }

  onAttachmentsDragOver(evt: DragEvent): void {
    evt.preventDefault(); evt.stopPropagation();
    this.dragCounter++; this.isDraggingFiles = true;
  }

  onAttachmentsDragLeave(evt: DragEvent): void {
    evt.preventDefault(); evt.stopPropagation();
    this.dragCounter = Math.max(0, this.dragCounter - 1);
    if (this.dragCounter === 0) this.isDraggingFiles = false;
  }

  private addSelectedFiles(files: File[] | FileList): void {
    const list = Array.isArray(files) ? files : Array.from(files);
    const allowedExt = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'txt', 'xlsx', 'csv'];
    for (const file of list) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!allowedExt.includes(ext)) continue;
      if (this.maxFiles && this.selectedFiles.length >= this.maxFiles) break;
      if (this.selectedFiles.some(f => f.name === file.name && f.size === file.size)) continue;
      this.selectedFiles.push(file);
    }
  }

  removeSelectedFile(index: number): void {
    if (!this.isSupporter) return;
    const file = this.selectedFiles[index];
    if (this.filePreviewUrls[file.name] && this.filePreviewUrls[file.name].startsWith('blob:')) {
      URL.revokeObjectURL(this.filePreviewUrls[file.name]);
      delete this.filePreviewUrls[file.name];
    }
    this.selectedFiles.splice(index, 1);
    this.fileUploadProgress.splice(index, 1);
    if (this.selectedFiles.length === 0) this.supporterFormState.error = null;
  }

  private validateSupporterForm(): void {
    const formValue = this.supporterForm.value;

    if (formValue.due_date && this.supporterForm.get('due_date')?.dirty) {
      const dueDate = new Date(formValue.due_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        this.supporterFormValidation.due_date = { isValid: false, error: this.translate('supportInformation.errors.dueDatePast') };
      } else {
        this.supporterFormValidation.due_date = { isValid: true };
      }
    } else {
      this.supporterFormValidation.due_date = { isValid: true };
    }

    if (formValue.close_estimate && this.supporterForm.get('close_estimate')?.dirty) {
      const closeDate = new Date(formValue.close_estimate);
      const now = new Date();
      if (closeDate < now) {
        this.supporterFormValidation.close_estimate = { isValid: false, error: this.translate('supportInformation.errors.closeEstimatePast') };
      } else {
        this.supporterFormValidation.close_estimate = { isValid: true };
      }
    } else {
      this.supporterFormValidation.close_estimate = { isValid: true };
    }

    const currentActionId = parseInt(formValue.action.toString());

    // ✅ NEW: บังคับกรอกเฉพาะ "Resolved" (4) หรือ "Completed" (5) เท่านั้น
    // ตัด TICKET_STATUS_IDS.IN_PROGRESS ออกไป
    const needsResolution = (currentActionId === TICKET_STATUS_IDS.RESOLVED || currentActionId === TICKET_STATUS_IDS.COMPLETED);

    if (needsResolution && (!formValue.fix_issue_description || formValue.fix_issue_description.trim() === '' || formValue.fix_issue_description.trim() === '<br>')) {
      this.supporterFormValidation.fix_issue_description = { isValid: false, error: this.translate('supportInformation.errors.resolutionRequired') };
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
    if (!this.canUserSaveSupporter && !this.canAssignTicket()) {
      this.supporterFormState.error = this.translate('supportInformation.errors.noPermissionSave');
      return;
    }
    if (!this.ticketData?.ticket) {
      this.supporterFormState.error = this.translate('supportInformation.errors.noTicket');
      return;
    }
    const hasSupporterChanges = this.hasSupporterFormChanges();
    const hasAssigneeChanged = this.selectedAssigneeId !== null && this.selectedAssigneeId !== this.originalAssigneeId;

    if (!hasSupporterChanges && !hasAssigneeChanged) {
      this.supporterFormState.error = this.translate('supportInformation.errors.noChanges');
      return;
    }

    this.validateSupporterForm();
    if (!this.supporterForm.valid || !this.supporterFormValidation.fix_issue_description.isValid) {
      this.markFormGroupTouched();
      this.supporterFormState.error = this.translate('supportInformation.errors.incomplete');
      return;
    }

    this.supporterFormState.isSaving = true;
    this.supporterFormState.error = null;
    this.executeSaveSequence(hasSupporterChanges, hasAssigneeChanged);
  }

  private async executeSaveSequence(hasSupporterChanges: boolean, hasAssigneeChanged: boolean): Promise<void> {
    try {
      let supporterSuccess = false;
      let assignSuccess = false;
      if (hasSupporterChanges && this.canUserSaveSupporter) {
        supporterSuccess = await this.saveSupporterData();
        if (!supporterSuccess) { this.supporterFormState.isSaving = false; return; }
      } else { supporterSuccess = true; }

      if (hasAssigneeChanged && this.canAssignTicket()) {
        assignSuccess = await this.assignTicketData();
      } else { assignSuccess = true; }

      this.handleUnifiedSaveResult(supporterSuccess, assignSuccess, hasSupporterChanges, hasAssigneeChanged);
    } catch (error) {
      this.supporterFormState.error = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
    } finally {
      this.supporterFormState.isSaving = false;
    }
  }

  private saveSupporterData(): Promise<boolean> {
    return new Promise((resolve) => {
      const formData = this.createSupporterFormData();
      if (!formData.status_id) {
        this.supporterFormState.error = 'กรุณาเลือก Action ที่ต้องการดำเนินการ';
        resolve(false); return;
      }
      if (this.selectedFiles.length > 0) {
        const fileValidation = this.validateFixIssueFiles(this.selectedFiles);
        if (!fileValidation.valid) {
          this.supporterFormState.error = fileValidation.errors.join(', ');
          resolve(false); return;
        }
      }
      const validation = this.ticketService.validateSupporterData(formData, this.selectedFiles);
      if (!validation.isValid) {
        this.supporterFormState.error = validation.errors.join(', ');
        resolve(false); return;
      }

      this.ticketService.saveSupporter(this.ticket_no, formData, []).subscribe({
        next: async (response: SaveSupporterResponse) => {
          if (response.success) {
            if (this.selectedFiles.length > 0 && this.ticketData?.ticket?.id) {
              const filesUploaded = await this.uploadFixIssueAttachments(this.ticketData.ticket.id, this.selectedFiles);
              if (!filesUploaded) {
                this.supporterFormState.successMessage = this.translate('supportInformation.errors.uploadPartial');
              }
            }
            this.supporterDataSaved.emit({ ...response });
            resolve(true);
          } else {
            this.supporterFormState.error = response.message || 'ไม่สามารถบันทึกข้อมูล Supporter ได้';
            resolve(false);
          }
        },
        error: () => {
          this.supporterFormState.error = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล Supporter';
          resolve(false);
        }
      });
    });
  }

  private assignTicketData(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.selectedAssigneeId) { resolve(false); return; }
      const selectedUser = this.assigneeList.find(u => u.id === this.selectedAssigneeId);
      if (!selectedUser) { this.assigneeError = 'ผู้รับมอบหมายที่เลือกไม่ถูกต้อง'; resolve(false); return; }
      const payload: AssignTicketPayload = { ticketNo: this.ticketData!.ticket!.ticket_no, assignTo: selectedUser.id };
      this.apiService.assignTicket(payload).subscribe({
        next: (response: AssignTicketResponse) => {
          if (response && response.ticket_no && response.assigned_to) {
            this.ticketAssigned.emit(response); resolve(true);
          } else { this.assigneeError = (response as any)?.message || 'ไม่สามารถมอบหมาย ticket ได้'; resolve(false); }
        },
        error: () => { this.assigneeError = 'เกิดข้อผิดพลาดในการมอบหมาย ticket'; resolve(false); }
      });
    });
  }

  private handleUnifiedSaveResult(supporterSuccess: boolean, assignSuccess: boolean, hadSupporterChanges: boolean, hadAssigneeChanged: boolean): void {
    const allSuccess = (!hadSupporterChanges || supporterSuccess) && (!hadAssigneeChanged || assignSuccess);
    if (allSuccess) {
      this.originalAssigneeId = this.selectedAssigneeId;
      if (this.ticket_no && this.currentUserId) localStorage.removeItem(this.getStorageKey());
      localStorage.removeItem(this.formPersistenceKey);
      this.lastFormSnapshot = null;
      this.formDataBeforeRefresh = null;
      this.justSaved = true;
      this.selectedFiles = [];
      this.fileUploadProgress = [];
      this.refreshRequired.emit();
      this.supporterFormState.successMessage = this.translate('supportInformation.errors.saveSuccess');
      setTimeout(() => { this.supporterFormState.successMessage = null; }, 3000);
    }
  }

  // ✅ FIX 2: ใช้ getRawValue เพื่อให้ได้ค่าครบทุก Field แม้จะ disabled
  private createSupporterFormData(): SaveSupporterFormData {
    const formValue = this.supporterForm.getRawValue();
    const formData: SaveSupporterFormData = {};
    if (formValue.action !== null && formValue.action !== '' && formValue.action !== undefined) {
      const statusId = parseInt(formValue.action.toString());
      if (!isNaN(statusId) && statusId > 0) formData.status_id = statusId;
    }
    if (formValue.priority !== null && formValue.priority !== undefined && formValue.priority !== '') {
      const priorityId = parseInt(formValue.priority.toString());
      if (!isNaN(priorityId) && priorityId > 0) formData.priority = priorityId;
    }
    if (this.estimateTime > 0) formData.estimate_time = Math.round(this.estimateTime);
    if (formValue.due_date) formData.due_date = formValue.due_date;
    if (this.leadTime > 0) formData.lead_time = Math.round(this.leadTime);
    if (formValue.close_estimate) formData.close_estimate = formValue.close_estimate;
    
    // ✅ ส่งค่า description เสมอถ้ามีค่า
    if (formValue.fix_issue_description) {
         formData.fix_issue_description = formValue.fix_issue_description.toString().trim();
    }
    
    // ✅ แก้ไข: แปลงเป็น Int ก่อนส่ง (Backend ต้องการ ID)
    if (formValue.related_ticket_id) {
        // ตรวจสอบว่าเป็นตัวเลขหรือไม่ก่อนแปลง
        const relatedId = parseInt(formValue.related_ticket_id.toString());
        if (!isNaN(relatedId)) {
            // ส่งเป็น number ถ้า interface รองรับ, หรือ string ถ้าจำเป็น
            // สมมติว่า Backend ต้องการ number
            formData.related_ticket_id = relatedId; 
        }
    }

    return formData;
  }

  // ✅ FIX 3: ปรับปรุงการเช็ค Change
  hasSupporterFormChanges(): boolean {
    if (!this.supporterForm) return false;
    const formValue = this.supporterForm.getRawValue(); // ใช้ getRawValue เพื่อความชัวร์
    if (formValue.action && formValue.action !== '') return true;

    // เช็ค description ให้ครอบคลุม
    const desc = formValue.fix_issue_description;
    const isFixIssueDescriptionChanged = desc && desc.toString().trim().length > 0 && desc !== '<br>';

    const hasOptionalChanges = (formValue.priority !== null && formValue.priority !== '') ||
      (formValue.estimate_time && formValue.estimate_time !== '') || (formValue.due_date && formValue.due_date !== '') ||
      (formValue.lead_time && formValue.lead_time !== '') || (formValue.close_estimate && formValue.close_estimate !== '') ||
      isFixIssueDescriptionChanged || (formValue.related_ticket_id && formValue.related_ticket_id.trim() !== '') ||
      (this.selectedFiles && this.selectedFiles.length > 0);
    return hasOptionalChanges;
  }

  canSaveAll(): boolean {
    const hasPermission = this.canUserSaveSupporter || this.canAssignTicket();
    const hasAssigneeChanged = this.selectedAssigneeId !== null && this.selectedAssigneeId !== this.originalAssigneeId;
    const hasChanges = this.hasSupporterFormChanges() || hasAssigneeChanged;
    const notLoading = !this.supporterFormState.isSaving;
    const hasTicket = !!this.ticketData?.ticket;
    const formReady = this.isFormReady();
    const formValid = this.supporterForm?.valid && this.supporterFormValidation.fix_issue_description.isValid;
    return hasPermission && hasChanges && notLoading && hasTicket && formReady && formValid;
  }

  getSaveAllButtonText(): string {
    if (this.supporterFormState.isSaving) return this.translate('supportInformation.saving');
    if (!this.isFormReady()) return this.translate('common.loading');
    if (!this.canUserSaveSupporter && !this.canAssignTicket()) return this.translate('supportInformation.noPermission');

    const hasSupporterChanges = this.hasSupporterFormChanges();
    const hasAssigneeChanged = this.selectedAssigneeId !== null && this.selectedAssigneeId !== this.originalAssigneeId;

    if (hasSupporterChanges && hasAssigneeChanged) return this.translate('supportInformation.saveAssignBtn');
    else if (hasSupporterChanges) return this.translate('supportInformation.saveBtn');
    else if (hasAssigneeChanged) return this.translate('supportInformation.assignBtn');
    return this.translate('supportInformation.saveBtn');
  }

  getSaveAllButtonClass(): string {
    const baseClass = 'save-btn';
    if (!this.canSaveAll()) return `${baseClass} disabled`;
    if (this.supporterFormState.isSaving) return `${baseClass} loading`;
    return baseClass;
  }

  getSaveAllButtonTooltip(): string {
    if (this.supporterFormState.isSaving) return 'กำลังดำเนินการ...';
    if (!this.isFormReady()) return this.getFormStatusMessage();
    if (!this.canUserSaveSupporter && !this.canAssignTicket()) return 'คุณไม่มีสิทธิ์ในการบันทึกหรือมอบหมาย';
    const hasAssigneeChanged = this.selectedAssigneeId !== null && this.selectedAssigneeId !== this.originalAssigneeId;
    if (!this.hasSupporterFormChanges() && !hasAssigneeChanged) return 'ไม่มีการเปลี่ยนแปลงข้อมูล';
    return '';
  }

  private resetSupporterForm(): void {
    this.supporterForm.patchValue({ action: '', priority: null });
    this.selectedFiles = [];
    this.fileUploadProgress = [];
    this.originalAssigneeId = this.selectedAssigneeId;
    this.supporterFormValidation = {
      estimate_time: { isValid: true }, due_date: { isValid: true }, lead_time: { isValid: true },
      close_estimate: { isValid: true }, fix_issue_description: { isValid: true },
      related_ticket_id: { isValid: true }, attachments: { isValid: true }
    };
    if (this.fixIssueEditor?.nativeElement) this.fixIssueEditor.nativeElement.innerHTML = '';
  }

  private markFormGroupTouched(): void {
    Object.keys(this.supporterForm.controls).forEach(key => {
      this.supporterForm.get(key)?.markAsTouched();
    });
  }

  private getCurrentStatusId(): number {
    return this.ticketData?.ticket?.status_id || 1;
  }

}