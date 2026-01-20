import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TicketService } from '../../../../shared/services/ticket.service';
import { FileListComponent } from '../../../../shared/components/file-list/file-list.component';
import { FilePreviewModalComponent } from '../../../../shared/components/file-preview-modal/file-preview-modal.component';

// ✅ เพิ่มบรรทัดนี้ - import TicketData จาก ticket-detail component
import { TicketData } from '../ticket-detail.component';

@Component({
  selector: 'app-support-information-display',
  standalone: true,
  imports: [
    CommonModule,
    FileListComponent,
    FilePreviewModalComponent
  ],
  templateUrl: './support-information-display.component.html',
  styleUrls: ['./support-information-display.component.css']
})
export class SupportInformationDisplayComponent implements OnChanges {
  estimateTime: number = 0;
  leadTime: number = 0;
  assignToName: string = '-';

  // ✅ Properties สำหรับ File Preview Modal
  selectedAttachment: any = null;
  showFileModal = false;

  constructor(private ticketService: TicketService) { }

  @Input() ticketData: TicketData | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ticketData'] && this.ticketData) {
      this.updateDisplayData();
    }
  }

  updateDisplayData(): void {
    if (this.ticketData?.ticket) {
      const closeEstimateDate = this.ticketData.ticket.close_estimate ?
        new Date(this.ticketData.ticket.close_estimate) : new Date();
      const dueDateDate = this.ticketData.ticket.due_date ?
        new Date(this.ticketData.ticket.due_date) : new Date();

      this.estimateTime = this.ticketService.calculateEstimateTime(closeEstimateDate);
      this.leadTime = this.ticketService.calculateLeadTime(dueDateDate);
    }

    if (this.ticketData?.assign && this.ticketData.assign.length > 0) {
      this.assignToName = this.ticketData.assign[0].assignTo;
    } else {
      this.assignToName = '-';
    }
  }

  // ===== DATE FORMATTING METHODS =====
  
  formatDate(dateString: string | null | undefined): string {
    if (!dateString || dateString.trim() === '') return '';
    try {
      return new Date(dateString).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }

  formatDateTime(dateString: string | null | undefined): string {
    if (!dateString || dateString.trim() === '') return '';
    try {
      return new Date(dateString).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error('Error formatting datetime:', error);
      return '';
    }
  }

  // ===== ATTACHMENT METHODS =====
  
  hasFixAttachments(): boolean {
    return !!(this.ticketData?.fix_attachment &&
      this.ticketData.fix_attachment.length > 0);
  }

  // ✅ File Preview Modal Methods
  onAttachmentClick(attachment: any): void {
    console.log('🔎 Preview file:', attachment);
    this.selectedAttachment = attachment;
    this.showFileModal = true;
    document.body.classList.add('modal-open');
  }

  closeModal(): void {
    this.showFileModal = false;
    this.selectedAttachment = null;
    document.body.classList.remove('modal-open');
  }
}