// file-list.component.ts
import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileService, FileInfo } from '../../services/file.service';

interface AttachmentWithInfo {
  attachment: any;
  fileInfo: FileInfo | null;
  isLoading: boolean;
}

@Component({
  selector: 'app-file-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-list.component.html',
  styleUrls: ['./file-list.component.css']
})
export class FileListComponent implements OnInit {
  private fileService = inject(FileService);

  @Input() attachments: any[] = [];
  @Input() title = 'Attachments';
  @Input() showTitle = true;

  // ✅ เพิ่ม Input นี้เพื่อควบคุมการแสดงปุ่มลบ
  @Input() allowDelete = true;  // default เป็น true เพื่อไม่ทำลาย behavior เดิม
  
  @Output() fileClick = new EventEmitter<any>();
  @Output() fileDelete = new EventEmitter<any>();

  // ✅ เก็บข้อมูลไฟล์ที่ตรวจสอบแล้ว
  attachmentsWithInfo: AttachmentWithInfo[] = [];

  async ngOnInit() {
    console.log('📎 FileListComponent initialized');
    console.log('Attachments:', this.attachments);

    // ✅ ตรวจสอบประเภทไฟล์ทั้งหมด
    await this.detectAllFileTypes();
  }

  async ngOnChanges() {
    console.log('🔄 ngOnChanges triggered:', this.attachments);

    if (!this.attachments || this.attachments.length === 0) {
      console.log('⚪ ไม่มีไฟล์เหลือ เคลียร์ list ทั้งหมด');
      this.attachmentsWithInfo = []; // ✅ เคลียร์ list
      return;
    }

    await this.detectAllFileTypes();
  }

  /**
   * ✅ ตรวจสอบประเภทไฟล์ทั้งหมด
   */
  private async detectAllFileTypes(): Promise<void> {
    if (!this.attachments || this.attachments.length === 0) {
      this.attachmentsWithInfo = [];
      return;
    }

    console.log('🔍 Detecting file types for all attachments...');

    // สร้าง array พร้อม loading state
    this.attachmentsWithInfo = this.attachments.map(att => ({
      attachment: att,
      fileInfo: null,
      isLoading: true
    }));

    // ตรวจสอบทีละไฟล์
    for (let i = 0; i < this.attachments.length; i++) {
      const attachment = this.attachments[i];

      try {
        const fileInfo = await this.fileService.detectFileType(attachment.path);

        this.attachmentsWithInfo[i] = {
          attachment,
          fileInfo,
          isLoading: false
        };

        console.log(`✅ File ${i + 1}:`, fileInfo);

      } catch (error) {
        console.error(`❌ Error detecting file ${i + 1}:`, error);

        this.attachmentsWithInfo[i] = {
          attachment,
          fileInfo: {
            type: 'file',
            extension: '',
            filename: `attachment_${attachment.attachment_id}`,
            icon: 'bi-file-earmark-fill',
            color: '#6C757D'
          },
          isLoading: false
        };
      }
    }

    console.log('✅ All file types detected:', this.attachmentsWithInfo);
  }

  get hasAttachments(): boolean {
    return this.attachmentsWithInfo && this.attachmentsWithInfo.length > 0;
  }

  isImage(item: AttachmentWithInfo): boolean {
    if (item.isLoading) return false;
    return item.fileInfo?.type === 'image';
  }

  getFileUrl(file: any): string {
    return file.path ? file.path : URL.createObjectURL(file);
  }

  getFileIcon(item: AttachmentWithInfo): string {
    if (item.isLoading) return 'bi-hourglass-split';
    return item.fileInfo?.icon || 'bi-file-earmark-fill';
  }

  getIconColor(item: AttachmentWithInfo): string {
    if (item.isLoading) return '#6C757D';
    return item.fileInfo?.color || '#6C757D';
  }

  getFileName(item: AttachmentWithInfo): string {
    if (item.isLoading) return 'Loading...';
    return item.fileInfo?.filename || `attachment_${item.attachment.attachment_id}`;
  }

  getFileExtension(item: AttachmentWithInfo): string {
    if (item.isLoading) return '...';
    const ext = item.fileInfo?.extension || '';
    return ext ? ext.toUpperCase() : 'FILE';
  }

  getFileSize(item: AttachmentWithInfo): string {
    const size = item.attachment.file_size;
    if (!size) return '';
    return this.fileService.getFileSize(size);
  }

  onFileClick(item: AttachmentWithInfo): void {
    console.log('File clicked:', item);
    this.fileClick.emit(item.attachment);
  }

  onDeleteClick(item: any, event: MouseEvent): void {
    event.stopPropagation(); // ป้องกันไม่ให้เปิด preview

    // 🧩 ตรวจว่าเป็น object ซ้อนหรือไม่
    const emittedFile = item.attachment || item;

    console.log('🗑️ Emit ลบไฟล์:', emittedFile);

    // ✅ ส่งเฉพาะ object ที่มี attachment_id/id ออกไป
    this.fileDelete.emit(emittedFile);
  }

  onImageError(event: Event, item: AttachmentWithInfo): void {
    console.error('❌ Image load error:', event);
    console.log('Failed for:', item);
  }

  onImageLoad(event: Event): void {
    console.log('✅ Image loaded:', event);
  }
}