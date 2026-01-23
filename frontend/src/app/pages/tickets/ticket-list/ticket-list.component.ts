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
import { HasPermissionDirective, HasRoleDirective } from '../../../shared/directives/permission.directive';
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
      console.log('🌍 Ticket list language changed to:', lang);
      
      // 🎯 Reload statuses และ filters เมื่อเปลี่ยนภาษา
      this.loadStatuses(); // อัพเดท status labels
      this.loadMasterFilters(); // อัพเดท categories และ projects
      
      // ✅ Reload tickets เพื่อกรองข้อมูลใหม่ตามภาษาที่เลือก
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
    console.log('🧹 TicketListComponent cleanup');
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  // ===== TRANSLATION HELPER =====

  /**
   * Get translated text
   */
  t(key: string, params?: { [key: string]: any }): string {
    return this.languageService.translate(key, params);
  }

  // ===== ✅ MULTI-LANGUAGE HELPER (NEW) =====

  /**
   * Helper: ดึงค่าจาก Object ตามภาษาปัจจุบัน
   * ตัวอย่าง: getLangValue(ticket, 'status_name') จะไปหา status_name_th หรือ status_name_en
   */
  getLangValue(data: any, fieldPrefix: string): string {
    if (!data) return '';
    
    const currentLang = this.languageService.getCurrentLanguage(); // 'th' หรือ 'en'
    
    // 1. ลองหา key ที่ลงท้ายด้วยภาษาปัจจุบัน (เช่น status_name_th)
    const langKey = `${fieldPrefix}_${currentLang}`;
    if (data[langKey]) {
      return data[langKey];
    }

    // 2. ถ้าไม่เจอ ให้ลองหาภาษาอังกฤษเป็นค่า Default (เช่น status_name_en)
    const enKey = `${fieldPrefix}_en`;
    if (data[enKey]) {
      return data[enKey];
    }

    // 3. ถ้าไม่เจอเลย ให้ลองหา field name ตรงๆ (เผื่อ API ไม่ได้แยกภาษา)
    if (data[fieldPrefix]) {
      return data[fieldPrefix];
    }

    return '';
  }

  /**
   * Helper: แสดงสถานะโดยดึงจาก API ก่อน ถ้าไม่มีค่อยใช้ Hardcode ID
   */
  getDisplayStatus(ticket: any): string {
    // 1. ดึงชื่อสถานะจาก API (status_name_th / status_name_en)
    const apiStatus = this.getLangValue(ticket, 'status_name');
    
    // เช็คว่ามีค่าและไม่ใช่ string คำว่า "undefined"
    if (apiStatus && apiStatus !== 'undefined') {
      return apiStatus;
    }

    // 2. ถ้าไม่มีใน API ให้ใช้ฟังก์ชันเดิมแปลงจาก ID
    return this.getStatusText(ticket.status_id);
  }

  // ===== USER DATA & PERMISSIONS =====

  private loadUserData(): void {
    this.currentUser = this.authService.getCurrentUserWithPermissions();
    this.userPermissions = this.authService.getUserPermissions();
    this.userRoles = this.authService.getUserRoles();

    console.log('👤 User data loaded:', {
      username: this.currentUser?.username,
      permissions: this.userPermissions.length,
      roles: this.userRoles,
      primaryRole: this.authService.getPrimaryRole()
    });
  }

  private determineViewMode(): void {
    const routeViewMode = this.route.snapshot.data['viewMode'];
    if (routeViewMode === 'own-only') {
      this.viewMode = 'own-only';
      console.log('📋 View mode set to: own-only (from route data)');
    } else {
      if (this.authService.hasPermission(permissionEnum.VIEW_ALL_TICKETS)) {
        this.viewMode = 'all';
        console.log('📋 View mode set to: all (has VIEW_ALL_TICKETS permission)');
      } else if (this.authService.hasPermission(permissionEnum.VIEW_OWN_TICKETS)) {
        this.viewMode = 'own-only';
        console.log('📋 View mode set to: own-only (has VIEW_OWN_TICKETS permission only)');
      } else {
        console.warn('⚠️ User has no ticket viewing permissions');
        this.viewMode = 'own-only';
      }
    }
  }

  private checkPermissions(): void {
    this.canViewAllTickets = this.authService.hasPermission(permissionEnum.VIEW_ALL_TICKETS);
    this.canViewOwnTickets = this.authService.hasPermission(permissionEnum.VIEW_OWN_TICKETS);
    this.canCreateTickets = this.authService.hasPermission(permissionEnum.CREATE_TICKET);
    this.canManageTickets = this.authService.canManageTickets();

    console.log('🔒 Permission check results:', {
      canViewAllTickets: this.canViewAllTickets,
      canViewOwnTickets: this.canViewOwnTickets,
      canCreateTickets: this.canCreateTickets,
      canManageTickets: this.canManageTickets,
      viewMode: this.viewMode
    });

    if (!this.canViewAllTickets && !this.canViewOwnTickets) {
      console.error('❌ User has no ticket viewing permissions, redirecting to dashboard');
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
    if (this.hasRole(ROLES.ADMIN)) {
      return this.hasPermission(permissionEnum.DELETE_TICKET);
    }

    if (this.hasRole(ROLES.USER)) {
      return this.hasPermission(permissionEnum.DELETE_TICKET) &&
        ticket.create_by === this.currentUser?.id &&
        ticket.status_id === 1;
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
    return this.hasPermission(permissionEnum.SATISFACTION) &&
      ticket.create_by === this.currentUser?.id &&
      ticket.status_id === 5;
  }

  // ===== DATA LOADING =====

  private loadStatusCache(): void {
    console.log('=== Loading Status Cache ===');

    if (this.apiService.isStatusCacheLoaded()) {
      this.statusCacheLoaded = true;
      console.log('✅ Status cache already loaded');
      return;
    }

    this.isLoadingStatuses = true;
    this.statusError = '';

    this.apiService.loadAndCacheStatuses().subscribe({
      next: (success) => {
        if (success) {
          this.statusCacheLoaded = true;
          console.log('✅ Status cache loaded successfully');
        } else {
          console.warn('Status cache loading failed, using defaults');
          this.statusError = this.t('tickets.statusLoadFailed');
        }
        this.isLoadingStatuses = false;
      },
      error: (error) => {
        console.error('❌ Error loading status cache:', error);
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
    console.log(`=== Loading Tickets (page=${page}) ===`);

    this.isLoading = true;
    this.ticketsError = '';
    this.noTicketsFound = false;

    // ✅ ดึงค่าภาษาปัจจุบัน (th หรือ en)
    const currentLang = this.languageService.getCurrentLanguage();

    const params: any = {
      page,
      perPage: 25,
      catlang_id: currentLang // ส่งไปเผื่อ Backend รองรับในอนาคต
    };

    if (this.searchText && this.searchText.trim()) {
      params.search = this.searchText.trim();
    }
    if (this.selectedPriority) {
      params.priority = Number(this.selectedPriority);
    }
    if (this.selectedStatus) {
      params.status_id = Number(this.selectedStatus);
    }
    if (this.selectedCategory) {
      params.category_id = Number(this.selectedCategory);
      params.categories_id = Number(this.selectedCategory);
    }
    if (this.selectedProject) {
      params.project_id = Number(this.selectedProject);
    }

    console.log('📤 Sending params to API:', params);

    this.apiService.getAllTickets(params).subscribe({
      next: (res: any) => {
        console.log('✅ Response from backend:', res);

        if (res?.success && Array.isArray(res.data)) {
          
          // -----------------------------------------------------------------
          // ✅ FIX: Filter out duplicates by language on Frontend side
          // -----------------------------------------------------------------
          const allTickets = res.data.filter((ticket: any) => {
             // เก็บตั๋วถ้า catlang_id ตรงกับภาษาปัจจุบัน หรือถ้าไม่มี catlang_id (กันเหนียว)
             return !ticket.catlang_id || ticket.catlang_id === currentLang;
          });

          this.tickets = allTickets;
          this.filteredTickets = allTickets;

          // Note: Pagination may be inaccurate because we filtered items out client-side
          // but this is necessary until backend filters by catlang_id natively.
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

          console.log('📦 Final tickets (filtered):', allTickets.length);
          console.log('📊 Pagination:', this.pagination);
        } else {
          this.tickets = [];
          this.filteredTickets = [];
          this.noTicketsFound = true;
          console.warn('⚠️ Invalid response structure:', res);
        }

        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading tickets:', error);
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

    console.log('➡️ Changing to page:', page);
    
    // เลื่อนหน้าจอกลับขึ้นไปด้านบนสุดแบบ Smooth
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

    if (current - delta > 2) {
      pages.push(1, '...');
    } else {
      for (let i = 1; i < Math.max(2, current - delta); i++) {
        pages.push(i);
      }
    }

    pages.push(...range);

    if (current + delta < total - 1) {
      pages.push('...', total);
    } else {
      for (let i = Math.min(total - 1, current + delta) + 1; i <= total; i++) {
        pages.push(i);
      }
    }

    return pages;
  }

  loadMasterFilters(): void {
    this.loadingFilters = true;
    this.filterError = '';

    this.apiService.getAllMasterFilter().subscribe({
      next: (response) => {
        console.log('Master filter response:', response);

        const resData = response.data?.data;

        if (response.data?.code === 1 && resData) {
          // กรอง categories ตามภาษาปัจจุบัน
          const currentLang = this.languageService.getCurrentLanguage();
          
          this.categories = (resData.categories ?? []).filter(
            (cat: any) => cat.tcl_language_id === currentLang
          );
          
          this.projects = resData.projects ?? [];

          console.log(`✅ Loaded ${this.categories.length} categories for language: ${currentLang}`);
          console.log('Categories:', this.categories);
          console.log('Projects loaded:', this.projects.length);
        } else {
          this.filterError = this.t('tickets.filterLoadError');
        }

        this.loadingFilters = false;
      },
      error: (error) => {
        console.error('Error loading master filters:', error);
        this.filterError = this.t('tickets.filterLoadError');
        this.loadingFilters = false;
      }
    });
  }

  // ===== SEARCH & FILTER METHODS =====

  onPriorityChangeModel(value: string): void {
    console.log('🎯 Priority changed via ngModel:', value);
    this.applyFilters();
  }

  onStatusChangeModel(value: string): void {
    console.log('📊 Status changed via ngModel:', value);
    this.applyFilters();
  }

  onCategoryChangeModel(value: string): void {
    console.log('🏷️ Category changed via ngModel:', value);
    this.applyFilters();
  }

  onProjectChangeModel(value: string): void {
    console.log('📁 Project changed via ngModel:', value);
    this.applyFilters();
  }

  applyFilters(): void {
    console.log('🎯 Applying filters - reloading from API');
    this.loadTickets(1);
  }

  clearSearch(): void {
    this.searchText = '';
    console.log('🧹 Search cleared');
    this.applyFilters();
  }

  clearFilters(): void {
    console.log('🧹 Clearing all filters');
    this.searchText = '';
    this.selectedPriority = '';
    this.selectedStatus = '';
    this.selectedProject = '';
    this.selectedCategory = '';

    this.loadTickets(1);
  }

  exportExcel(): void {
    console.log('📊 Exporting Excel with current filters');

    const filter = {
      search: this.searchText?.trim() || '',
      priority: this.selectedPriority || '',
      status: this.selectedStatus || '',
      category: this.selectedCategory || '',
      project: this.selectedProject || ''
    };

    console.log('Export filter:', filter);

    this.apiService.exportTicketsExcel(filter).subscribe({
      next: (blob: Blob) => {
        const fileName = `Helpdesk_Tickets_${new Date().toISOString().slice(0, 10)}.xlsx`;
        saveAs(blob, fileName);
        console.log('✅ Excel exported successfully:', fileName);
      },
      error: (err) => {
        console.error('❌ Export Excel failed:', err);
        alert(this.t('tickets.exportError'));
      }
    });
  }

  // ===== STATUS MANAGEMENT =====

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

  getStatusText(statusId: number): string {
    if (this.statusCacheLoaded) {
      const cachedName = this.apiService.getCachedStatusName(statusId);
      return this.normalizeStatusName(cachedName);
    }

    // Fallback with translation
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

  getStatusBadgeClass(statusId: number): string {
    switch (statusId) {
      case 1: return 'badge-pending';
      case 2: return 'badge-in-progress';
      case 3: return 'badge-hold';
      case 4: return 'badge-resolved';
      case 5: return 'badge-complete';
      case 6: return 'badge-cancel';
      default: return 'badge-pending';
    }
  }

  getStatusIcon(statusId: number): string {
    switch (statusId) {
      case 1: return 'bi-clock';
      case 2: return 'bi-folder2-open';
      case 3: return 'bi-chat-dots';
      case 4: return 'bi-clipboard-check';
      case 5: return 'bi-check-circle';
      case 6: return 'bi-x-circle';
      default: return 'bi-clock';
    }
  }

  // ===== STYLING METHODS =====

  getUserDisplayName(ticket: AllTicketData): string {
    const anyTicket = ticket as any;

    // ✅ FIX: Check for "undefined undefined" string
    if (anyTicket.name && anyTicket.name.trim() && !anyTicket.name.includes('undefined undefined')) {
      return anyTicket.name;
    }

    if (ticket.user_name && ticket.user_name.trim()) {
      return ticket.user_name;
    }

    if (anyTicket.username && anyTicket.username.trim()) {
      return anyTicket.username;
    }

    if (anyTicket.user_email && anyTicket.user_email.trim()) {
      return anyTicket.user_email;
    }

    if (anyTicket.creator_name && anyTicket.creator_name.trim()) {
      return anyTicket.creator_name;
    }

    if (anyTicket.created_by_name && anyTicket.created_by_name.trim()) {
      return anyTicket.created_by_name;
    }

    if (ticket.create_by) {
      return `User #${ticket.create_by}`;
    }

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
    const priorityNum = Number(ticket.priority_id);
    return priorityNum === 3;
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
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  }

  // ===== NAVIGATION METHODS =====

  viewTicket(ticket: AllTicketData): void {
    console.log('Viewing ticket:', ticket.ticket_no);
    this.router.navigate(['/tickets', ticket.ticket_no]);
  }

  editTicket(ticket: AllTicketData): void {
    if (!this.canEditTicket(ticket)) {
      console.warn('User cannot edit this ticket');
      return;
    }

    console.log('Editing ticket:', ticket.ticket_no);
    this.router.navigate(['/tickets/edit', ticket.ticket_no]);
  }

  createNewTicket(): void {
    if (!this.canCreateTickets) {
      console.warn('User cannot create tickets');
      return;
    }

    console.log('Creating new ticket');
    this.router.navigate(['/tickets/new']);
  }

  // ===== TICKET ACTIONS =====

  deleteTicket(ticket: AllTicketData): void {
    if (!this.canDeleteTicket(ticket)) {
      console.warn('User cannot delete this ticket');
      return;
    }

    const confirmMessage = this.t('tickets.deleteConfirm', { ticketNo: ticket.ticket_no });
    const confirmDelete = confirm(confirmMessage);

    if (confirmDelete) {
      console.log('Deleting ticket:', ticket.ticket_no);

      this.apiService.deleteTicketByTicketNo(ticket.ticket_no).subscribe({
        next: (response) => {
          if (response.code === 1) {
            console.log('✅ Ticket deleted successfully');
            this.loadTickets();
          } else {
            console.error('❌ Failed to delete ticket:', response.message);
            alert(this.t('tickets.deleteFailed') + ': ' + response.message);
          }
        },
        error: (error) => {
          console.error('❌ Error deleting ticket:', error);
          alert(this.t('tickets.deleteError'));
        }
      });
    }
  }

  changeTicketStatus(ticket: AllTicketData, newStatusId: number): void {
    if (!this.canChangeStatus(ticket)) {
      console.warn('User cannot change ticket status');
      return;
    }

    console.log('Changing ticket status:', ticket.ticket_no, 'to', newStatusId);

    this.apiService.updateTicketByTicketNo(ticket.ticket_no, {
      status_id: newStatusId
    }).subscribe({
      next: (response) => {
        if (response.code === 1) {
          console.log('✅ Ticket status changed successfully');
          ticket.status_id = newStatusId;
        } else {
          console.error('❌ Failed to change ticket status:', response.message);
          alert(this.t('tickets.statusChangeFailed') + ': ' + response.message);
        }
      },
      error: (error) => {
        console.error('❌ Error changing ticket status:', error);
        alert(this.t('tickets.statusChangeError'));
      }
    });
  }

  assignTicket(ticket: AllTicketData): void {
    if (!this.canAssignTicket(ticket)) {
      console.warn('User cannot assign tickets');
      return;
    }

    console.log('Assigning ticket:', ticket.ticket_no);
    alert(this.t('tickets.assignNotAvailable'));
  }

  // ===== UTILITY METHODS =====

  reloadTickets(): void {
    console.log('🔄 Reloading tickets');
    this.loadTickets();
  }

  reloadStatusCache(): void {
    console.log('Reloading status cache...');
    this.apiService.clearStatusCache();
    this.statusCacheLoaded = false;
    this.loadStatusCache();
  }

  getDebugInfo(): any {
    return {
      totalTickets: this.tickets.length,
      filteredTickets: this.filteredTickets.length,
      currentUser: this.currentUser?.id,
      viewMode: this.viewMode,
      currentLanguage: this.languageService.getCurrentLanguage(),
      permissions: {
        canViewAll: this.canViewAllTickets,
        canViewOwn: this.canViewOwnTickets,
        canCreate: this.canCreateTickets,
        canManage: this.canManageTickets
      },
      hasError: !!this.ticketsError,
      isLoading: this.isLoading,
      statusCache: {
        loaded: this.statusCacheLoaded,
        loading: this.isLoadingStatuses,
        error: this.statusError
      },
      filters: {
        search: this.searchText,
        priority: this.selectedPriority,
        status: this.selectedStatus,
        project: this.selectedProject,
        category: this.selectedCategory
      }
    };
  }

  // ===== VIEW MODE METHODS =====

  getViewModeTitle(): string {
    return this.viewMode === 'all' 
      ? this.t('tickets.allTickets') 
      : this.t('tickets.myTickets');
  }

  getViewModeDescription(): string {
    return this.viewMode === 'all'
      ? this.t('tickets.viewingAllTickets')
      : this.t('tickets.viewingMyTickets');
  }

  canSwitchViewMode(): boolean {
    return this.canViewAllTickets && this.canViewOwnTickets;
  }

  switchToAllTickets(): void {
    if (this.canViewAllTickets) {
      this.router.navigate(['/tickets']);
    }
  }

  switchToMyTickets(): void {
    if (this.canViewOwnTickets) {
      this.router.navigate(['/tickets/my-tickets']);
    }
  }
}