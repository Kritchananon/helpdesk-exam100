import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService, MasterFilterCategory, MasterFilterProject, AllTicketData } from '../../../shared/services/api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { LanguageService } from '../../../shared/services/language.service';
import { permissionEnum, UserRole, ROLES } from '../../../shared/models/permission.model';
import { UserWithPermissions } from '../../../shared/models/user.model';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket-list.component.html',
  styleUrls: ['./ticket-list.component.css']
})
export class TicketListComponent implements OnInit, OnDestroy {

  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private languageService = inject(LanguageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Subscriptions
  private subscriptions: Subscription[] = [];

  // Permission Enums
  readonly permissionEnum = permissionEnum;
  readonly ROLES = ROLES;

  // User and Permission Data
  currentUser: UserWithPermissions | null = null;
  userPermissions: permissionEnum[] = [];
  userRoles: UserRole[] = [];

  // View Mode Configuration
  viewMode: 'all' | 'own-only' = 'all';
  canViewAllTickets = false;
  canViewOwnTickets = false;
  canCreateTickets = false;
  canManageTickets = false;

  // Ticket Data
  tickets: AllTicketData[] = [];
  filteredTickets: AllTicketData[] = [];
  isLoading = false;
  ticketsError = '';
  noTicketsFound = false;

  // Pagination state
  pagination = {
    currentPage: 1,
    perPage: 25,
    totalRows: 0,
    totalPages: 1
  };

  // Filter Data
  categories: MasterFilterCategory[] = [];
  projects: MasterFilterProject[] = [];
  statuses: { id: number; name: string }[] = [];
  loadingFilters = false;
  filterError = '';

  // Status Management
  statusCacheLoaded = false;
  isLoadingStatuses = false;
  statusError = '';

  // Filter Values
  selectedPriority: string = '';
  selectedStatus: string = '';
  selectedCategory: string = '';
  selectedProject: string = '';
  searchText: string = '';

  // Search timeout for debouncing
  private searchTimeout: any = null;

  // Priority Options
  priorityOptions = [
    { value: '', label: 'All Priority' },
    { value: '3', label: 'High' },
    { value: '2', label: 'Medium' },
    { value: '1', label: 'Low' }
  ];

  // Status Options
  statusOptions = [
    { value: '', label: 'All Status' },
    { value: '1', label: 'Pending' },
    { value: '2', label: 'Open Ticket' },
    { value: '3', label: 'In Progress' },
    { value: '4', label: 'Resolved' },
    { value: '5', label: 'Complete' },
    { value: '6', label: 'Cancel' }
  ];

  ngOnInit(): void {
    console.log('🎫 TicketListComponent initialized');

    // Subscribe to language changes
    const langSub = this.languageService.currentLanguage$.subscribe(lang => {
      this.loadStatuses(); 
      this.loadMasterFilters(); 
      this.loadTickets(this.pagination.currentPage);
    });
    this.subscriptions.push(langSub);

    this.loadStatuses();
    this.loadUserData();
    this.determineViewMode();
    this.checkPermissions();
    this.loadStatusCache();
    this.loadMasterFilters();
    this.loadTickets();
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ===== TRANSLATION HELPER =====

  t(key: string, params?: { [key: string]: any }): string {
    return this.languageService.translate(key, params);
  }

  getLangValue(data: any, fieldPrefix: string): string {
    if (!data) return '';
    const currentLang = this.languageService.getCurrentLanguage(); 
    
    const langKey = `${fieldPrefix}_${currentLang}`;
    if (data[langKey]) return data[langKey];

    const enKey = `${fieldPrefix}_en`;
    if (data[enKey]) return data[enKey];

    if (data[fieldPrefix]) return data[fieldPrefix];

    return '';
  }

  // ===== ✅ STATUS LOGIC (แก้ไขใหม่ให้รองรับทุกเคส) =====

  /**
   * Helper: ค้นหา Status ID ที่ถูกต้องที่สุด
   * รองรับทั้ง status_id, statusId และการเดาจากชื่อ (Fallback)
   */
  private resolveStatusId(ticket: any): number {
    // 1. ลองดึงจาก Key ปกติ หรือ Key ที่อาจจะพิมพ์ผิด
    let id = ticket.status_id ?? ticket.statusId ?? ticket.status;

    // 2. ถ้าได้เป็นตัวเลขที่ถูกต้อง ให้ใช้เลย
    if (id && !isNaN(Number(id)) && Number(id) > 0) {
      return Number(id);
    }

    // 3. Fallback: ถ้าหา ID ไม่เจอ ให้เดาจาก "ชื่อสถานะ" (Case Insensitive)
    // วิธีนี้ช่วยแก้ปัญหาสีเหลืองล้วนได้ ถ้า Backend ส่งมาแต่ชื่อ
    const name = (ticket.status_name || ticket.status_name_en || ticket.status_name_th || '').toLowerCase();
    
    if (name.includes('create') || name.includes('pending')) return 1;
    if (name.includes('open')) return 2;
    if (name.includes('progress')) return 3;
    if (name.includes('resolved') || name.includes('resolve')) return 4;
    if (name.includes('complete')) return 5;
    if (name.includes('cancel')) return 6;

    // Default เป็น 1 (Pending) ถ้าหาไม่เจอเลย
    return 1; 
  }

  getDisplayStatus(ticket: any): string {
    const id = this.resolveStatusId(ticket);
    const name = (ticket.status_name || ticket.status_name_en || '').toLowerCase();

    // ✅ บังคับ: ถ้า ID=1 หรือชื่อเป็น Created/Pending ให้แสดงคำว่า "Pending" เสมอ
    if (id === 1 || name === 'created' || name === 'pending') {
      return this.t('tickets.pending');
    }

    // กรณีอื่น ดึงชื่อจาก API
    const apiStatus = this.getLangValue(ticket, 'status_name');
    if (apiStatus && apiStatus !== 'undefined') {
      return apiStatus;
    }

    return this.getStatusText(id);
  }

  getStatusBadgeClass(ticket: any): string {
    // ✅ รับ ticket ทั้งก้อน แล้วใช้ตัวช่วยหา ID
    const id = this.resolveStatusId(ticket);
    switch (id) {
      case 1: return 'badge-pending';
      case 2: return 'badge-in-progress';
      case 3: return 'badge-hold';
      case 4: return 'badge-resolved';
      case 5: return 'badge-complete';
      case 6: return 'badge-cancel';
      default: return 'badge-pending';
    }
  }

  getStatusIcon(ticket: any): string {
    // ✅ รับ ticket ทั้งก้อน แล้วใช้ตัวช่วยหา ID
    const id = this.resolveStatusId(ticket);
    switch (id) {
      case 1: return 'bi-clock';
      case 2: return 'bi-folder2-open';
      case 3: return 'bi-chat-dots';
      case 4: return 'bi-clipboard-check';
      case 5: return 'bi-check-circle';
      case 6: return 'bi-x-circle';
      default: return 'bi-clock';
    }
  }

  getStatusText(statusId: number): string {
    if (this.statusCacheLoaded) {
      const cachedName = this.apiService.getCachedStatusName(statusId);
      return this.normalizeStatusName(cachedName);
    }
    switch (statusId) {
      case 1: return this.t('tickets.pending');
      case 2: return this.t('tickets.openTicket');
      case 3: return this.t('tickets.inProgress');
      case 4: return this.t('tickets.resolved');
      case 5: return this.t('tickets.complete');
      case 6: return this.t('tickets.cancel');
      default: return this.t('tickets.unknown');
    }
  }

  private normalizeStatusName(statusName: string): string {
    const normalized = statusName.toLowerCase().trim();
    const statusMap: { [key: string]: string } = {
      'created': 'Pending',
      'pending': 'Pending',
      'open': 'Open Ticket',
      'open ticket': 'Open Ticket',
      'in progress': 'In Progress',
      'progress': 'In Progress',
      'resolved': 'Resolved',
      'complete': 'Complete',
      'completed': 'Complete',
      'cancel': 'Cancel',
      'cancelled': 'Cancel',
      'canceled': 'Cancel'
    };
    return statusMap[normalized] || statusName;
  }

  // ===== USER DATA & PERMISSIONS =====

  private loadUserData(): void {
    this.currentUser = this.authService.getCurrentUserWithPermissions();
    this.userPermissions = this.authService.getUserPermissions();
    this.userRoles = this.authService.getUserRoles();
  }

  private determineViewMode(): void {
    const routeViewMode = this.route.snapshot.data['viewMode'];
    if (routeViewMode === 'own-only') {
      this.viewMode = 'own-only';
    } else {
      if (this.authService.hasPermission(permissionEnum.VIEW_ALL_TICKETS)) {
        this.viewMode = 'all';
      } else if (this.authService.hasPermission(permissionEnum.VIEW_OWN_TICKETS)) {
        this.viewMode = 'own-only';
      } else {
        this.viewMode = 'own-only';
      }
    }
  }

  private checkPermissions(): void {
    this.canViewAllTickets = this.authService.hasPermission(permissionEnum.VIEW_ALL_TICKETS);
    this.canViewOwnTickets = this.authService.hasPermission(permissionEnum.VIEW_OWN_TICKETS);
    this.canCreateTickets = this.authService.hasPermission(permissionEnum.CREATE_TICKET);
    this.canManageTickets = this.authService.canManageTickets();

    if (!this.canViewAllTickets && !this.canViewOwnTickets) {
      this.router.navigate(['/dashboard']);
      return;
    }
  }

  // ===== PERMISSION HELPER METHODS =====

  hasPermission(permission: permissionEnum): boolean {
    return this.authService.hasPermission(permission);
  }

  hasRole(role: UserRole): boolean {
    return this.authService.hasRole(role);
  }

  hasAnyRole(roles: UserRole[]): boolean {
    return this.authService.hasAnyRole(roles);
  }

  canEditTicket(ticket: AllTicketData): boolean {
    if (this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER])) {
      return this.hasPermission(permissionEnum.EDIT_TICKET) ||
        this.hasPermission(permissionEnum.CHANGE_STATUS);
    }
    if (this.hasRole(ROLES.USER)) {
      return this.hasPermission(permissionEnum.EDIT_TICKET) &&
        ticket.create_by === this.currentUser?.id;
    }
    return false;
  }

  canDeleteTicket(ticket: AllTicketData): boolean {
    if (this.hasRole(ROLES.ADMIN)) return this.hasPermission(permissionEnum.DELETE_TICKET);
    if (this.hasRole(ROLES.USER)) {
      return this.hasPermission(permissionEnum.DELETE_TICKET) &&
        ticket.create_by === this.currentUser?.id &&
        this.resolveStatusId(ticket) === 1; // Use resolved ID
    }
    return false;
  }

  canChangeStatus(ticket: AllTicketData): boolean {
    return this.hasPermission(permissionEnum.CHANGE_STATUS) &&
      this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }

  canAssignTicket(ticket: AllTicketData): boolean {
    return this.hasPermission(permissionEnum.ASSIGNEE) &&
      this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }

  canReplyToTicket(ticket: AllTicketData): boolean {
    return this.hasPermission(permissionEnum.REPLY_TICKET) &&
      this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }

  canSolveProblem(ticket: AllTicketData): boolean {
    return this.hasPermission(permissionEnum.SOLVE_PROBLEM) &&
      this.hasAnyRole([ROLES.ADMIN, ROLES.SUPPORTER]);
  }

  canRateSatisfaction(ticket: AllTicketData): boolean {
    const id = this.resolveStatusId(ticket);
    return this.hasPermission(permissionEnum.SATISFACTION) &&
      ticket.create_by === this.currentUser?.id &&
      id === 5;
  }

  // ===== DATA LOADING =====

  private loadStatusCache(): void {
    if (this.apiService.isStatusCacheLoaded()) {
      this.statusCacheLoaded = true;
      return;
    }
    this.isLoadingStatuses = true;
    this.statusError = '';
    this.apiService.loadAndCacheStatuses().subscribe({
      next: (success) => {
        this.statusCacheLoaded = success;
        this.isLoadingStatuses = false;
        if (!success) this.statusError = this.t('tickets.statusLoadFailed');
      },
      error: () => {
        this.statusError = this.t('tickets.statusLoadError');
        this.isLoadingStatuses = false;
      }
    });
  }

  private loadStatuses(): void {
    this.statuses = [
      { id: 1, name: this.t('tickets.pending') },
      { id: 2, name: this.t('tickets.openTicket') },
      { id: 3, name: this.t('tickets.inProgress') },
      { id: 4, name: this.t('tickets.resolved') },
      { id: 5, name: this.t('tickets.complete') },
      { id: 6, name: this.t('tickets.cancel') }
    ];
  }

  private loadTickets(page: number = 1): void {
    this.isLoading = true;
    this.ticketsError = '';
    this.noTicketsFound = false;
    const currentLang = this.languageService.getCurrentLanguage();

    const params: any = {
      page,
      perPage: 25,
      catlang_id: currentLang
    };

    if (this.searchText && this.searchText.trim()) params.search = this.searchText.trim();
    if (this.selectedPriority) params.priority = Number(this.selectedPriority);
    if (this.selectedStatus) params.status_id = Number(this.selectedStatus);
    if (this.selectedCategory) {
      params.category_id = Number(this.selectedCategory);
      params.categories_id = Number(this.selectedCategory);
    }
    if (this.selectedProject) params.project_id = Number(this.selectedProject);

    this.apiService.getAllTickets(params).subscribe({
      next: (res: any) => {
        if (res?.success && Array.isArray(res.data)) {
          const allTickets = res.data.filter((ticket: any) => {
             return !ticket.catlang_id || ticket.catlang_id === currentLang;
          });

          this.tickets = allTickets;
          this.filteredTickets = allTickets;

          this.pagination = res.pagination ? {
            currentPage: res.pagination.currentPage || page,
            perPage: res.pagination.perPage || 25,
            totalRows: res.pagination.totalRows || allTickets.length,
            totalPages: res.pagination.totalPages || 1
          } : {
            currentPage: page,
            perPage: 25,
            totalRows: allTickets.length,
            totalPages: Math.ceil(allTickets.length / 25)
          };
          this.noTicketsFound = allTickets.length === 0 && this.pagination.totalRows === 0;
        } else {
          this.tickets = [];
          this.filteredTickets = [];
          this.noTicketsFound = true;
        }
        this.isLoading = false;
      },
      error: () => {
        this.ticketsError = this.t('tickets.loadError');
        this.isLoading = false;
        this.noTicketsFound = true;
      }
    });
  }

  changePage(page: number): void {
    if (!this.pagination) return;
    if (page < 1 || page > this.pagination.totalPages) return;
    if (page === this.pagination.currentPage) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.loadTickets(page);
  }

  getDisplayedPages(): (number | string)[] {
    const total = this.pagination?.totalPages || 1;
    const current = this.pagination?.currentPage || 1;
    const delta = 2;
    const range: (number | string)[] = [];
    const pages: (number | string)[] = [];

    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
      range.push(i);
    }

    if (current - delta > 2) pages.push(1, '...');
    else for (let i = 1; i < Math.max(2, current - delta); i++) pages.push(i);

    pages.push(...range);

    if (current + delta < total - 1) pages.push('...', total);
    else for (let i = Math.min(total - 1, current + delta) + 1; i <= total; i++) pages.push(i);

    return pages;
  }

  loadMasterFilters(): void {
    this.loadingFilters = true;
    this.filterError = '';
    this.apiService.getAllMasterFilter().subscribe({
      next: (response) => {
        const resData = response.data?.data;
        if (response.data?.code === 1 && resData) {
          const currentLang = this.languageService.getCurrentLanguage();
          this.categories = (resData.categories ?? []).filter(
            (cat: any) => cat.tcl_language_id === currentLang
          );
          this.projects = resData.projects ?? [];
        } else {
          this.filterError = this.t('tickets.filterLoadError');
        }
        this.loadingFilters = false;
      },
      error: () => {
        this.filterError = this.t('tickets.filterLoadError');
        this.loadingFilters = false;
      }
    });
  }

  onPriorityChangeModel(value: string): void { this.applyFilters(); }
  onStatusChangeModel(value: string): void { this.applyFilters(); }
  onCategoryChangeModel(value: string): void { this.applyFilters(); }
  onProjectChangeModel(value: string): void { this.applyFilters(); }

  applyFilters(): void { this.loadTickets(1); }

  clearSearch(): void {
    this.searchText = '';
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchText = '';
    this.selectedPriority = '';
    this.selectedStatus = '';
    this.selectedProject = '';
    this.selectedCategory = '';
    this.loadTickets(1);
  }

  exportExcel(): void {
    const filter = {
      search: this.searchText?.trim() || '',
      priority: this.selectedPriority || '',
      status: this.selectedStatus || '',
      category: this.selectedCategory || '',
      project: this.selectedProject || ''
    };
    this.apiService.exportTicketsExcel(filter).subscribe({
      next: (blob: Blob) => {
        const fileName = `Helpdesk_Tickets_${new Date().toISOString().slice(0, 10)}.xlsx`;
        saveAs(blob, fileName);
      },
      error: () => {
        alert(this.t('tickets.exportError'));
      }
    });
  }

  getUserDisplayName(ticket: AllTicketData): string {
    const anyTicket = ticket as any;
    if (anyTicket.name && anyTicket.name.trim() && !anyTicket.name.includes('undefined undefined')) {
      return anyTicket.name;
    }
    if (ticket.user_name && ticket.user_name.trim()) return ticket.user_name;
    if (anyTicket.username && anyTicket.username.trim()) return anyTicket.username;
    if (anyTicket.user_email && anyTicket.user_email.trim()) return anyTicket.user_email;
    if (anyTicket.creator_name && anyTicket.creator_name.trim()) return anyTicket.creator_name;
    if (anyTicket.created_by_name && anyTicket.created_by_name.trim()) return anyTicket.created_by_name;
    if (ticket.create_by) return `User #${ticket.create_by}`;
    return this.t('tickets.unknownUser');
  }

  getPriorityLevel(priority: any): string {
    const priorityNum = Number(priority);
    switch (priorityNum) {
      case 3: return 'high';
      case 2: return 'medium';
      case 1: return 'low';
      default: return 'medium';
    }
  }

  getPriorityLabel(priority: any): string {
    const priorityNum = Number(priority);
    switch (priorityNum) {
      case 3: return this.t('tickets.priorityHigh');
      case 2: return this.t('tickets.priorityMedium');
      case 1: return this.t('tickets.priorityLow');
      default: return this.t('tickets.priorityMedium');
    }
  }

  isHighPriority(ticket: AllTicketData): boolean {
    return Number(ticket.priority_id) === 3;
  }

  getPriorityBadgeClass(priority: any): string {
    const level = this.getPriorityLevel(priority);
    switch (level) {
      case 'high': return 'badge-priority-high';
      case 'medium': return 'badge-priority-medium';
      case 'low': return 'badge-priority-low';
      default: return 'badge-priority-medium';
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const locale = this.languageService.getCurrentLanguage() === 'th' ? 'th-TH' : 'en-US';
      return new Date(dateString).toLocaleDateString(locale, {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return 'N/A'; }
  }

  viewTicket(ticket: AllTicketData): void {
    this.router.navigate(['/tickets', ticket.ticket_no]);
  }

  editTicket(ticket: AllTicketData): void {
    if (!this.canEditTicket(ticket)) return;
    this.router.navigate(['/tickets/edit', ticket.ticket_no]);
  }

  createNewTicket(): void {
    if (!this.canCreateTickets) return;
    this.router.navigate(['/tickets/new']);
  }

  deleteTicket(ticket: AllTicketData): void {
    if (!this.canDeleteTicket(ticket)) return;
    const confirmMessage = this.t('tickets.deleteConfirm', { ticketNo: ticket.ticket_no });
    if (confirm(confirmMessage)) {
      this.apiService.deleteTicketByTicketNo(ticket.ticket_no).subscribe({
        next: (response) => {
          if (response.code === 1) this.loadTickets();
          else alert(this.t('tickets.deleteFailed') + ': ' + response.message);
        },
        error: () => alert(this.t('tickets.deleteError'))
      });
    }
  }

  changeTicketStatus(ticket: AllTicketData, newStatusId: number): void {
    if (!this.canChangeStatus(ticket)) return;
    this.apiService.updateTicketByTicketNo(ticket.ticket_no, { status_id: newStatusId }).subscribe({
      next: (response) => {
        if (response.code === 1) ticket.status_id = newStatusId;
        else alert(this.t('tickets.statusChangeFailed') + ': ' + response.message);
      },
      error: () => alert(this.t('tickets.statusChangeError'))
    });
  }

  assignTicket(ticket: AllTicketData): void {
    if (!this.canAssignTicket(ticket)) return;
    alert(this.t('tickets.assignNotAvailable'));
  }

  reloadTickets(): void { this.loadTickets(); }

  reloadStatusCache(): void {
    this.apiService.clearStatusCache();
    this.statusCacheLoaded = false;
    this.loadStatusCache();
  }

  getDebugInfo(): any {
    return {
      totalTickets: this.tickets.length,
      filteredTickets: this.filteredTickets.length,
      statusCache: { loaded: this.statusCacheLoaded, loading: this.isLoadingStatuses }
    };
  }

  getViewModeTitle(): string {
    return this.viewMode === 'all' ? this.t('tickets.allTickets') : this.t('tickets.myTickets');
  }

  getViewModeDescription(): string {
    return this.viewMode === 'all' ? this.t('tickets.viewingAllTickets') : this.t('tickets.viewingMyTickets');
  }

  canSwitchViewMode(): boolean {
    return this.canViewAllTickets && this.canViewOwnTickets;
  }

  switchToAllTickets(): void { if (this.canViewAllTickets) this.router.navigate(['/tickets']); }
  switchToMyTickets(): void { if (this.canViewOwnTickets) this.router.navigate(['/tickets/my-tickets']); }
}