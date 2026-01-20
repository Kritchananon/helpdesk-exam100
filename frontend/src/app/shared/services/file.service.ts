// shared/services/file.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface FileInfo {
  type: 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file';
  extension: string;
  filename: string;
  isLoading?: boolean;
  icon: string;
  color: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileService {

  constructor(private http: HttpClient) { } // ✅ เพิ่ม HttpClient

  /**
   * ✅ เพิ่มใหม่: ตรวจสอบประเภทไฟล์จาก Content-Type
   */
  async detectFileType(url: string): Promise<FileInfo> {
    console.log('🔍 Detecting file type for:', url);

    try {
      // ใช้ HEAD request เพื่อดึง headers อย่างเดียว (ไม่ดาวน์โหลดไฟล์)
      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors'
      });

      const contentType = response.headers.get('content-type') || '';
      const contentDisposition = response.headers.get('content-disposition') || '';

      console.log('📄 Content-Type:', contentType);
      console.log('📎 Content-Disposition:', contentDisposition);

      // ดึง filename จาก content-disposition ถ้ามี
      let filename = this.extractFilenameFromContentDisposition(contentDisposition);

      // ถ้าไม่มี ใช้ ID จาก URL
      if (!filename) {
        const urlParts = url.split('/');
        const id = urlParts[urlParts.length - 1];
        filename = `attachment_${id}`;
      }

      // แปลง Content-Type เป็น FileInfo
      return this.contentTypeToFileInfo(contentType, filename);

    } catch (error) {
      console.error('❌ Error detecting file type:', error);

      // Fallback: สมมติว่าเป็นรูปภาพถ้า URL มี /images/
      if (url.includes('/images/')) {
        return {
          type: 'image',
          extension: 'jpg',
          filename: 'image',
          icon: 'bi-image-fill',
          color: '#FF6B35'
        };
      }

      return {
        type: 'file',
        extension: '',
        filename: 'unknown',
        icon: 'bi-file-earmark-fill',
        color: '#6C757D'
      };
    }
  }

  /**
   * ✅ ดึง filename จาก Content-Disposition header
   */
  private extractFilenameFromContentDisposition(disposition: string): string {
    if (!disposition) return '';

    // ตัวอย่าง: attachment; filename="document.pdf"
    const matches = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (matches && matches[1]) {
      return matches[1].replace(/['"]/g, '');
    }

    return '';
  }

  /**
   * ✅ แปลง Content-Type เป็น FileInfo
   */
  private contentTypeToFileInfo(contentType: string, filename: string): FileInfo {
    const lowerType = contentType.toLowerCase();

    // Image types
    if (lowerType.includes('image/')) {
      return {
        type: 'image',
        extension: this.mimeTypeToExtension(contentType),
        filename,
        icon: 'bi-image-fill',
        color: '#FF6B35'
      };
    }

    // PDF
    if (lowerType.includes('pdf')) {
      return {
        type: 'pdf',
        extension: 'pdf',
        filename,
        icon: 'bi-file-earmark-pdf-fill',
        color: '#DC3545'
      };
    }

    // Excel
    if (lowerType.includes('spreadsheet') ||
      lowerType.includes('excel') ||
      lowerType.includes('vnd.ms-excel')) {
      return {
        type: 'excel',
        extension: 'xlsx',
        filename,
        icon: 'bi-file-earmark-excel-fill',
        color: '#28A745'
      };
    }

    // Word
    if (lowerType.includes('word') ||
      lowerType.includes('document') ||
      lowerType.includes('msword')) {
      return {
        type: 'word',
        extension: 'docx',
        filename,
        icon: 'bi-file-earmark-word-fill',
        color: '#2B5CE6'
      };
    }

    // Text
    if (lowerType.includes('text/')) {
      return {
        type: 'text',
        extension: 'txt',
        filename,
        icon: 'bi-file-earmark-text-fill',
        color: '#6C757D'
      };
    }

    // Archive
    if (lowerType.includes('zip') ||
      lowerType.includes('rar') ||
      lowerType.includes('compress')) {
      return {
        type: 'archive',
        extension: 'zip',
        filename,
        icon: 'bi-file-earmark-zip-fill',
        color: '#FFC107'
      };
    }

    // Video
    if (lowerType.includes('video/')) {
      return {
        type: 'video',
        extension: 'mp4',
        filename,
        icon: 'bi-file-earmark-play-fill',
        color: '#E91E63'
      };
    }

    // Audio
    if (lowerType.includes('audio/')) {
      return {
        type: 'audio',
        extension: 'mp3',
        filename,
        icon: 'bi-file-earmark-music-fill',
        color: '#9C27B0'
      };
    }

    // Default
    return {
      type: 'file',
      extension: '',
      filename,
      icon: 'bi-file-earmark-fill',
      color: '#6C757D'
    };
  }

  /**
   * ✅ แปลง MIME type เป็น extension
   */
  private mimeTypeToExtension(mimeType: string): string {
    const map: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'application/pdf': 'pdf',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'text/plain': 'txt',
      'application/zip': 'zip',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3'
    };

    return map[mimeType.toLowerCase()] || '';
  }

  /**
 * ✅ ปรับปรุง: ตรวจสอบว่าเป็นรูปภาพจริงหรือไม่
 */
isImageFile(path: string): boolean {
  if (!path) return false;
  
  // ถ้าเป็น data URL
  if (path.startsWith('data:image/')) return true;

  // ✅ เช็คจาก extension เท่านั้น - อย่าสมมติจาก path
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico'];
  const hasImageExtension = imageExtensions.some(ext => path.toLowerCase().endsWith(ext));
  
  // ✅ ลบการเช็คจาก /images/ เพราะอาจเป็น API endpoint ที่ส่งไฟล์อื่น
  return hasImageExtension;
}

/**
 * ✅ เพิ่มใหม่: ตรวจสอบว่าเป็น PDF หรือไม่
 */
isPdfFile(path: string, filename?: string): boolean {
  if (!path && !filename) return false;
  
  const pathLower = (path || '').toLowerCase();
  const filenameLower = (filename || '').toLowerCase();
  
  return pathLower.endsWith('.pdf') || 
         pathLower.includes('.pdf') || 
         filenameLower.endsWith('.pdf');
}

/**
 * ✅ เพิ่มใหม่: ตรวจสอบว่าเป็น Document (Word, Excel, PowerPoint) หรือไม่
 */
isDocumentFile(path: string, filename?: string): boolean {
  if (!path && !filename) return false;
  
  const pathLower = (path || '').toLowerCase();
  const filenameLower = (filename || '').toLowerCase();
  
  const docExtensions = [
    '.doc', '.docx',    // Word
    '.xls', '.xlsx',    // Excel
    '.ppt', '.pptx'     // PowerPoint
  ];
  
  return docExtensions.some(ext => 
    pathLower.endsWith(ext) || filenameLower.endsWith(ext)
  );
}

  /**
   * ✅ ดึง icon ตามประเภทไฟล์
   */
  getFileIcon(path: string, fileType?: string): string {
    // ถ้ามี fileType ให้ใช้ก่อน
    if (fileType) {
      switch (fileType.toLowerCase()) {
        case 'image': return 'bi-image-fill';
        case 'pdf': return 'bi-file-earmark-pdf-fill';
        case 'excel': return 'bi-file-earmark-excel-fill';
        case 'word': return 'bi-file-earmark-word-fill';
        case 'text': return 'bi-file-earmark-text-fill';
        case 'archive': return 'bi-file-earmark-zip-fill';
        case 'video': return 'bi-file-earmark-play-fill';
        case 'audio': return 'bi-file-earmark-music-fill';
      }
    }

    // ถ้าไม่มี extension และเป็น API endpoint
    if (path.includes('/api/') || path.includes('/images/')) {
      // ✅ ใช้ icon default สำหรับ API endpoint
      return 'bi-file-earmark-image'; // สมมติว่าเป็นรูปภาพ
    }

    // ใช้ extension ถ้ามี
    const extension = this.getFileExtension(path).toLowerCase();
    if (!extension) {
      return 'bi-file-earmark-fill'; // default icon
    }

    switch (extension) {
      case 'pdf': return 'bi-file-earmark-pdf-fill';
      case 'doc':
      case 'docx': return 'bi-file-earmark-word-fill';
      case 'xls':
      case 'xlsx':
      case 'csv': return 'bi-file-earmark-excel-fill';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'svg': return 'bi-image-fill';
      case 'txt':
      case 'log':
      case 'md':
      case 'json':
      case 'xml': return 'bi-file-earmark-text-fill';
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz': return 'bi-file-earmark-zip-fill';
      case 'mp4':
      case 'avi':
      case 'mkv':
      case 'mov':
      case 'wmv': return 'bi-file-earmark-play-fill';
      case 'mp3':
      case 'wav':
      case 'aac':
      case 'flac': return 'bi-file-earmark-music-fill';
      default: return 'bi-file-earmark-fill';
    }
  }

  /**
 * ✅ เพิ่ม: กำหนดประเภทไฟล์จาก extension
 */
  determineFileCategoryByExtension(extension: string): FileInfo['type'] {
    if (!extension) return 'file';

    const ext = extension.toLowerCase();

    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'].includes(ext)) {
      return 'image';
    }

    // PDF
    if (ext === 'pdf') {
      return 'pdf';
    }

    // Excel
    if (['xls', 'xlsx', 'csv'].includes(ext)) {
      return 'excel';
    }

    // Word
    if (['doc', 'docx', 'rtf'].includes(ext)) {
      return 'word';
    }

    // Text
    if (['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) {
      return 'text';
    }

    // Archive
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return 'archive';
    }

    // Video
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
      return 'video';
    }

    // Audio
    if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) {
      return 'audio';
    }

    // Default
    return 'file';
  }

  /**
   * ✅ เพิ่ม: กำหนดประเภทไฟล์จาก file type string และ filename
   */
  determineFileCategory(fileType: string, filename: string): FileInfo['type'] {
    const type = fileType.toLowerCase();
    const ext = this.getFileExtension(filename).toLowerCase();

    // ลองจาก type ก่อน
    if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff'].includes(ext)) {
      return 'image';
    }

    if (type.includes('pdf') || ext === 'pdf') {
      return 'pdf';
    }

    if (type.includes('excel') || type.includes('spreadsheet') || ['xls', 'xlsx', 'csv'].includes(ext)) {
      return 'excel';
    }

    if (type.includes('word') || type.includes('document') || ['doc', 'docx', 'rtf'].includes(ext)) {
      return 'word';
    }

    if (type.includes('text') || ['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)) {
      return 'text';
    }

    if (type.includes('archive') || type.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return 'archive';
    }

    if (type.includes('video') || ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
      return 'video';
    }

    if (type.includes('audio') || ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a'].includes(ext)) {
      return 'audio';
    }

    return 'file';
  }

  /**
   * ✅ ดึงชื่อไฟล์จาก path
   */
  getDisplayFileName(path: string): string {
    if (!path) return 'unknown';
    if (path.startsWith('data:')) return 'data_file';

    // ✅ เพิ่ม: ถ้าเป็น URL endpoint (ไม่มี extension)
    if (path.includes('/api/') || path.includes('/images/')) {
      // ดึง ID จาก path
      const parts = path.split('/');
      const id = parts[parts.length - 1];
      return `attachment_${id}`;
    }

    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    return lastPart.split('?')[0] || 'unknown';
  }

  /**
   * ✅ ดึง extension จากชื่อไฟล์
   */
  getFileExtension(filename: string): string {
    if (!filename || filename === 'unknown') return '';

    // ✅ ถ้าเป็น attachment_123 (ไม่มี extension)
    if (filename.startsWith('attachment_')) {
      return ''; // return empty string
    }

    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  /**
   * ✅ เพิ่ม: ตรวจสอบว่าเป็นรูปภาพจากการเรียก API
   */
  async checkIfImageFromUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentType = response.headers.get('content-type');
      return contentType ? contentType.startsWith('image/') : false;
    } catch (error) {
      console.error('Error checking file type:', error);
      return false;
    }
  }

  /**
   * ✅ แปลงขนาดไฟล์เป็น human-readable
   */
  getFileSize(bytes: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  /**
   * ✅ ดาวน์โหลดไฟล์
   */
  downloadFile(path: string, filename: string): void {
    if (path.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = path;
      link.download = filename || 'download';
      link.click();
    } else {
      window.open(path, '_blank');
    }
  }

  /**
 * ✅ เพิ่ม: ดึงสีตาม file type
 */
  getColorByType(type: FileInfo['type']): string {
    const colorMap: { [key: string]: string } = {
      'image': '#FF6B35',
      'pdf': '#DC3545',
      'excel': '#28A745',
      'word': '#2B5CE6',
      'text': '#6C757D',
      'archive': '#FFC107',
      'video': '#E91E63',
      'audio': '#9C27B0',
      'file': '#6C757D'
    };

    return colorMap[type] || '#6C757D';
  }

  /**
   * ✅ เพิ่ม: ดึงสีตาม extension
   */
  getColorByExtension(extension: string): string {
    const ext = extension.toLowerCase();

    const colorMap: { [key: string]: string } = {
      // Images
      'jpg': '#FF6B35',
      'jpeg': '#FF6B35',
      'png': '#FF6B35',
      'gif': '#FF6B35',
      'webp': '#FF6B35',
      'svg': '#FF6B35',
      // PDF
      'pdf': '#DC3545',
      // Office - Word
      'doc': '#2B5CE6',
      'docx': '#2B5CE6',
      'rtf': '#2B5CE6',
      // Office - Excel
      'xls': '#28A745',
      'xlsx': '#28A745',
      'csv': '#28A745',
      // Text
      'txt': '#6C757D',
      'log': '#6C757D',
      'md': '#6C757D',
      'json': '#6C757D',
      'xml': '#6C757D',
      // Archive
      'zip': '#FFC107',
      'rar': '#FFC107',
      '7z': '#FFC107',
      'tar': '#FFC107',
      'gz': '#FFC107',
      // Video
      'mp4': '#E91E63',
      'avi': '#E91E63',
      'mkv': '#E91E63',
      'mov': '#E91E63',
      // Audio
      'mp3': '#9C27B0',
      'wav': '#9C27B0',
      'aac': '#9C27B0',
      'flac': '#9C27B0'
    };

    return colorMap[ext] || '#6C757D';
  }

  /**
 * ✅ ดึงข้อมูลไฟล์ทั้งหมด
 */
  getFileInfo(attachment: any): FileInfo {
    const filename = attachment.filename || this.getDisplayFileName(attachment.path);
    const extension = this.getFileExtension(filename);
    const type = this.determineFileCategoryByExtension(extension);
    const icon = this.getFileIcon(attachment.path, attachment.file_type);
    const color = this.getColorByType(type); // ✅ เพิ่มบรรทัดนี้

    return {
      type,
      extension,
      filename,
      isLoading: false,
      icon,
      color // ✅ เพิ่มบรรทัดนี้
    };
  }
}