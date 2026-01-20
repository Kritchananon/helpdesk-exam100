export interface Ticket {
  id: number;
  ticket_no: string;
  categories_id: number;
  project_id: number;
  issue_description: string;
  status_id: number;
  hour_estimate: number;
  estimate_time: string;
  due_date: string;
  lead_time: number;
  related_ticket_id?: number;
  change_request: boolean;
  create_date: string;
  create_by: number;
  update_date: string;
  update_by: number;
  isenabled: boolean;

  // ✅ เพิ่มบรรทัดนี้ก่อน close_estimate
  priority_id?: number;
  priority_name?: string;
  
  // ✅ เพิ่มฟิลด์ใหม่สำหรับ saveSupporter API
  close_estimate?: string;
  fix_issue_description?: string;
  status_name?: string; // ✅ เพิ่มสำหรับแสดงชื่อ status
}

export interface TicketStatus {
  id: number;
  create_date: string;
  create_by: number;
  isenabled: boolean;
}

export interface TicketCategory {
  id: number;
  create_date: string;
  create_by: number;
  isenabled: boolean;
}

// ✅ เพิ่ม Interface สำหรับ Attachment
export interface TicketAttachment {
  id: number;
  ticket_id: number;
  type: 'reporter' | 'supporter';
  extension: string;
  filename: string;
  create_by: number;
  update_by: number;
  deleted_at: string | null;
  create_date: string;
  isenabled: boolean;
}

// ✅ เพิ่ม Interface สำหรับ Time Calculations
export interface TimeCalculations {
  original: {
    estimate_time: string;
    lead_time: string;
    due_date: string;
    close_estimate: string;
  };
  updated: {
    estimate_time: string;
    lead_time: string;
    due_date: string;
    close_estimate: string;
  };
  calculations: {
    time_variance: number;
    sla_status: string | null;
    utilization_rate: number | null;
    priority_adjustment: string | null;
  };
}

// ✅ เพิ่ม Interface สำหรับ saveSupporter Response
export interface SaveSupporterResponse {
  success: boolean;
  message: string;
  data: {
    ticket: Ticket;
    timeCalculations: TimeCalculations;
    attachments: TicketAttachment[];
  };
}

// ✅ เพิ่ม Interface สำหรับ saveSupporter Request Data
export interface SaveSupporterFormData {
  estimate_time?: number;
  lead_time?: number;
  due_date?: string;
  close_estimate?: string;
  fix_issue_description?: string;
  related_ticket_id?: number;
  status_id?: number; // ✅ เพิ่ม status_id สำคัญมาก!
  user_id?: number;

  // ✅ เพิ่มบรรทัดนี้ก่อน user_id หรือหลัง status_id
  priority?: number;
}

// ✅ เพิ่ม Interface สำหรับ Priority DDL Response
export interface PriorityDDLItem {
  id: number;
  name: string;
}

export interface PriorityDDLResponse {
  success: boolean;
  message: string;
  data: PriorityDDLItem[];
}

// ✅ เพิ่ม Interface สำหรับ Supporter Role Checking
export interface SupporterPermissions {
  canSaveSupporter: boolean;
  canEditTimeFields: boolean;
  canUploadAttachments: boolean;
  canChangeStatus: boolean;
}

// ✅ เพิ่ม Enum สำหรับ Action Types
export enum SupporterActionType {
  COMPLETE = 'COMPLETE',
  PENDING = 'PENDING', 
  OPEN_TICKET = 'OPEN_TICKET',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CANCEL = 'CANCEL'
}

// ✅ เพิ่ม Interface สำหรับ Action Dropdown Option
export interface ActionDropdownOption {
  value: SupporterActionType;
  label: string;
  statusId: number;
  disabled?: boolean;
  description?: string;
}

// ✅ ENHANCED: Status Mapping และ Utilities

/**
 * ✅ Status ID Constants - ตรงกับ Backend Database
 */
export const TICKET_STATUS_IDS = {
  CREATED: 1,
  OPEN_TICKET: 2,
  IN_PROGRESS: 3,
  RESOLVED: 4,
  COMPLETED: 5,
  CANCEL: 6
} as const;

// ✅ เพิ่มโค้ดนี้ทันทีหลังจาก TICKET_STATUS_IDS (ประมาณบรรทัด 50-60)
/**
 * ✅ Priority ID Constants
 */
export const TICKET_PRIORITY_IDS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3
} as const;

/**
 * ✅ Priority Name Mapping - ภาษาไทย
 */
export const TICKET_PRIORITY_NAMES_TH = {
  [TICKET_PRIORITY_IDS.LOW]: 'ต่ำ',
  [TICKET_PRIORITY_IDS.MEDIUM]: 'กลาง',
  [TICKET_PRIORITY_IDS.HIGH]: 'สูง'
} as const;

/**
 * ✅ Priority Name Mapping - ภาษาอังกฤษ
 */
export const TICKET_PRIORITY_NAMES_EN = {
  [TICKET_PRIORITY_IDS.LOW]: 'Low',
  [TICKET_PRIORITY_IDS.MEDIUM]: 'Medium',
  [TICKET_PRIORITY_IDS.HIGH]: 'High'
} as const;

/**
 * ✅ Status Name Mapping - ภาษาไทย
 */
export const TICKET_STATUS_NAMES_TH = {
  [TICKET_STATUS_IDS.CREATED]: 'เปิดคำร้อง',
  [TICKET_STATUS_IDS.OPEN_TICKET]: 'Open Ticket',
  [TICKET_STATUS_IDS.IN_PROGRESS]: 'กำลังดำเนินการ',
  [TICKET_STATUS_IDS.RESOLVED]: 'แก้ไขแล้ว',
  [TICKET_STATUS_IDS.COMPLETED]: 'ดำเนินการเสร็จสิ้น',
  [TICKET_STATUS_IDS.CANCEL]: 'ยกเลิก'
} as const;

/**
 * ✅ Status Name Mapping - ภาษาอังกฤษ
 */
export const TICKET_STATUS_NAMES_EN = {
  [TICKET_STATUS_IDS.CREATED]: 'Created',
  [TICKET_STATUS_IDS.OPEN_TICKET]: 'Open Ticket',
  [TICKET_STATUS_IDS.IN_PROGRESS]: 'In Progress',
  [TICKET_STATUS_IDS.RESOLVED]: 'Resolved',
  [TICKET_STATUS_IDS.COMPLETED]: 'Completed',
  [TICKET_STATUS_IDS.CANCEL]: 'Cancel'
} as const;

/**
 * ✅ Action Type to Status ID Mapping
 */
export const ACTION_TO_STATUS_MAPPING = {
  [SupporterActionType.PENDING]: TICKET_STATUS_IDS.CREATED,
  [SupporterActionType.OPEN_TICKET]: TICKET_STATUS_IDS.OPEN_TICKET,
  [SupporterActionType.IN_PROGRESS]: TICKET_STATUS_IDS.IN_PROGRESS,
  [SupporterActionType.RESOLVED]: TICKET_STATUS_IDS.RESOLVED,
  [SupporterActionType.COMPLETE]: TICKET_STATUS_IDS.COMPLETED,
  [SupporterActionType.CANCEL]: TICKET_STATUS_IDS.CANCEL
} as const;

/**
 * ✅ Status ID to Action Type Mapping
 */
export const STATUS_TO_ACTION_MAPPING = {
  [TICKET_STATUS_IDS.CREATED]: SupporterActionType.PENDING,
  [TICKET_STATUS_IDS.OPEN_TICKET]: SupporterActionType.OPEN_TICKET,
  [TICKET_STATUS_IDS.IN_PROGRESS]: SupporterActionType.IN_PROGRESS,
  [TICKET_STATUS_IDS.RESOLVED]: SupporterActionType.RESOLVED,
  [TICKET_STATUS_IDS.COMPLETED]: SupporterActionType.COMPLETE,
  [TICKET_STATUS_IDS.CANCEL]: SupporterActionType.CANCEL
} as const;

// ✅ ENHANCED: Utility Functions

/**
 * แปลง Action Type เป็น Status ID
 */
export function actionTypeToStatusId(actionType: SupporterActionType): number {
  return ACTION_TO_STATUS_MAPPING[actionType] || TICKET_STATUS_IDS.CREATED;
}

/**
 * แปลง Status ID เป็น Action Type
 */
export function statusIdToActionType(statusId: number): SupporterActionType {
  return STATUS_TO_ACTION_MAPPING[statusId as keyof typeof STATUS_TO_ACTION_MAPPING] || SupporterActionType.PENDING;
}

/**
 * ได้รับชื่อ Status ตาม Language
 */
export function getStatusName(statusId: number, language: 'th' | 'en' = 'th'): string {
  const nameMapping = language === 'th' ? TICKET_STATUS_NAMES_TH : TICKET_STATUS_NAMES_EN;
  return nameMapping[statusId as keyof typeof nameMapping] || `Status ${statusId}`;
}

/**
 * ตรวจสอบว่า Status ID ถูกต้องหรือไม่
 */
export function isValidStatusId(statusId: number): boolean {
  return Object.values(TICKET_STATUS_IDS).includes(statusId as any);
}

/**
 * ได้รับ CSS class สำหรับ Status Badge
 */
export function getStatusBadgeClass(statusId: number): string {
  switch (statusId) {
    case TICKET_STATUS_IDS.CREATED:
      return 'badge-pending';
    case TICKET_STATUS_IDS.OPEN_TICKET:
      return 'badge-in-progress';
    case TICKET_STATUS_IDS.IN_PROGRESS:
      return 'badge-hold';
    case TICKET_STATUS_IDS.RESOLVED:
      return 'badge-resolved';
    case TICKET_STATUS_IDS.COMPLETED:
      return 'badge-complete';
    case TICKET_STATUS_IDS.CANCEL:
      return 'badge-cancel';
    default:
      return 'badge-pending';
  }
}

/**
 * ได้รับ Icon สำหรับ Status
 */
export function getStatusIcon(statusId: number): string {
  switch (statusId) {
    case TICKET_STATUS_IDS.CREATED:
      return 'bi-plus-circle';
    case TICKET_STATUS_IDS.OPEN_TICKET:
      return 'bi-clock';
    case TICKET_STATUS_IDS.IN_PROGRESS:
      return 'bi-play-circle';
    case TICKET_STATUS_IDS.RESOLVED:
      return 'bi-clipboard-check';
    case TICKET_STATUS_IDS.COMPLETED:
      return 'bi-check-circle';
    case TICKET_STATUS_IDS.CANCEL:
      return 'bi-x-circle';
    default:
      return 'bi-clock';
  }
}

// ✅ เพิ่มโค้ดนี้ทันทีหลัง getStatusIcon function
/**
 * ✅ ได้รับชื่อ Priority ตาม Language
 */
export function getPriorityName(priorityId: number, language: 'th' | 'en' = 'th'): string {
  const nameMapping = language === 'th' ? TICKET_PRIORITY_NAMES_TH : TICKET_PRIORITY_NAMES_EN;
  return nameMapping[priorityId as keyof typeof nameMapping] || `Priority ${priorityId}`;
}

/**
 * ✅ ตรวจสอบว่า Priority ID ถูกต้องหรือไม่
 */
export function isValidPriorityId(priorityId: number): boolean {
  return Object.values(TICKET_PRIORITY_IDS).includes(priorityId as any);
}

/**
 * ✅ ได้รับ CSS class สำหรับ Priority Badge
 */
export function getPriorityBadgeClass(priorityId: number): string {
  switch (priorityId) {
    case TICKET_PRIORITY_IDS.LOW:
      return 'badge-priority-low';
    case TICKET_PRIORITY_IDS.MEDIUM:
      return 'badge-priority-medium';
    case TICKET_PRIORITY_IDS.HIGH:
      return 'badge-priority-high';
    default:
      return 'badge-secondary';
  }
}

/**
 * ✅ ได้รับ Icon สำหรับ Priority
 */
export function getPriorityIcon(priorityId: number): string {
  switch (priorityId) {
    case TICKET_PRIORITY_IDS.LOW:
      return 'bi-arrow-down-circle';
    case TICKET_PRIORITY_IDS.MEDIUM:
      return 'bi-dash-circle';
    case TICKET_PRIORITY_IDS.HIGH:
      return 'bi-arrow-up-circle';
    default:
      return 'bi-circle';
  }
}

/**
 * ✅ ตรวจสอบว่าสามารถเปลี่ยนจาก status หนึ่งไปยังอีก status ได้หรือไม่
 * (รองรับ role-based restrictions)
 */
export function canChangeStatus(fromStatusId: number, toStatusId: number): boolean {
  const completedOrInProgress = [TICKET_STATUS_IDS.COMPLETED, TICKET_STATUS_IDS.IN_PROGRESS] as number[];
  switch (fromStatusId) {
    case TICKET_STATUS_IDS.COMPLETED:
    case TICKET_STATUS_IDS.CANCEL:
      return false; 
    case TICKET_STATUS_IDS.RESOLVED:
      return [TICKET_STATUS_IDS.COMPLETED, TICKET_STATUS_IDS.IN_PROGRESS].map(Number).includes(toStatusId);
    default:
      return toStatusId !== fromStatusId;
  }
}

/**
 * ✅ NEW: ตรวจสอบว่า User สามารถแก้ไข/ลบ ticket ตาม role และ status
 * @param statusId - Status ID ของ ticket (ยอมรับ any number เพื่อความยืดหยุ่น)
 * @param userRole - Role ของ user
 * @returns boolean - สามารถแก้ไขได้หรือไม่
 */
export function canUserEditTicket(statusId: number, userRole: 'user' | 'admin' | 'supporter'): boolean {
  // Convert to number explicitly to handle different number types
  const status = Number(statusId);
  
  switch (userRole) {
    case 'user':
      // User: แก้ไขได้เฉพาะ Created (1)
      return status === TICKET_STATUS_IDS.CREATED;
    
    case 'admin':
      // Admin: แก้ไขได้เฉพาะ Created (1) และ Open Ticket (2)
      return status === TICKET_STATUS_IDS.CREATED || status === TICKET_STATUS_IDS.OPEN_TICKET;
    
    case 'supporter':
      // Supporter: แก้ไขได้ทุก status ยกเว้น Completed (5) และ Cancel (6)
      return status !== TICKET_STATUS_IDS.COMPLETED && status !== TICKET_STATUS_IDS.CANCEL;
    
    default:
      return false;
  }
}

/**
 * ✅ NEW: ตรวจสอบว่า User สามารถลบ ticket ตาม role และ status
 * @param statusId - Status ID ของ ticket (ยอมรับ any number เพื่อความยืดหยุ่น)
 * @param userRole - Role ของ user
 * @returns boolean - สามารถลบได้หรือไม่
 */
export function canUserDeleteTicket(statusId: number, userRole: 'user' | 'admin' | 'supporter'): boolean {
  // ใช้ logic เดียวกันกับ canUserEditTicket
  return canUserEditTicket(statusId, userRole);
}

/**
 * ✅ NEW: ได้รับข้อความอธิบายข้อจำกัดการแก้ไขตาม role
 */
export function getEditRestrictionMessage(userRole: 'user' | 'admin' | 'supporter'): string {
  switch (userRole) {
    case 'user':
      return 'User สามารถแก้ไขได้เฉพาะในสถานะ "Created" เท่านั้น';
    case 'admin':
      return 'Admin สามารถแก้ไขได้จนถึงสถานะ "Open Ticket" (ก่อน In Progress)';
    case 'supporter':
      return 'Supporter แก้ไขได้ทุกสถานะ ยกเว้น "Completed" และ "Cancel"';
    default:
      return 'ไม่สามารถแก้ไขได้';
  }
}

/**
 * ✅ NEW: ได้รับข้อความอธิบายข้อจำกัดการลบตาม role
 */
export function getDeleteRestrictionMessage(userRole: 'user' | 'admin' | 'supporter'): string {
  switch (userRole) {
    case 'user':
      return 'User สามารถลบได้เฉพาะในสถานะ "Created" เท่านั้น';
    case 'admin':
      return 'Admin สามารถลบได้จนถึงสถานะ "Open Ticket" (ก่อน In Progress)';
    case 'supporter':
      return 'Supporter ลบได้ทุกสถานะ ยกเว้น "Completed" และ "Cancel"';
    default:
      return 'ไม่สามารถลบได้';
  }
}

/**
 * ✅ NEW: ได้รับรายการ status ที่สามารถแก้ไข/ลบได้ตาม role
 */
export function getEditableStatusIds(userRole: 'user' | 'admin' | 'supporter'): number[] {
  switch (userRole) {
    case 'user':
      return [TICKET_STATUS_IDS.CREATED];
    case 'admin':
      return [TICKET_STATUS_IDS.CREATED, TICKET_STATUS_IDS.OPEN_TICKET];
    case 'supporter':
      return [
        TICKET_STATUS_IDS.CREATED,
        TICKET_STATUS_IDS.OPEN_TICKET,
        TICKET_STATUS_IDS.IN_PROGRESS,
        TICKET_STATUS_IDS.RESOLVED
      ];
    default:
      return [];
  }
}

/**
 * ได้รับรายการ Actions ที่สามารถทำได้สำหรับ Status ปัจจุบัน
 */
export function getAvailableActions(currentStatusId: number): ActionDropdownOption[] {
  const allActions: ActionDropdownOption[] = [
    {
      value: SupporterActionType.OPEN_TICKET,
      label: 'Open Ticket',
      statusId: TICKET_STATUS_IDS.OPEN_TICKET,
      description: 'เปิดให้ดำเนินการ'
    },
    {
      value: SupporterActionType.IN_PROGRESS,
      label: 'In Progress', 
      statusId: TICKET_STATUS_IDS.IN_PROGRESS,
      description: 'กำลังดำเนินการ'
    },
    {
      value: SupporterActionType.RESOLVED,
      label: 'Resolved',
      statusId: TICKET_STATUS_IDS.RESOLVED,
      description: 'แก้ไขเสร็จแล้ว'
    },
    {
      value: SupporterActionType.COMPLETE,
      label: 'Complete',
      statusId: TICKET_STATUS_IDS.COMPLETED,
      description: 'เสร็จสิ้นสมบูรณ์'
    },
    {
      value: SupporterActionType.CANCEL,
      label: 'Cancel',
      statusId: TICKET_STATUS_IDS.CANCEL,
      description: 'ยกเลิก'
    }
  ];

  // กรองเฉพาะ actions ที่สามารถทำได้
  return allActions.filter(action => 
    canChangeStatus(currentStatusId, action.statusId)
  );
}

/**
 * ✅ UPDATED: Interface สำหรับ Enhanced Ticket ที่มี role-aware computed properties
 */
export interface EnhancedTicket extends Ticket {
  // Computed properties
  statusName: string;
  statusBadgeClass: string;
  statusIcon: string;
  canEdit: boolean;
  canDelete: boolean;
  canEvaluate: boolean;
  availableActions: ActionDropdownOption[];

  // ✅ เพิ่มบรรทัดเหล่านี้หลัง availableActions
  priorityName?: string;
  priorityBadgeClass?: string;
  priorityIcon?: string;

  // ✅ NEW: Role-aware properties
  editRestrictionMessage?: string;
  deleteRestrictionMessage?: string;
  editableByCurrentRole?: boolean;
  deletableByCurrentRole?: boolean;
}

/**
 * ✅ UPDATED: แปลง Ticket ธรรมดาเป็น EnhancedTicket (with role awareness)
 */
export function enhanceTicket(
  ticket: Ticket, 
  language: 'th' | 'en' = 'th',
  userRole?: 'user' | 'admin' | 'supporter'
): EnhancedTicket {
  const completedOrCancelled = [TICKET_STATUS_IDS.COMPLETED, TICKET_STATUS_IDS.CANCEL] as number[];
  
  // ✅ Calculate role-aware edit/delete permissions
  const editableByRole = userRole ? canUserEditTicket(ticket.status_id, userRole) : false;
  const deletableByRole = userRole ? canUserDeleteTicket(ticket.status_id, userRole) : false;
  
  return {
    ...ticket,
    statusName: getStatusName(ticket.status_id, language),
    statusBadgeClass: getStatusBadgeClass(ticket.status_id),
    statusIcon: getStatusIcon(ticket.status_id),

    // ✅ เพิ่มบรรทัดเหล่านี้หลัง statusIcon
    priorityName: ticket.priority_id ? getPriorityName(ticket.priority_id, language) : undefined,
    priorityBadgeClass: ticket.priority_id ? getPriorityBadgeClass(ticket.priority_id) : undefined,
    priorityIcon: ticket.priority_id ? getPriorityIcon(ticket.priority_id) : undefined,
    
    // ✅ Default permissions (without role context)
    canEdit: !completedOrCancelled.includes(ticket.status_id),
    canDelete: !completedOrCancelled.includes(ticket.status_id),
    canEvaluate: ticket.status_id === TICKET_STATUS_IDS.COMPLETED,
    availableActions: getAvailableActions(ticket.status_id),
    // ✅ NEW: Role-aware properties
    editableByCurrentRole: editableByRole,
    deletableByCurrentRole: deletableByRole,
    editRestrictionMessage: userRole ? getEditRestrictionMessage(userRole) : undefined,
    deleteRestrictionMessage: userRole ? getDeleteRestrictionMessage(userRole) : undefined
  };
}

/**
 * ✅ NEW: ตรวจสอบว่า status transition ถูกต้องตาม role หรือไม่
 */
export function isValidStatusTransitionForRole(
  fromStatusId: number,
  toStatusId: number,
  userRole: 'user' | 'admin' | 'supporter'
): boolean {
  // ตรวจสอบว่าสามารถเปลี่ยน status พื้นฐานได้หรือไม่
  if (!canChangeStatus(fromStatusId, toStatusId)) {
    return false;
  }

  // ✅ Role-specific transition rules
  switch (userRole) {
    case 'user':
      // User ไม่สามารถเปลี่ยน status ได้เลย (เฉพาะ supporter/admin)
      return false;
    
    case 'admin':
    case 'supporter':
      // Admin และ Supporter สามารถเปลี่ยน status ได้ตามกฎพื้นฐาน
      return true;
    
    default:
      return false;
  }
}

/**
 * ✅ NEW: ได้รับข้อความ error สำหรับ invalid status transition
 */
export function getStatusTransitionErrorMessage(
  fromStatusId: number,
  toStatusId: number,
  userRole: 'user' | 'admin' | 'supporter'
): string {
  const fromStatus = getStatusName(fromStatusId, 'th');
  const toStatus = getStatusName(toStatusId, 'th');

  if (userRole === 'user') {
    return `User ไม่สามารถเปลี่ยนสถานะได้ กรุณาติดต่อ Admin หรือ Supporter`;
  }

  if (!canChangeStatus(fromStatusId, toStatusId)) {
    if (fromStatusId === TICKET_STATUS_IDS.COMPLETED) {
      return `ไม่สามารถเปลี่ยนสถานะจาก "${fromStatus}" ได้ เนื่องจาก ticket เสร็จสิ้นแล้ว`;
    }
    if (fromStatusId === TICKET_STATUS_IDS.CANCEL) {
      return `ไม่สามารถเปลี่ยนสถานะจาก "${fromStatus}" ได้ เนื่องจาก ticket ถูกยกเลิกแล้ว`;
    }
    return `ไม่สามารถเปลี่ยนจาก "${fromStatus}" ไปยัง "${toStatus}" ได้`;
  }

  return `การเปลี่ยนสถานะไม่ถูกต้อง`;
}

// ✅ Export Type สำหรับ User Role
export type UserRoleType = 'user' | 'admin' | 'supporter';

// ✅ Export Type สำหรับ Status ID
export type TicketStatusId = typeof TICKET_STATUS_IDS[keyof typeof TICKET_STATUS_IDS];

// ✅ Export ทั้งหมด
export {
  TICKET_STATUS_IDS as StatusIds,
  TICKET_STATUS_NAMES_TH as StatusNamesTh,
  TICKET_STATUS_NAMES_EN as StatusNamesEn
};