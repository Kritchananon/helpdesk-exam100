// src/app/shared/models/notification.model.ts

/**
 * ✅ Notification Model (UPDATED FOR NEW BACKEND API)
 * สำหรับจัดการข้อมูล notification ในระบบ
 * รองรับ Backend response format จาก GET /api/notifications/list
 */

// ===== ENUMS ===== ✅

/**
 * ประเภทของ notification ตาม backend
 */
export enum NotificationType {
  NEW_TICKET = 'NEW_TICKET',
  STATUS_CHANGE = 'STATUS_CHANGE',
  ASSIGNMENT = 'ASSIGNMENT',
  COMMENT = 'COMMENT',
  MENTION = 'MENTION',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED'
}

/**
 * สถานะของ notification
 */
export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived'
}

/**
 * ระดับความสำคัญของ notification
 */
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// ===== BACKEND INTERFACES ===== ✅

/**
 * ✅ NEW: Backend Notification Response Structure
 * รูปแบบที่ได้จาก Backend API
 */
export interface BackendNotification {
  id: number;
  title: string;
  message: string;
  ticket_no: string;
  notification_type: string; // 'status_change', 'new_ticket', etc.
  is_read: boolean;
  create_date: string; // ISO date string
  read_at: string | null;
  type_label: string;
  type_color: string;
  type_icon: string;
  time_ago: string;
  ticket: {
    id: number;
    ticket_no: string;
    status_id: number;
  };
  status?: {
    id: number;
    name: string;
  };
}

/**
 * ✅ NEW: Backend List Response
 * Response จาก GET /api/notifications/list
 */
export interface BackendNotificationListResponse {
  success: boolean;
  data: {
    notifications: BackendNotification[];
    summary: {
      total: number;
      unread_count: number;
    };
  };
}

/**
 * ✅ NEW: Backend Unread Count Response
 * Response จาก GET /api/unread-count (หากมี)
 */
export interface BackendUnreadCountResponse {
  success: boolean;
  data: {
    unread_count: number;
    user_id: number;
  };
  message?: string;
}

/**
 * ✅ Payload สำหรับส่งไปยัง backend API /api/notify-changes
 * ใช้เมื่อต้องการแจ้งเตือนการเปลี่ยนแปลง ticket
 */
export interface NotificationPayload {
  ticket_no: string;
  statusId?: number;
  assignedUserId?: number;
  isNewTicket?: boolean;
}

// ===== FRONTEND INTERFACES ===== ✅

/**
 * ข้อมูล notification สำหรับใช้งานใน Frontend
 * (แปลงมาจาก BackendNotification)
 */
export interface AppNotification {
  id: number;
  ticket_no: string;
  notification_type: NotificationType | string;
  title: string;
  message: string;
  status: NotificationStatus | string;
  priority: NotificationPriority;
  created_at: string;
  read_at?: string | null;
  user_id?: number;
  status_id?: number;
  related_user_id?: number;
  metadata?: NotificationMetadata;
}

/**
 * ข้อมูลเพิ่มเติมของ notification
 */
export interface NotificationMetadata {
  ticket_id?: number;
  old_status?: number;
  new_status?: number;
  assigned_by?: number;
  assigned_to?: number;
  comment_id?: number;
  mentioned_by?: number;
  email_sent?: boolean;
  email_sent_at?: string | null;
  type_label?: string;
  type_color?: string;
  type_icon?: string;
  [key: string]: any;
}

/**
 * Response จาก backend API (legacy format for compatibility)
 */
export interface NotificationResponse {
  success: boolean;
  message: string;
  data: AppNotification[];
  summary?: {
    total_notifications: number;
    new_ticket: number;
    status_change: number;
    assignment: number;
  };
}

/**
 * ข้อมูลสรุปการแจ้งเตือน
 */
export interface NotificationSummary {
  total: number;
  unread: number;
  today: number;
  high_priority: number;
  by_type: {
    [key: string]: number;
  };
}

/**
 * ตัวเลือกสำหรับดึงรายการ notification
 */
export interface NotificationQueryOptions {
  status?: NotificationStatus | string;
  type?: NotificationType | string;
  limit?: number;
  offset?: number;
  sort?: 'asc' | 'desc';
  priority?: NotificationPriority;
}

/**
 * ตัวเลือกสำหรับ notification settings
 */
export interface NotificationSettings {
  email_enabled: boolean;
  push_enabled: boolean;
  sound_enabled: boolean;
  types: {
    [key: string]: boolean;
  };
  priority_filter: NotificationPriority[];
}

/**
 * Display notification สำหรับแสดงใน UI
 */
export interface DisplayNotification extends AppNotification {
  timeAgo: string;
  icon: string;
  color: string;
  route?: string;
}

// ===== TRANSFORMATION FUNCTIONS ===== ✅

/**
 * ✅ NEW: แปลง Backend notification เป็น Frontend AppNotification
 */
export function transformBackendToApp(backend: BackendNotification): AppNotification {
  // แปลง notification_type จาก snake_case เป็น UPPER_CASE
  const normalizedType = normalizeNotificationType(backend.notification_type);
  
  return {
    id: backend.id,
    ticket_no: backend.ticket_no,
    notification_type: normalizedType,
    title: backend.title,
    message: backend.message,
    
    // แปลง is_read เป็น status
    status: backend.is_read ? NotificationStatus.READ : NotificationStatus.UNREAD,
    
    priority: NotificationPriority.MEDIUM, // Backend ไม่มี priority, ใช้ค่า default
    
    // แปลง create_date เป็น created_at
    created_at: backend.create_date,
    read_at: backend.read_at,
    
    // เพิ่ม ticket info
    status_id: backend.ticket?.status_id,
    
    // เพิ่ม metadata จาก Backend
    metadata: {
      ticket_id: backend.ticket?.id,
      type_label: backend.type_label,
      type_color: backend.type_color,
      type_icon: backend.type_icon,
      old_status: backend.status?.id,
      new_status: backend.ticket?.status_id
    }
  };
}

/**
 * ✅ NEW: แปลง notification_type จาก Backend format เป็น Frontend format
 * Backend: 'status_change', 'new_ticket'
 * Frontend: 'STATUS_CHANGE', 'NEW_TICKET'
 */
function normalizeNotificationType(type: string): string {
  const typeMap: { [key: string]: string } = {
    'status_change': 'STATUS_CHANGE',
    'new_ticket': 'NEW_TICKET',
    'assignment': 'ASSIGNMENT',
    'comment': 'COMMENT',
    'mention': 'MENTION',
    'resolved': 'RESOLVED',
    'closed': 'CLOSED'
  };
  
  return typeMap[type.toLowerCase()] || type.toUpperCase();
}

/**
 * ✅ NEW: แปลง Backend summary เป็น Frontend NotificationSummary
 */
export function transformBackendSummary(
  backendSummary: { total: number; unread_count: number },
  notifications: AppNotification[]
): NotificationSummary {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // นับ notifications วันนี้
  const todayNotifications = notifications.filter(n => {
    try {
      return n && n.created_at && new Date(n.created_at) >= today;
    } catch {
      return false;
    }
  });

  // นับ high priority
  const highPriorityNotifications = notifications.filter(n =>
    n && (
      n.priority === NotificationPriority.HIGH || 
      n.priority === NotificationPriority.URGENT
    )
  );

  // สร้าง by_type จาก notifications
  const byType: { [key: string]: number } = {};
  notifications.forEach(n => {
    const type = n.notification_type.toString();
    byType[type] = (byType[type] || 0) + 1;
  });

  return {
    total: backendSummary.total,
    unread: backendSummary.unread_count,
    today: todayNotifications.length,
    high_priority: highPriorityNotifications.length,
    by_type: byType
  };
}

// ===== HELPER FUNCTIONS ===== ✅

/**
 * แปลง NotificationType เป็นข้อความแสดง
 */
export function getNotificationTypeLabel(type: NotificationType | string, language: 'th' | 'en' = 'th'): string {
  const labels: { [key: string]: { th: string; en: string } } = {
    'NEW_TICKET': { th: 'Ticket ใหม่', en: 'New Ticket' },
    'new_ticket': { th: 'Ticket ใหม่', en: 'New Ticket' },
    'STATUS_CHANGE': { th: 'เปลี่ยนสถานะ', en: 'Status Changed' },
    'status_change': { th: 'เปลี่ยนสถานะ', en: 'Status Changed' },
    'ASSIGNMENT': { th: 'มอบหมายงาน', en: 'Assignment' },
    'assignment': { th: 'มอบหมายงาน', en: 'Assignment' },
    'COMMENT': { th: 'ความคิดเห็น', en: 'Comment' },
    'comment': { th: 'ความคิดเห็น', en: 'Comment' },
    'MENTION': { th: 'แท็กคุณ', en: 'Mentioned' },
    'mention': { th: 'แท็กคุณ', en: 'Mentioned' },
    'RESOLVED': { th: 'แก้ไขแล้ว', en: 'Resolved' },
    'resolved': { th: 'แก้ไขแล้ว', en: 'Resolved' },
    'CLOSED': { th: 'ปิดแล้ว', en: 'Closed' },
    'closed': { th: 'ปิดแล้ว', en: 'Closed' }
  };

  return labels[type]?.[language] || labels['NEW_TICKET'][language];
}

/**
 * แปลง NotificationPriority เป็นข้อความแสดง
 */
export function getNotificationPriorityLabel(priority: NotificationPriority, language: 'th' | 'en' = 'th'): string {
  const labels: { [key in NotificationPriority]: { th: string; en: string } } = {
    [NotificationPriority.LOW]: { th: 'ต่ำ', en: 'Low' },
    [NotificationPriority.MEDIUM]: { th: 'ปานกลาง', en: 'Medium' },
    [NotificationPriority.HIGH]: { th: 'สูง', en: 'High' },
    [NotificationPriority.URGENT]: { th: 'เร่งด่วน', en: 'Urgent' }
  };

  return labels[priority][language];
}

/**
 * ได้รับสีตาม NotificationType
 */
export function getNotificationTypeColor(type: NotificationType | string): string {
  const colors: { [key: string]: string } = {
    'NEW_TICKET': '#6c5ce7',
    'new_ticket': '#6c5ce7',
    'STATUS_CHANGE': '#74b9ff',
    'status_change': '#74b9ff',
    'ASSIGNMENT': '#fdcb6e',
    'assignment': '#fdcb6e',
    'COMMENT': '#00b894',
    'comment': '#00b894',
    'MENTION': '#e17055',
    'mention': '#e17055',
    'RESOLVED': '#00b894',
    'resolved': '#00b894',
    'CLOSED': '#636e72',
    'closed': '#636e72'
  };

  return colors[type] || '#6c5ce7';
}

/**
 * ได้รับ icon class ตาม NotificationType
 */
export function getNotificationTypeIcon(type: NotificationType | string): string {
  const icons: { [key: string]: string } = {
    'NEW_TICKET': 'bi-plus-circle-fill',
    'new_ticket': 'bi-plus-circle-fill',
    'STATUS_CHANGE': 'bi-arrow-repeat',
    'status_change': 'bi-arrow-repeat',
    'ASSIGNMENT': 'bi-person-check-fill',
    'assignment': 'bi-person-check-fill',
    'COMMENT': 'bi-chat-dots-fill',
    'comment': 'bi-chat-dots-fill',
    'MENTION': 'bi-at',
    'mention': 'bi-at',
    'RESOLVED': 'bi-check-circle-fill',
    'resolved': 'bi-check-circle-fill',
    'CLOSED': 'bi-x-circle-fill',
    'closed': 'bi-x-circle-fill'
  };

  return icons[type] || 'bi-plus-circle-fill';
}

/**
 * ได้รับสีตาม NotificationPriority
 */
export function getNotificationPriorityColor(priority: NotificationPriority): string {
  const colors: { [key in NotificationPriority]: string } = {
    [NotificationPriority.LOW]: '#00b894',
    [NotificationPriority.MEDIUM]: '#74b9ff',
    [NotificationPriority.HIGH]: '#fdcb6e',
    [NotificationPriority.URGENT]: '#e17055'
  };

  return colors[priority];
}

/**
 * ตรวจสอบว่า notification เป็นแบบเร่งด่วนหรือไม่
 */
export function isUrgentNotification(notification: AppNotification): boolean {
  return notification.priority === NotificationPriority.URGENT;
}

/**
 * ตรวจสอบว่า notification ยังไม่ได้อ่านหรือไม่
 */
export function isUnreadNotification(notification: AppNotification): boolean {
  return notification.status === NotificationStatus.UNREAD || notification.status === 'unread';
}

/**
 * สร้าง DisplayNotification จาก Notification
 */
export function createDisplayNotification(notification: AppNotification): DisplayNotification {
  return {
    ...notification,
    timeAgo: formatTimeAgo(notification.created_at),
    icon: getNotificationTypeIcon(notification.notification_type),
    color: getNotificationTypeColor(notification.notification_type),
    route: `/tickets/${notification.ticket_no}`
  };
}

/**
 * แปลงเวลาเป็นรูปแบบ "time ago"
 */
export function formatTimeAgo(dateString: string, language: 'th' | 'en' = 'th'): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  const labels = {
    th: {
      year: ['ปีที่แล้ว', 'ปีที่แล้ว'],
      month: ['เดือนที่แล้ว', 'เดือนที่แล้ว'],
      week: ['สัปดาห์ที่แล้ว', 'สัปดาห์ที่แล้ว'],
      day: ['วันที่แล้ว', 'วันที่แล้ว'],
      hour: ['ชั่วโมงที่แล้ว', 'ชั่วโมงที่แล้ว'],
      minute: ['นาทีที่แล้ว', 'นาทีที่แล้ว'],
      just_now: 'เมื่อสักครู่'
    },
    en: {
      year: ['year ago', 'years ago'],
      month: ['month ago', 'months ago'],
      week: ['week ago', 'weeks ago'],
      day: ['day ago', 'days ago'],
      hour: ['hour ago', 'hours ago'],
      minute: ['minute ago', 'minutes ago'],
      just_now: 'Just now'
    }
  };

  if (seconds < 60) {
    return labels[language].just_now;
  }

  for (const [key, value] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / value);
    if (interval >= 1) {
      const label = labels[language][key as keyof typeof labels['th']];
      if (Array.isArray(label)) {
        return `${interval} ${label[interval === 1 ? 0 : 1]}`;
      }
      return label;
    }
  }

  return labels[language].just_now;
}

/**
 * Default notification settings
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_enabled: true,
  push_enabled: true,
  sound_enabled: true,
  types: {
    'NEW_TICKET': true,
    'new_ticket': true,
    'STATUS_CHANGE': true,
    'status_change': true,
    'ASSIGNMENT': true,
    'assignment': true,
    'COMMENT': true,
    'comment': true,
    'MENTION': true,
    'mention': true,
    'RESOLVED': true,
    'resolved': true,
    'CLOSED': true,
    'closed': true
  },
  priority_filter: [
    NotificationPriority.LOW,
    NotificationPriority.MEDIUM,
    NotificationPriority.HIGH,
    NotificationPriority.URGENT
  ]
};