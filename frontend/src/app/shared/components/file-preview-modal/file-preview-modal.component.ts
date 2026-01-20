// file-preview-modal.component.ts
import { Component, Input, Output, EventEmitter, inject, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FileService, FileInfo } from '../../services/file.service';

@Component({
  selector: 'app-file-preview-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './file-preview-modal.component.html',
  styleUrls: ['./file-preview-modal.component.css']
})
export class FilePreviewModalComponent implements OnInit, OnChanges {
  private sanitizer = inject(DomSanitizer);
  private fileService = inject(FileService);

  @Input() show = false;
  @Input() attachment: any = null;
  @Output() close = new EventEmitter<void>();
  @Output() download = new EventEmitter<any>();

  viewerType: 'google' | 'office' = 'google';
  
  // ✅ เพิ่ม: เก็บข้อมูลไฟล์ที่ตรวจสอบแล้ว
  detectedFileInfo: FileInfo | null = null;
  isDetecting = false;

  ngOnInit() {
    console.log('🔍 File Preview Modal initialized');
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes['show'] && this.show && this.attachment) {
      console.log('📄 Modal opened with attachment:', this.attachment);
      
      // ✅ ตรวจสอบประเภทไฟล์จาก API
      await this.detectFileType();
    }
  }

  /**
   * ✅ ตรวจสอบประเภทไฟล์จาก Content-Type header
   */
  private async detectFileType(): Promise<void> {
    if (!this.attachment?.path) {
      console.error('❌ No path to detect');
      return;
    }

    this.isDetecting = true;

    try {
      // ใช้ FileService เพื่อตรวจสอบประเภทไฟล์
      this.detectedFileInfo = await this.fileService.detectFileType(this.attachment.path);
      
      console.log('✅ File type detected:', this.detectedFileInfo);
      
    } catch (error) {
      console.error('❌ Failed to detect file type:', error);
      
      // Fallback: สมมติว่าเป็นรูปภาพถ้า path มี /images/
      if (this.attachment.path.includes('/images/')) {
        this.detectedFileInfo = {
          type: 'image',
          extension: 'jpg',
          filename: `attachment_${this.attachment.attachment_id}`,
          icon: 'bi-image-fill',
          color: '#FF6B35'
        };
      } else {
        this.detectedFileInfo = {
          type: 'file',
          extension: '',
          filename: `attachment_${this.attachment.attachment_id}`,
          icon: 'bi-file-earmark-fill',
          color: '#6C757D'
        };
      }
    } finally {
      this.isDetecting = false;
    }
  }

  /**
   * ✅ ตรวจสอบว่าเป็นรูปภาพ (จากข้อมูลที่ตรวจสอบแล้ว)
   */
  get isImage(): boolean {
    if (this.isDetecting) return false;
    return this.detectedFileInfo?.type === 'image';
  }

  /**
   * ✅ ตรวจสอบว่าเป็น PDF
   */
  get isPdf(): boolean {
    if (this.isDetecting) return false;
    return this.detectedFileInfo?.type === 'pdf';
  }

  /**
   * ✅ ตรวจสอบว่าเป็น Document
   */
  get isDocument(): boolean {
    if (this.isDetecting) return false;
    const type = this.detectedFileInfo?.type;
    return type === 'word' || type === 'excel';
  }

  /**
   * ✅ ตรวจสอบว่าสามารถ preview ได้
   */
  get isViewable(): boolean {
    return this.isImage || this.isPdf || this.isDocument;
  }

  /**
   * ✅ ตรวจสอบว่าต้องใช้ viewer
   */
  get needsViewer(): boolean {
    return this.isPdf || this.isDocument;
  }

  get fileIcon(): string {
    if (this.isDetecting) return 'bi-hourglass-split';
    return this.detectedFileInfo?.icon || 'bi-file-earmark-fill';
  }

  get fileType(): string {
    if (this.isDetecting) return 'Detecting...';
    if (!this.detectedFileInfo) return 'File';
    
    const typeMap: { [key: string]: string } = {
      'image': 'Image',
      'pdf': 'PDF Document',
      'word': 'Word Document',
      'excel': 'Excel Spreadsheet',
      'text': 'Text File',
      'archive': 'Compressed Archive',
      'video': 'Video File',
      'audio': 'Audio File',
      'file': 'File'
    };
    
    return typeMap[this.detectedFileInfo.type] || 'File';
  }

  /**
   * ✅ Google Docs Viewer URL
   */
  getGoogleDocsViewerUrl(): SafeResourceUrl {
    if (!this.attachment?.path) {
      return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    }
    
    const encodedUrl = encodeURIComponent(this.attachment.path);
    const viewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
    
    console.log('🌐 Google Docs Viewer URL:', viewerUrl);
    return this.sanitizer.bypassSecurityTrustResourceUrl(viewerUrl);
  }

  /**
   * ✅ Office Web Viewer URL
   */
  getOfficeWebViewerUrl(): SafeResourceUrl {
    if (!this.attachment?.path) {
      return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    }
    
    const encodedUrl = encodeURIComponent(this.attachment.path);
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
    
    console.log('🌐 Office Web Viewer URL:', viewerUrl);
    return this.sanitizer.bypassSecurityTrustResourceUrl(viewerUrl);
  }

  /**
   * ✅ PDF Viewer URL
   */
  getPdfViewerUrl(): SafeResourceUrl {
    if (!this.attachment?.path) {
      return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    }
    
    const pdfUrl = `${this.attachment.path}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
    
    console.log('📕 PDF Viewer URL:', pdfUrl);
    return this.sanitizer.bypassSecurityTrustResourceUrl(pdfUrl);
  }

  switchViewer(type: 'google' | 'office'): void {
    this.viewerType = type;
    console.log('🔄 Switched viewer to:', type);
  }

  onClose(): void {
    this.detectedFileInfo = null; // Reset
    this.close.emit();
  }

  onDownload(): void {
    if (this.attachment) {
      this.download.emit(this.attachment);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.onClose();
    }
  }

  onImageError(event: Event): void {
    console.error('❌ Image failed to load');
  }

  onIframeLoad(): void {
    console.log('✅ Iframe loaded');
  }

  onIframeError(): void {
    console.error('❌ Iframe failed');
  }
}