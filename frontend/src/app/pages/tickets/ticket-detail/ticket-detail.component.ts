import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { saveAs } from 'file-saver';
import { DomSanitizer } from '@angular/platform-browser';

// Import API Services
import {
  ApiService,
  TicketHistoryResponse,
  TicketStatusHistory,
  GetTicketDataRequest,
  satisfactionResponse
} from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { FileService } from '../../../shared/services/file.service';
import { LanguageService } from '../../../shared/services/language.service'; // ✅ Import LanguageService

// Import Permission Models
import {
  permissionEnum,
  UserRole,
  ROLES,
  ROLE_IDS
} from '../../../shared/models/permission.model';

// Import Utility
import {
  getStatusName,
  getStatusBadgeClass,
  getStatusIcon,
  TICKET_STATUS_IDS
} from '../../../shared/models/ticket.model';

// Import Components
import { SupportInformationFormComponent } from './support-information-form/support-information-form.component';
import { SupportInformationDisplayComponent } from './support-information-display/support-information-display.component';
import { FilePreviewModalComponent } from '../../../shared/components/file-preview-modal/file-preview-modal.component';
import { FileListComponent } from '../../../shared/components/file-list/file-list.component';

import { environment } from '../../../../environments/environment';

// Interfaces
interface HtmlToPdfDto {
  reportNumber: string;
  reportDate: string;
  status: string;
  reporter: string;
  priority: string;
  category: string;
  project: string;
  issueTitle: string;
  issueDescription: string;
  attachmentUrl?: string[];
  assignee?: string;
  estimatedCloseDate?: string;
  deadline?: string;
  estimateTime?: string;
  leadTime?: string;
  changeRequest?: string;
  solutionDescription?: string;
  satisfactionRating?: string;
}

interface ExportOptions {
  includeAttachments?: boolean;
  includeSolutionDetails?: boolean;
  includeSatisfactionRating?: boolean;
  format?: 'summary' | 'detailed';
}

interface HistoryDisplayItem {
  status_id: number;
  status_name: string;
  create_date: string;
  is_active: boolean;
  is_completed: boolean;
  is_skipped?: boolean;
}

export interface TicketData {
  ticket: {
    id: number;
    ticket_no: string;
    categories_id: number;
    categories_name: string;
    project_id: number;
    project_name: string;
    issue_description: string;
    fix_issue_description: string;
    status_id: number;
    status_name: string;
    close_estimate: string;
    estimate_time: string;
    due_date: string;
    lead_time: string;
    related_ticket_id: number | null;
    change_request: string;
    create_date: string;
    create_by: string;
    update_date: string;
    update_by: string;
    isenabled: boolean;
    priority_id?: string | number;
  };
  issue_attachment: Array<{
    attachment_id: number;
    path: string;
    filename?: string;
    file_type?: string;
    file_size?: number;
  }>;
  fix_attachment: Array<{
    attachment_id: number;
    path: string;
    filename?: string;
    file_type?: string;
    file_size?: number;
  }>;
  status_history: Array<{
    status_id: number;
    status_name: string;
    create_date: string;
  }>;
  assign: Array<{
    ticket_no: string;
    assignTo: string;
    assignBy: string;
  }>;
}

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SupportInformationFormComponent,
    SupportInformationDisplayComponent,
    FilePreviewModalComponent,
    FileListComponent,
  ],
  templateUrl: './ticket-detail.component.html',
  styleUrls: ['./ticket-detail.component.css']
})
export class TicketDetailComponent implements OnInit, OnDestroy {

  // ===== DEPENDENCY INJECTION =====
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private apiService = inject(ApiService);
  private http = inject(HttpClient);
  public authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private sanitizer = inject(DomSanitizer);
  private fileService = inject(FileService);
  public languageService = inject(LanguageService); // ✅ Inject LanguageService

  // ===== CORE PROPERTIES =====
  ticketData: TicketData | null = null;
  isLoading = false;
  error = '';
  ticket_no: string = '';

  // ===== TRANSLATION UI OBJECT ===== ✅
  ui: any = {};
  private langSubscription: Subscription | null = null;

  // ===== PDF EXPORT PROPERTIES =====
  isExportingPdf = false;
  exportError = '';
  exportOptions: ExportOptions = {
    includeAttachments: true,
    includeSolutionDetails: true,
    includeSatisfactionRating: true,
    format: 'detailed'
  };

  // ===== SATISFACTION PROPERTIES =====
  currentRating = 0;
  hoverRating = 0;
  isSavingRating = false;
  hasExistingSatisfaction = false;
  satisfactionMessage = '';
  canEvaluate = false;

  // ===== ATTACHMENT MODAL PROPERTIES =====
  showAttachmentModal = false;
  currentAttachment: any = null;

  // ===== MODAL PROPERTIES =====
  showSuccessModal = false;
  modalTitle = '';
  modalMessage = '';
  modalTicketNo = '';

  // ===== ACTION PROPERTIES =====
  isUpdating = false;
  isDeleting = false;
  isEditing = false;

  // ===== HISTORY PROPERTIES =====
  ticketHistory: TicketStatusHistory[] = [];
  displayHistory: HistoryDisplayItem[] = [];
  isLoadingHistory = false;

  // ===== STATUS PROPERTIES =====
  currentStatusInfo: {
    status_id: number;
    status_name: string;
    language_id: string;
  } | null = null;
  isLoadingStatus = false;
  statusError = '';
  statusCacheLoaded = false;
  isLoadingStatuses = false;
  statusCacheError = '';

  // ===== CONSTANTS =====
  private readonly STATUS_WORKFLOW = [
    { id: 1, name: 'Created', icon: 'bi-plus-circle' },
    { id: 2, name: 'Open Ticket', icon: 'bi-folder2-open' },
    { id: 3, name: 'In Progress', icon: 'bi-play-circle' },
    { id: 4, name: 'Resolved', icon: 'bi-clipboard-check' },
    { id: 5, name: 'Completed', icon: 'bi-check-circle' },
    { id: 6, name: 'Cancel', icon: 'bi-x-circle' }
  ];

  private readonly PRIORITY_CLASS_MAP: { [key: number]: string } = {
    1: 'priority-low',
    2: 'priority-medium',
    3: 'priority-high'
  };

  // ===== LIFECYCLE =====

  ngOnInit(): void {
    this.ticket_no = this.route.snapshot.params['ticket_no'];

    // ✅ Initial translation update
    this.updateTranslations();

    // ✅ Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage$.subscribe(() => {
      this.updateTranslations();
      if (this.ticketData) {
        this.updateStatusLanguage();
      }
    });

    if (this.ticket_no) {
      this.loadStatusCache();
      this.loadTicketDetail();
    } else {
      this.router.navigate(['/tickets']);
    }
  }

  ngOnDestroy(): void {
    // ✅ Cleanup subscription
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
    }
  }

  // ===== TRANSLATION METHODS ===== ✅

  private updateTranslations(): void {
    this.ui = {
      // Common & Menu
      allTickets: this.languageService.translate('tickets.allTickets'),
      ticket: this.languageService.translate('tickets.newTicket').replace('New ', '') || 'Ticket',
      
      // Labels
      ticketNo: this.languageService.translate('ticketDetail.ticketId'),
      priority: this.languageService.translate('tickets.priority'),
      categories: this.languageService.translate('tickets.categories'),
      project: this.languageService.translate('menu.project'),
      issueDesc: this.languageService.translate('tickets.issue'),
      reporter: this.languageService.translate('ticketDetail.reporter'),
      created: this.languageService.translate('ticketDetail.created'),
      updated: this.languageService.translate('ticketDetail.updated'),
      
      // History
      historyTitle: this.languageService.translate('ticketDetail.history'),
      loadingHistory: this.languageService.translate('ticketDetail.loadingHistory'),
      noHistory: this.languageService.translate('ticketDetail.noHistory'),
      
      // Actions
      delete: this.languageService.translate('common.delete'),
      edit: this.languageService.translate('common.edit'),
      exportPdf: this.languageService.translate('ticketDetail.exportPdf'),
      backToAll: this.languageService.translate('ticketDetail.backToAll'),
      
      // Evaluation
      evaluation: this.languageService.translate('ticketDetail.evaluation'),
      
      // Messages
      loading: this.languageService.translate('tickets.loadingData'),
      loadingTicket: this.languageService.translate('tickets.loadingTickets')
    };
  }

  private updateStatusLanguage(): void {
    if (this.ticketData?.ticket?.status_id) {
       this.ticketData.ticket.status_name = this.getCurrentStatusName();
       this.buildDisplayHistory(); // Rebuild history to update status names in timeline
    }
  }

  // ===== PDF EXPORT METHODS =====

  async exportToPdf(options: ExportOptions = {}): Promise<void> {
    if (!this.ticketData?.ticket) {
      alert('ไม่สามารถส่งออกได้ เนื่องจากไม่พบข้อมูล ticket');
      return;
    }

    if (!this.hasPermission(permissionEnum.VIEW_OWN_TICKETS)) {
      alert('คุณไม่มีสิทธิ์ในการส่งออก ticket นี้');
      return;
    }

    try {
      this.isExportingPdf = true;
      this.exportError = '';
      const finalOptions = { ...this.exportOptions, ...options };
      const pdfData = await this.preparePdfData(finalOptions);
      await this.callPdfGenerateApi(pdfData);
      console.log('PDF export completed successfully');
    } catch (error) {
      console.error('PDF export error:', error);
      this.exportError = 'เกิดข้อผิดพลาดในการส่งออก PDF';
      alert(`ไม่สามารถส่งออก PDF ได้: ${error}`);
    } finally {
      this.isExportingPdf = false;
    }
  }

  private async preparePdfData(options: ExportOptions): Promise<HtmlToPdfDto> {
    const ticket = this.ticketData!.ticket;
    const assigneeInfo = await this.getAssigneeInfo();
    const attachmentUrls = options.includeAttachments ? this.getAttachmentUrls() : [];

    const pdfData: HtmlToPdfDto = {
      reportNumber: ticket.ticket_no || '',
      reportDate: this.formatDateForPdf(new Date().toISOString()),
      status: this.getCurrentStatusName() || '',
      reporter: ticket.create_by || '',
      priority: this.getPriorityText(ticket.priority_id),
      category: ticket.categories_name || '',
      project: ticket.project_name || '',
      issueTitle: `Ticket ${ticket.ticket_no}`,
      issueDescription: ticket.issue_description || '',
      attachmentUrl: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      assignee: assigneeInfo || '',
      estimatedCloseDate: ticket.close_estimate ? this.formatDateForPdf(ticket.close_estimate) : '',
      deadline: ticket.due_date ? this.formatDateForPdf(ticket.due_date) : '',
      estimateTime: ticket.estimate_time || '',
      leadTime: ticket.lead_time || '',
      changeRequest: options.includeSolutionDetails ? (ticket.change_request || '') : '',
      solutionDescription: options.includeSolutionDetails ? (ticket.fix_issue_description || '') : '',
      satisfactionRating: options.includeSatisfactionRating && this.currentRating > 0 ? this.currentRating.toString() : ''
    };
    return pdfData;
  }

  private async callPdfGenerateApi(pdfData: HtmlToPdfDto): Promise<void> {
    const token = this.authService.getToken();
    if (!token) throw new Error('Authentication token not found');

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    const apiUrl = `${environment.apiUrl}/pdf/generate`;

    try {
      const response = await this.http.post(apiUrl, pdfData, {
        headers: headers,
        responseType: 'blob',
        observe: 'response'
      }).toPromise();

      if (!response || !response.body) throw new Error('No PDF data received from server');

      const fileName = `ticket-${pdfData.reportNumber}-${this.formatDateForFilename(new Date())}.pdf`;
      saveAs(response.body, fileName);

      this.showSuccessModal = true;
      this.modalTitle = 'Export Successful';
      this.modalMessage = `ส่งออก PDF สำเร็จแล้ว: ${fileName}`;
      this.modalTicketNo = this.ticket_no;
    } catch (error: any) {
      if (error.status === 401) throw new Error('ไม่มีสิทธิ์ในการเข้าถึง กรุณาเข้าสู่ระบบใหม่');
      else if (error.status === 403) throw new Error('ไม่มีสิทธิ์ในการส่งออก PDF');
      else if (error.status === 500) throw new Error('เกิดข้อผิดพลาดในเซิร์ฟเวอร์');
      else throw new Error(error.message || 'ไม่สามารถส่งออก PDF ได้');
    }
  }

  private async getAssigneeInfo(): Promise<string> {
    try {
      if (this.ticketData?.assign && this.ticketData.assign.length > 0) {
        const latestAssign = this.ticketData.assign[this.ticketData.assign.length - 1];
        return latestAssign.assignTo || 'ไม่ระบุ';
      }
      return 'ยังไม่ได้มอบหมาย';
    } catch (error) {
      return 'ไม่ระบุ';
    }
  }

  private getAttachmentUrls(): string[] {
    const urls: string[] = [];
    try {
      if (this.ticketData?.issue_attachment) {
        this.ticketData.issue_attachment.forEach(attachment => {
          if (attachment.path && !attachment.path.startsWith('data:')) {
            urls.push(attachment.path);
          }
        });
      }
    } catch (error) {
      console.warn('Error collecting attachment URLs:', error);
    }
    return urls;
  }

  // ===== HELPER METHODS =====

  private formatDateForPdf(dateString: string): string {
    return this.languageService.formatDate(dateString, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private formatDateForFilename(date: Date): string {
    try {
      return date.toISOString().slice(0, 10);
    } catch {
      return 'unknown';
    }
  }

  canExportPdf(): boolean {
    return !this.isLoading && !this.isExportingPdf && !!this.ticketData?.ticket && this.hasPermission(permissionEnum.VIEW_OWN_TICKETS);
  }

  getExportButtonText(): string {
    return this.isExportingPdf ? 'Exporting...' : (this.ui.exportPdf || 'Export PDF');
  }

  getExportButtonClass(): string {
    if (this.isExportingPdf) return 'btn btn-export-pdf exporting disabled';
    if (!this.canExportPdf()) return 'btn btn-export-pdf disabled';
    return 'btn btn-export-pdf';
  }

  private sendStatusChangeNotification(ticketNo: string, newStatusId: number): void {
    this.notificationService.notifyTicketChanges({ ticket_no: ticketNo, statusId: newStatusId }).subscribe({
      error: (error) => console.warn('Failed to send status notification:', error)
    });
  }

  private sendAssignmentNotification(ticketNo: string, assignedUserId: number): void {
    this.notificationService.notifyTicketChanges({ ticket_no: ticketNo, assignedUserId: assignedUserId }).subscribe({
      error: (error) => console.warn('Failed to send assignment notification:', error)
    });
  }

  // ===== CHILD COMPONENT HANDLERS =====

  onSupporterDataSaved(response: any): void {
    if (response.data?.ticket) {
      const oldStatusId = this.ticketData?.ticket?.status_id;
      const newStatusId = response.data.ticket.status_id;
      Object.assign(this.ticketData!.ticket, response.data.ticket);
      if (oldStatusId && newStatusId && oldStatusId !== newStatusId) {
        this.sendStatusChangeNotification(this.ticket_no, newStatusId);
      }
    }
    if (response.data?.attachments) {
      this.updateAttachmentsFromResponse(response.data.attachments);
    }
    this.refreshTicketData();
    this.buildDisplayHistory();
    this.updateEvaluationStatus();
    this.showSuccessModal = true;
    this.modalTitle = 'Supporter Data Saved';
    this.modalMessage = 'บันทึกข้อมูล supporter สำเร็จแล้ว';
    this.modalTicketNo = this.ticket_no;
  }

  onTicketAssigned(response: any): void {
    if (this.ticketData?.ticket) {
      this.ticketData.ticket.update_by = `User ${response.assigned_to}`;
      this.ticketData.ticket.update_date = new Date().toISOString();
    }
    if (response.assigned_to) {
      this.sendAssignmentNotification(this.ticket_no, response.assigned_to);
    }
    this.refreshTicketData();
    this.showSuccessModal = true;
    this.modalTitle = 'Ticket Assigned';
    this.modalMessage = `มอบหมาย ticket ${response.ticket_no} สำเร็จแล้ว`;
    this.modalTicketNo = this.ticket_no;
  }

  onRefreshRequired(): void {
    this.refreshTicketData();
  }

  private updateAttachmentsFromResponse(newAttachments: any[]): void {
    if (!newAttachments || newAttachments.length === 0) return;
    const existingFixIds = new Set(this.ticketData!.fix_attachment.map(att => att.attachment_id));
    const trulyNewAttachments = newAttachments.filter(att => !existingFixIds.has(att.id));
    if (trulyNewAttachments.length === 0) return;
    const formattedAttachments = trulyNewAttachments.map(att => ({
      attachment_id: att.id,
      path: att.path || `uploads/${att.filename}`,
      filename: att.filename,
      file_type: att.extension || att.file_type,
      file_size: att.file_size || 0
    }));
    this.ticketData!.fix_attachment.push(...formattedAttachments);
  }

  // ===== PERMISSIONS =====

  hasPermission(permission: number | permissionEnum): boolean {
    return this.authService.hasPermission(permission);
  }

  hasRole(role: UserRole): boolean {
    return this.authService.hasRole(role);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return this.authService.hasAnyRole(roles);
  }

  hasSpecificPermission(permissionId: number): boolean {
    return this.authService.getEffectivePermissions().includes(permissionId);
  }

  // ===== ACTIONS =====

  onEditTicket(): void {
    if (!this.ticketData?.ticket?.ticket_no) return;

    if (!this.authService.hasPermission(permissionEnum.EDIT_TICKET) &&
      !this.authService.hasAnyRole([ROLES.SUPPORTER, ROLES.ADMIN])) {
      alert(this.languageService.getText('คุณไม่มีสิทธิ์แก้ไข ticket นี้', 'You do not have permission to edit this ticket'));
      return;
    }

    const currentStatus: number = this.getCurrentStatusId();

    if (this.authService.hasRole(ROLES.USER)) {
      if (currentStatus !== TICKET_STATUS_IDS.CREATED) {
        alert(this.languageService.getText('คุณสามารถแก้ไข ticket ได้เฉพาะในสถานะ "Created" เท่านั้น', 'You can only edit tickets in "Created" status'));
        return;
      }
    } else if (this.authService.hasRole(ROLES.ADMIN)) {
      if (currentStatus !== TICKET_STATUS_IDS.CREATED && currentStatus !== TICKET_STATUS_IDS.OPEN_TICKET) {
        alert(this.languageService.getText('คุณสามารถแก้ไข ticket ได้เฉพาะในสถานะ "Created" และ "Open Ticket" เท่านั้น', 'Admin can only edit "Created" and "Open Ticket" status'));
        return;
      }
    } else if (this.authService.hasRole(ROLES.SUPPORTER)) {
      if (currentStatus === TICKET_STATUS_IDS.COMPLETED || currentStatus === TICKET_STATUS_IDS.CANCEL) {
        alert(this.languageService.getText('ไม่สามารถแก้ไข ticket ที่จบงานแล้วได้', 'Cannot edit completed or cancelled tickets'));
        return;
      }
    }

    this.saveTicketDataForEdit();
    this.router.navigate(['/tickets/edit', this.ticketData.ticket.ticket_no]);
  }

  onDeleteTicket(): void {
    if (!this.ticketData?.ticket?.ticket_no) return;

    if (!this.authService.hasPermission(permissionEnum.DELETE_TICKET) && !this.authService.isAdmin()) {
      alert(this.languageService.getText('คุณไม่มีสิทธิ์ลบ ticket นี้', 'You do not have permission to delete this ticket'));
      return;
    }

    const currentStatus: number = this.getCurrentStatusId();

    if (this.authService.hasRole(ROLES.USER)) {
      if (currentStatus !== TICKET_STATUS_IDS.CREATED) {
        alert(this.languageService.getText('คุณสามารถลบ ticket ได้เฉพาะในสถานะ "Created" เท่านั้น', 'You can only delete tickets in "Created" status'));
        return;
      }
    } else if (this.authService.hasRole(ROLES.ADMIN)) {
      if (currentStatus !== TICKET_STATUS_IDS.CREATED && currentStatus !== TICKET_STATUS_IDS.OPEN_TICKET) {
        alert(this.languageService.getText('คุณสามารถลบ ticket ได้เฉพาะในสถานะ "Created" และ "Open Ticket" เท่านั้น', 'Admin can only delete "Created" and "Open Ticket" status'));
        return;
      }
    } else if (this.authService.hasRole(ROLES.SUPPORTER)) {
      if (currentStatus === TICKET_STATUS_IDS.COMPLETED || currentStatus === TICKET_STATUS_IDS.CANCEL) {
        alert(this.languageService.getText('ไม่สามารถลบ ticket ที่จบงานแล้วได้', 'Cannot delete completed or cancelled tickets'));
        return;
      }
    }

    const ticketNo = this.ticketData.ticket.ticket_no;
    const confirmMessage = this.languageService.translate('tickets.deleteConfirm', { ticketNo: ticketNo });

    if (confirm(confirmMessage)) {
      this.deleteTicket(ticketNo);
    }
  }

  // ===== SATISFACTION =====

  setRating(rating: number): void {
    const userPermissions = this.authService.getEffectivePermissions();
    if (!userPermissions.includes(14)) {
      alert('Permission Denied (14: SATISFACTION)');
      return;
    }
    if (!this.canEvaluate || this.hasExistingSatisfaction) return;
    this.currentRating = rating;
    this.satisfaction(rating);
  }

  canClickStar(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();
    return userPermissions.includes(14) && this.canEvaluate && !this.hasExistingSatisfaction && !this.isSavingRating;
  }

  private satisfaction(rating: number): void {
    if (!this.ticket_no || this.isSavingRating) return;
    this.isSavingRating = true;

    this.apiService.satisfaction(this.ticket_no, rating).subscribe({
      next: (response: satisfactionResponse) => {
        if (response.success) {
          this.hasExistingSatisfaction = true;
          this.satisfactionMessage = this.languageService.getText('บันทึกคะแนนสำเร็จ', 'Rating saved');
          this.currentRating = rating;
          this.saveSatisfactionToStorage(rating);
          this.showSuccessModal = true;
          this.modalTitle = 'Assessment Success';
          this.modalMessage = this.languageService.getText('ขอบคุณสำหรับการประเมิน', 'Thank you for your feedback');
          this.modalTicketNo = this.ticket_no;
          document.body.classList.add('modal-open');
        } else {
          this.currentRating = 0;
          this.hasExistingSatisfaction = false;
          alert(response.error || 'Failed to save');
        }
        this.isSavingRating = false;
      },
      error: (error) => {
        console.error('Error saving satisfaction:', error);
        this.currentRating = 0;
        this.hasExistingSatisfaction = false;
        this.isSavingRating = false;
        alert('Error saving satisfaction');
      }
    });
  }

  // ===== HELPER METHODS =====

  canEdit(): boolean {
    if (!this.ticketData?.ticket) return false;
    if (this.authService.hasRole(ROLES.SUPPORTER) || this.authService.hasRoleId(ROLE_IDS.SUPPORTER)) return false;

    const hasEditPermission = this.authService.hasPermission(permissionEnum.EDIT_TICKET) || this.authService.hasAnyRole([ROLES.ADMIN]);
    if (!hasEditPermission) return false;

    const currentStatus = Number(this.getCurrentStatusId());
    const isAdmin = this.authService.hasRole(ROLES.ADMIN) || this.authService.hasRoleId(ROLE_IDS.ADMIN);
    const isUser = this.authService.hasRole(ROLES.USER) || this.authService.hasRoleId(ROLE_IDS.USER);

    if (isAdmin) return currentStatus === TICKET_STATUS_IDS.CREATED || currentStatus === TICKET_STATUS_IDS.OPEN_TICKET;
    if (isUser) return currentStatus === TICKET_STATUS_IDS.CREATED;
    return false;
  }

  canDelete(): boolean {
    if (!this.ticketData?.ticket) return false;
    if (this.authService.hasRole(ROLES.SUPPORTER) || this.authService.hasRoleId(ROLE_IDS.SUPPORTER)) return false;

    const hasDeletePermission = this.authService.hasPermission(permissionEnum.DELETE_TICKET) || this.authService.isAdmin();
    if (!hasDeletePermission) return false;

    const currentStatus: number = this.getCurrentStatusId();
    const isAdmin = this.authService.hasRole(ROLES.ADMIN) || this.authService.hasRoleId(ROLE_IDS.ADMIN);
    const isUser = this.authService.hasRole(ROLES.USER) || this.authService.hasRoleId(ROLE_IDS.USER);

    if (isUser && !isAdmin) return currentStatus === TICKET_STATUS_IDS.CREATED;
    if (isAdmin) return currentStatus === TICKET_STATUS_IDS.CREATED || currentStatus === TICKET_STATUS_IDS.OPEN_TICKET;
    return false;
  }

  getEditButtonText(): string {
    if (!this.ticketData?.ticket) return 'No Permission';
    const userPermissions = this.authService.getEffectivePermissions();
    const hasEditPermission = userPermissions.includes(8) || userPermissions.includes(19) || this.authService.isAdmin();
    if (!hasEditPermission) return this.ui.edit || 'Edit';

    const currentStatus = this.getCurrentStatusId();

    // Map status to UI text
    if (this.authService.hasRole(ROLES.USER)) {
      switch (currentStatus) {
        case TICKET_STATUS_IDS.CREATED: return this.ui.edit;
        case TICKET_STATUS_IDS.OPEN_TICKET: return this.languageService.translate('tickets.openTicket');
        case TICKET_STATUS_IDS.COMPLETED: return this.languageService.translate('tickets.complete');
        case TICKET_STATUS_IDS.CANCEL: return this.languageService.translate('tickets.cancel');
        default: return this.languageService.translate('tickets.inProgress');
      }
    }
    
    // Default fallback
    return this.ui.edit || 'Edit';
  }

  getEditButtonClass(): string {
    const hasPermission = this.authService.hasPermission(permissionEnum.EDIT_TICKET) || this.authService.hasAnyRole([ROLES.SUPPORTER, ROLES.ADMIN]);
    if (!hasPermission) return 'btn-edit disabled no-permission';

    const canEdit = this.canEdit();
    let roleClass = '';
    if (this.authService.hasRole(ROLES.USER)) roleClass = 'user-restricted';
    else if (this.authService.hasRole(ROLES.ADMIN)) roleClass = 'admin-restricted';

    return canEdit ? `btn-edit ${roleClass}`.trim() : `btn-edit disabled ${roleClass}`.trim();
  }

  getDeleteButtonClass(): string {
    const hasPermission = this.authService.hasPermission(permissionEnum.DELETE_TICKET) || this.authService.isAdmin();
    if (!hasPermission) return 'btn-delete disabled no-permission';

    const canDelete = this.canDelete();
    let roleClass = '';
    if (this.authService.hasRole(ROLES.USER)) roleClass = 'user-restricted';
    else if (this.authService.hasRole(ROLES.ADMIN)) roleClass = 'admin-restricted';

    return canDelete ? `btn-delete ${roleClass}`.trim() : `btn-delete disabled ${roleClass}`.trim();
  }

  getEditButtonTooltip(): string {
    return this.languageService.translate('ticketDetail.editTooltip');
  }

  getDeleteButtonTooltip(): string {
    return this.languageService.translate('ticketDetail.deleteTooltip');
  }

  // ===== STAR UI =====

  getStarClass(starIndex: number): string {
    const baseClass = 'star';
    if (this.hasExistingSatisfaction && this.currentRating > 0) return baseClass + (starIndex <= this.currentRating ? ' filled permanent-rating' : ' disabled');
    if (!this.canClickStar()) return baseClass + ' disabled';
    if (this.isSavingRating && starIndex === this.currentRating) return baseClass + ' saving';
    if (this.hoverRating > 0) return baseClass + (starIndex <= this.hoverRating ? ' hover' : '');
    return baseClass + (starIndex <= this.currentRating ? ' filled' : '');
  }

  isStarFilled(starIndex: number): boolean {
    if (this.hasExistingSatisfaction && this.currentRating > 0) return starIndex <= this.currentRating;
    if (this.hoverRating > 0 && this.canClickStar()) return starIndex <= this.hoverRating;
    if (this.currentRating > 0 && !this.hasExistingSatisfaction) return starIndex <= this.currentRating;
    return false;
  }

  onStarMouseEnter(rating: number): void {
    if (this.canClickStar() && !this.hasExistingSatisfaction) this.hoverRating = rating;
  }

  onStarMouseLeave(): void {
    if (this.canClickStar() && !this.hasExistingSatisfaction) this.hoverRating = 0;
  }

  getStarTooltip(starIndex: number): string {
    if (this.hasExistingSatisfaction) return `${starIndex} Stars`;
    if (!this.canEvaluate) return this.satisfactionMessage;
    return `${starIndex} Stars`;
  }

  getEvaluationMessage(): string {
    if (this.hasExistingSatisfaction && this.currentRating > 0) return '';
    if (!this.canEvaluate) return this.satisfactionMessage;
    return this.languageService.translate('ticketDetail.evaluationMessage');
  }

  // ===== PRIORITY =====

  getPriorityText(priority_id?: number | string): string {
    if (priority_id === null || priority_id === undefined || priority_id === '') return '-';
    const id = typeof priority_id === 'string' ? parseInt(priority_id, 10) : priority_id;

    switch (id) {
        case 1: return this.languageService.translate('tickets.priorityLow');
        case 2: return this.languageService.translate('tickets.priorityMedium');
        case 3: return this.languageService.translate('tickets.priorityHigh');
        default: return '-';
    }
  }

  getPriorityClass(priority_id?: number | string): string {
    if (priority_id === null || priority_id === undefined || priority_id === '') return 'priority-none';
    const id = typeof priority_id === 'string' ? parseInt(priority_id, 10) : priority_id;
    return this.PRIORITY_CLASS_MAP[id] || 'priority-none';
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
    this.modalTitle = '';
    this.modalMessage = '';
    this.modalTicketNo = '';
    document.body.classList.remove('modal-open');
  }

  // ===== STATUS & HISTORY =====

  getCurrentStatusId(): number {
    return this.currentStatusInfo?.status_id || this.ticketData?.ticket?.status_id || 1;
  }

  getCurrentStatusName(): string {
    const statusId = this.getCurrentStatusId();
    if (this.statusCacheLoaded) {
      return this.apiService.getCachedStatusName(statusId);
    }
    return this.currentStatusInfo?.status_name || this.ticketData?.ticket?.status_name || getStatusName(statusId, 'en');
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    return this.languageService.formatDate(dateString, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  getStatusBadgeClass(statusId?: number): string {
    return getStatusBadgeClass(statusId || this.getCurrentStatusId());
  }

  getStatusIcon(statusId?: number): string {
    return getStatusIcon(statusId || this.getCurrentStatusId());
  }

  // ===== ATTACHMENT MODAL =====

  onAttachmentClick(attachment: any): void {
    this.currentAttachment = attachment;
    this.showAttachmentModal = true;
    document.body.classList.add('modal-open');
  }

  closeAttachmentModal(): void {
    this.showAttachmentModal = false;
    this.currentAttachment = null;
    document.body.classList.remove('modal-open');
  }

  downloadAttachment(attachment: any): void {
    if (!attachment) return;
    const fileInfo = this.fileService.getFileInfo(attachment);
    this.fileService.downloadFile(attachment.path, fileInfo.filename);
  }

  backToList(): void {
    this.router.navigate(['/tickets']);
  }

  // ===== HISTORY UTILS =====

  isStatusSkipped(historyItem: HistoryDisplayItem): boolean {
    return !historyItem.create_date || historyItem.create_date.trim() === '';
  }

  getHistoryBadgeClass(historyItem: HistoryDisplayItem): string {
    if (historyItem.is_skipped) return 'badge-skipped';
    if (historyItem.is_active) return 'badge-current';
    if (historyItem.is_completed) return 'badge-completed';
    return 'badge-pending';
  }

  getHistoryIcon(statusId: number): string {
    const workflowItem = this.STATUS_WORKFLOW.find(s => s.id === statusId);
    return workflowItem?.icon || 'bi-file-text';
  }

  hasHistoryDate(historyItem: HistoryDisplayItem): boolean {
    return !!historyItem.create_date && historyItem.create_date.trim() !== '';
  }

  formatHistoryDate(dateString: string): string {
    if (!dateString || dateString.trim() === '') return '-';
    return this.languageService.formatDate(dateString, {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
  }

  // ===== INITIALIZATION UTILS =====

  private loadStatusCache(): void {
    if (this.apiService.isStatusCacheLoaded()) {
      this.statusCacheLoaded = true;
      return;
    }
    this.isLoadingStatuses = true;
    this.apiService.loadAndCacheStatuses().subscribe({
      next: (success) => {
        if (success) {
          this.statusCacheLoaded = true;
          if (this.ticketData?.ticket) this.updateStatusFromCache();
        } else {
          this.statusCacheError = 'Error loading statuses';
        }
        this.isLoadingStatuses = false;
      },
      error: () => this.isLoadingStatuses = false
    });
  }

  private updateStatusFromCache(): void {
    if (!this.ticketData?.ticket || !this.statusCacheLoaded) return;
    const statusId = this.ticketData.ticket.status_id;
    const statusName = this.apiService.getCachedStatusName(statusId);

    this.currentStatusInfo = { status_id: statusId, status_name: statusName, language_id: 'th' };
    this.ticketData.ticket.status_name = statusName;
    this.buildDisplayHistory();
    this.updateEvaluationStatus();
  }

  public async loadTicketDetail(): Promise<void> {
    this.isLoading = true;
    this.error = '';
    try {
      await this.getTicketByTicketNo(this.ticket_no);
      if (!this.ticketData?.ticket) {
        this.error = 'Unable to load ticket data';
        return;
      }
      this.useTicketDataStatus();
      await this.loadTicketHistory();
      this.loadExistingSatisfaction();
    } catch (error) {
      console.error(error);
      this.error = 'Error loading ticket';
    } finally {
      this.isLoading = false;
    }
  }

  private useTicketDataStatus(): void {
    if (!this.ticketData?.ticket) return;
    const statusId = this.ticketData.ticket.status_id || 5;
    const statusName = this.statusCacheLoaded ? this.apiService.getCachedStatusName(statusId) : (this.ticketData.ticket.status_name || getStatusName(statusId, 'en'));

    this.currentStatusInfo = { status_id: statusId, status_name: statusName, language_id: 'th' };
    this.ticketData.ticket.status_id = statusId;
    this.ticketData.ticket.status_name = statusName;
    this.updateEvaluationStatus();
  }

  private async loadTicketHistory(): Promise<void> {
    if (!this.ticketData?.ticket?.id) {
      this.buildHistoryFromExistingData();
      return;
    }
    this.isLoadingHistory = true;
    try {
      const historyResponse = await this.getMockTicketHistory(this.ticketData.ticket.id).toPromise();
      if (historyResponse?.success && historyResponse.data) {
        this.ticketHistory = historyResponse.data;
        this.buildDisplayHistory();
      } else {
        this.buildHistoryFromExistingData();
      }
    } catch {
      this.buildHistoryFromExistingData();
    } finally {
      this.isLoadingHistory = false;
    }
  }

  private getMockTicketHistory(ticketId: number): Observable<TicketHistoryResponse> {
    const existingHistory = this.ticketData?.status_history || [];
    const historyFromDatabase: TicketStatusHistory[] = existingHistory.filter(h => h.create_date).map((historyItem, index) => ({
        id: index + 1, ticket_id: ticketId, status_id: historyItem.status_id,
        create_date: historyItem.create_date, create_by: 1,
        status: { id: historyItem.status_id, name: historyItem.status_name }
      }));
    const mockResponse: TicketHistoryResponse = { success: true, message: 'History from database', data: historyFromDatabase };
    return new Observable<TicketHistoryResponse>((observer) => {
      setTimeout(() => { observer.next(mockResponse); observer.complete(); }, 50);
    });
  }

  private buildDisplayHistory(): void {
    if (!this.ticketData?.ticket) return;
    const currentStatusId = this.getCurrentStatusId();
    this.updateHistoryWithCurrentStatus(currentStatusId);

    this.displayHistory = this.STATUS_WORKFLOW.map((workflowStatus) => {
      const historyItem = this.ticketHistory.find(h => h.status_id === workflowStatus.id);
      const currentPosition = this.getStatusPosition(currentStatusId);
      const thisPosition = this.getStatusPosition(workflowStatus.id);
      const isActive = workflowStatus.id === currentStatusId;
      const isCompleted = thisPosition < currentPosition && thisPosition !== -1;
      let createDate = '';
      if (historyItem?.create_date) createDate = historyItem.create_date;
      else if (isActive) createDate = new Date().toISOString();

      const isSkipped = !createDate || createDate.trim() === '';
      const statusName = this.statusCacheLoaded ? this.apiService.getCachedStatusName(workflowStatus.id) : workflowStatus.name;

      return { status_id: workflowStatus.id, status_name: statusName, create_date: createDate, is_active: isActive, is_completed: isCompleted, is_skipped: isSkipped };
    });
  }

  private updateHistoryWithCurrentStatus(currentStatusId: number): void {
    const hasCurrentStatusInHistory = this.ticketHistory.some(h => h.status_id === currentStatusId);
    if (!hasCurrentStatusInHistory) {
      const newHistoryEntry: TicketStatusHistory = {
        id: this.ticketHistory.length + 1, ticket_id: this.ticketData!.ticket.id,
        status_id: currentStatusId, create_date: new Date().toISOString(), create_by: 1,
        status: { id: currentStatusId, name: this.apiService.getCachedStatusName(currentStatusId) }
      };
      this.ticketHistory.push(newHistoryEntry);
    }
  }

  private buildHistoryFromExistingData(): void {
    if (!this.ticketData?.ticket) return;
    const currentStatusId = this.getCurrentStatusId();
    const existingHistory = this.ticketData.status_history || [];

    this.displayHistory = this.STATUS_WORKFLOW.map((workflowStatus) => {
      const existingItem = existingHistory.find(h => h.status_id === workflowStatus.id);
      const currentPosition = this.getStatusPosition(currentStatusId);
      const thisPosition = this.getStatusPosition(workflowStatus.id);
      const isActive = workflowStatus.id === currentStatusId;
      const isCompleted = thisPosition < currentPosition && thisPosition !== -1;
      const createDate = existingItem?.create_date || '';
      const isSkipped = !createDate || createDate.trim() === '';
      const statusName = this.statusCacheLoaded ? this.apiService.getCachedStatusName(workflowStatus.id) : workflowStatus.name;

      return { status_id: workflowStatus.id, status_name: statusName, create_date: createDate, is_active: isActive, is_completed: isCompleted, is_skipped: isSkipped };
    });
  }

  private getStatusPosition(statusId: number): number {
    const index = this.STATUS_WORKFLOW.findIndex(s => s.id === statusId);
    return index !== -1 ? index : 0;
  }

  private updateEvaluationStatus(): void {
    const statusId = this.getCurrentStatusId();
    this.canEvaluate = statusId === TICKET_STATUS_IDS.COMPLETED;
    this.satisfactionMessage = this.apiService.getEvaluationStatusMessage(statusId);
  }

  private loadExistingSatisfaction(): void {
    const savedRating = localStorage.getItem(`satisfaction_${this.ticket_no}`);
    if (savedRating) {
      const rating = parseInt(savedRating, 10);
      if (rating >= 1 && rating <= 5) {
        this.currentRating = rating;
        this.hasExistingSatisfaction = true;
        this.satisfactionMessage = `You rated ${rating} stars`;
      }
    }
  }

  private saveSatisfactionToStorage(rating: number): void {
    try {
      localStorage.setItem(`satisfaction_${this.ticket_no}`, rating.toString());
      localStorage.setItem(`satisfaction_${this.ticket_no}_timestamp`, new Date().toISOString());
    } catch (error) { console.warn(error); }
  }

  private saveTicketDataForEdit(): void {
    if (!this.ticketData?.ticket) return;
    const currentUserId = this.authService.getCurrentUser()?.id;
    if (!currentUserId) return;

    const editTicketData = {
      userId: currentUserId, ticketId: this.ticketData.ticket.id, ticket_no: this.ticketData.ticket.ticket_no,
      isEditMode: true, isTicketCreated: true,
      formData: { projectId: this.ticketData.ticket.project_id, categoryId: this.ticketData.ticket.categories_id, issueDescription: this.ticketData.ticket.issue_description },
      selectedProject: { id: this.ticketData.ticket.project_id, projectName: this.ticketData.ticket.project_name },
      selectedCategory: { id: this.ticketData.ticket.categories_id, categoryName: this.ticketData.ticket.categories_name },
      existingAttachments: this.ticketData.issue_attachment.map(attachment => ({
        attachment_id: attachment.attachment_id, path: attachment.path, filename: attachment.filename, file_type: attachment.file_type, file_size: attachment.file_size
      })),
      timestamp: new Date().getTime()
    };
    localStorage.setItem(`editTicket_${currentUserId}_${this.ticketData.ticket.ticket_no}`, JSON.stringify(editTicketData));
  }

  private deleteTicket(ticket_no: string): void {
    this.isDeleting = true;
    this.apiService.deleteTicketByTicketNo(ticket_no).subscribe({
      next: (response: any) => {
        if (response.code === 1) {
          alert(this.languageService.translate('ticketDetail.deleteSuccess'));
          this.clearLocalStorageData();
          this.backToList();
        } else {
          alert(`Failed: ${response.message}`);
        }
        this.isDeleting = false;
      },
      error: (error: any) => {
        alert(`Error: ${error}`);
        this.isDeleting = false;
      }
    });
  }

  private clearLocalStorageData(): void {
    const currentUserId = this.authService.getCurrentUser()?.id;
    if (currentUserId) {
      localStorage.removeItem(`incompleteTicket_${currentUserId}`);
      localStorage.removeItem(`editTicket_${currentUserId}_${this.ticket_no}`);
    }
  }

  private refreshTicketData(): void {
    const requestData: GetTicketDataRequest = { ticket_no: this.ticket_no };
    this.apiService.getTicketData(requestData).subscribe({
      next: (response: any) => {
        if (response && response.code === 1 && response.data) {
          this.ticketData = response.data;
          if (response.data.ticket.status_id) {
            this.currentStatusInfo = {
              status_id: response.data.ticket.status_id,
              status_name: this.apiService.getCachedStatusName(response.data.ticket.status_id),
              language_id: 'th'
            };
          }
          this.buildDisplayHistory();
          this.updateEvaluationStatus();
        }
      }
    });
  }

  private getTicketByTicketNo(ticket_no: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!ticket_no || ticket_no.trim() === '') {
        this.error = 'Invalid ticket number';
        reject(new Error('Invalid ticket number'));
        return;
      }
      const requestData: GetTicketDataRequest = { ticket_no: ticket_no };
      this.apiService.getTicketData(requestData).subscribe({
        next: (response: any) => {
          if (response && response.code === 1) {
            if (response.data && this.isValidTicketData(response.data)) {
              this.ticketData = response.data as TicketData;
              resolve();
            } else {
              this.error = 'Invalid ticket data';
              reject(new Error('Invalid ticket data'));
            }
          } else {
            this.error = response?.message || 'Ticket not found';
            reject(new Error(this.error));
          }
        },
        error: (error: any) => {
          this.error = 'Connection error';
          reject(error);
        }
      });
    });
  }

  private isValidTicketData(data: any): boolean {
    return data.ticket && typeof data.ticket === 'object' && Array.isArray(data.issue_attachment) && Array.isArray(data.fix_attachment) && Array.isArray(data.status_history);
  }

  canShowForm(): boolean {
    const userPermissions = this.authService.getEffectivePermissions();
    return userPermissions.includes(5) || userPermissions.includes(8) || userPermissions.includes(19);
  }
}