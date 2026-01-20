// =================================================================================================
// ส่วนที่ 1: การเตรียมเครื่องมือ (Imports)
// =================================================================================================

// นำเข้าเครื่องมือพื้นฐานที่จำเป็นในการสร้างหน้าเว็บนี้
import { Component, OnInit, OnDestroy, inject, ViewEncapsulation, HostListener, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common'; // เครื่องมือช่วยแสดงผล (เช่น ถ้ามีข้อมูลให้โชว์, ถ้าไม่มีให้ซ่อน)
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms'; // เครื่องมือสร้างแบบฟอร์มให้กรอกข้อมูล
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router'; // เครื่องมือสำหรับเปลี่ยนหน้าเว็บ หรือดูว่าตอนนี้อยู่หน้าไหน

// นำเข้าบริการ (Service) ที่เปรียบเหมือน "คนเดินเอกสาร" ไปคุยกับระบบหลังบ้าน (Server)
import { ApiService } from '../../../shared/services/api.service'; // คนเดินเรื่องส่งข้อมูลไป Server
import { AuthService } from '../../../shared/services/auth.service'; // คนตรวจบัตรพนักงาน (เช็คว่าใครล็อกอิน)
import { TicketService } from '../../../shared/services/ticket.service'; // ผู้เชี่ยวชาญเรื่อง Ticket โดยเฉพาะ
import { NotificationService } from '../../../shared/services/notification.service'; // คนคอยตะโกนแจ้งเตือนมุมขวาบน
import { LanguageService } from '../../../shared/services/language.service'; // ล่ามแปลภาษา
import { NotificationResponse } from '../../../shared/models/notification.model';

// นำเข้าส่วนประกอบย่อย (Dropdown เลือกโปรเจกต์และหมวดหมู่) มาแปะในหน้านี้
import { ProjectDropdownComponent } from '../../../shared/components/project-dropdown/project-dropdown.component';
import { CategoryDropdownComponent } from '../../../shared/components/category-dropdown/category-dropdown.component';

// เครื่องมือจับจังหวะเวลา (เช่น รอให้คนพิมพ์เสร็จก่อนค่อยบันทึก)
import { debounceTime, distinctUntilChanged, filter } from 'rxjs';
import { Subscription } from 'rxjs';

// =================================================================================================
// ส่วนที่ 2: การตั้งค่าหน้าจอ (Component Setup)
// =================================================================================================

@Component({
  selector: 'app-ticket-create', // ชื่อป้ายกำกับของหน้านี้ (เอาไว้แปะในหน้าเว็บหลัก)
  standalone: true, // บอกว่าเป็นหน้าเว็บที่ทำงานได้ด้วยตัวเอง ไม่ต้องพึ่งคนอื่น
  
  // รายชื่อเครื่องมือที่จะหยิบมาใช้ในหน้าจอนี้
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProjectDropdownComponent,
    CategoryDropdownComponent
  ],
  
  templateUrl: './ticket-create.component.html', // หน้าตาของเว็บ (ไฟล์ HTML) อยู่ที่ไหน
  styleUrls: ['./ticket-create.component.css'], // การตกแต่งสีสัน (ไฟล์ CSS) อยู่ที่ไหน
  
  // ปิดการกั้นห้อง CSS (เพื่อให้การตกแต่งทะลุเข้าไปถึงตัวแก้ไขข้อความที่สร้างขึ้นมาทีหลังได้)
  encapsulation: ViewEncapsulation.None
})

// =================================================================================================
// ส่วนที่ 3: เริ่มต้นการทำงาน (Class Logic)
// เปรียบเหมือน "สมอง" ของหน้าจอนี้
// =================================================================================================
export class TicketCreateComponent implements OnInit, OnDestroy {
  // --- ขอเบิกเครื่องมือมาใช้งาน (Dependency Injection) ---
  private fb = inject(FormBuilder); // ขอเครื่องมือสร้างแบบฟอร์ม
  private apiService = inject(ApiService); // ขอตัวช่วยติดต่อ Server
  private authService = inject(AuthService); // ขอตัวช่วยเช็คข้อมูลคนล็อกอิน
  private router = inject(Router); // ขอตัวช่วยเปลี่ยนหน้า
  private route = inject(ActivatedRoute); // ขอตัวช่วยอ่านข้อมูลจาก URL (เช่น เลข Ticket)
  private ticketService = inject(TicketService); // ขอตัวช่วยจัดการ Ticket
  private notificationService = inject(NotificationService); // ขอตัวช่วยแจ้งเตือน
  private cdr = inject(ChangeDetectorRef); // ขอตัวช่วยสั่งหน้าจอให้อัปเดตทันที
  private languageService = inject(LanguageService); // ขอตัวช่วยแปลภาษา

  // เชื่อมต่อกับปุ่มเลือกโปรเจกต์และหมวดหมู่ที่หน้าจอ เพื่อสั่งงานมันได้
  @ViewChild(ProjectDropdownComponent) projectDropdown!: ProjectDropdownComponent;
  @ViewChild(CategoryDropdownComponent) categoryDropdown!: CategoryDropdownComponent;

  // ฟังก์ชันเอาไว้เช็คว่าตอนนี้เป็นเครื่อง Dev หรือ เครื่องจริง (มักใช้ซ่อนปุ่มทดสอบ)
  get environment() {
    return { production: false };
  }

  // "กล่องเก็บข้อมูลฟอร์ม" ที่ผู้ใช้กรอก (โปรเจกต์, หมวดหมู่, รายละเอียด)
  ticketForm: FormGroup;

  // --- ตัวแปรเก็บสถานะ (State) เพื่อบอกว่าหน้าจอต้องแสดงผลยังไง ---
  isLoading = false;      // กำลังหมุนติ้วๆ รอโหลดข้อมูลอยู่หรือเปล่า?
  isSubmitting = false;   // กำลังกดปุ่มบันทึกอยู่หรือเปล่า? (ถ้าใช่ จะล็อกปุ่มห้ามกดซ้ำ)
  
  // --- เกี่ยวกับไฟล์แนบ ---
  selectedFiles: File[] = []; // ตะกร้าใส่ไฟล์ใหม่ที่ผู้ใช้เลือกมา
  filePreviewUrls: { [key: string]: string } = {}; // เก็บรูปตัวอย่าง (Preview) เอาไว้โชว์ก่อนอัปโหลด
  fileErrors: string[] = []; // เก็บข้อความแจ้งเตือน ถ้าไฟล์มีปัญหา (เช่น ใหญ่เกินไป)

  currentUser: any; // ข้อมูลของคนที่กำลังใช้งานหน้านี้ (ชื่ออะไร, ตำแหน่งอะไร)

  // เก็บค่าโปรเจกต์และหมวดหมู่ที่ถูกเลือก
  selectedProject: any = null;
  selectedCategory: any = null;

  // --- การแจ้งเตือนข้อผิดพลาด ---
  showValidationErrors = false; // สวิตช์เปิด/ปิดตัวหนังสือสีแดง (ถ้ากดบันทึกแล้วกรอกไม่ครบ ให้เปิดเป็น true)
  validationErrors: { [key: string]: boolean } = {}; // สมุดจดว่าช่องไหนกรอกผิดบ้าง

  // --- กล่องข้อความแจ้งเตือน (Popup) ---
  showCustomAlert = false; // สั่งให้โชว์กล่องข้อความเด้งขึ้นมา
  alertMessage = ''; // ข้อความที่จะเขียนในกล่อง
  alertType: 'error' | 'success' = 'error'; // จะให้กล่องเป็นสีแดง (Error) หรือสีเขียว (Success)

  autoNavigationTimer: any = null; // นาฬิกาจับเวลาถอยหลังเพื่อเปลี่ยนหน้าอัตโนมัติ

  // --- โหมดแก้ไขงานเก่า (Edit Mode) ---
  isEditMode = false; // ตอนนี้กำลัง "แก้ไขใบงานเก่า" หรือ "สร้างใบงานใหม่"?
  editTicketNo: string = ''; // เลขที่ใบงานที่กำลังแก้ไข (ดึงมาจาก URL)
  originalTicketData: any = null; // ข้อมูลต้นฉบับ (เอาไว้เทียบว่ามีการแก้ไขอะไรไปบ้างหรือยัง)
  existingAttachments: any[] = []; // ไฟล์แนบของเก่าที่มีอยู่แล้วบนระบบ

  // --- ข้อมูล Ticket ---
  ticketId: number | null = null; // รหัสอ้างอิงใบงานในฐานข้อมูล (User ไม่เห็น)
  ticket_no: string = ''; // เลขที่ใบงานที่โชว์ให้คนเห็น (เช่น TK-001)
  isTicketCreated = false; // ใบงานนี้ถูกสร้างลงระบบแล้วหรือยัง? (ใช้ตอนบันทึกร่างอัตโนมัติ)

  // --- สถานะการอัปโหลดไฟล์ (เอาไว้โชว์หลอดโหลด หรือ เครื่องหมายถูก) ---
  uploadedFileNames: string[] = []; // รายชื่อไฟล์ที่อัปโหลดเสร็จแล้ว
  uploadingFileNames: string[] = []; // รายชื่อไฟล์ที่กำลังวิ่งขึ้น Server
  errorFileNames: string[] = [];     // รายชื่อไฟล์ที่อัปโหลดล้มเหลว
  fileSuccessMessages: string[] = []; // ข้อความ "อัปโหลดเสร็จแล้วจ้า"

  isNavigating = false; // กำลังเปลี่ยนหน้าอยู่ไหม (กันการทำงานซ้ำซ้อน)

  private deletingAttachmentIds: Set<number> = new Set(); // รายชื่อไฟล์ที่กำลังจะถูกลบ (เอาไว้โชว์ว่ากำลังลบนะ)

  // สมุดจดประเภทไฟล์ (เพื่อจะได้เลือกรูปไอคอนมาโชว์ให้ถูก เช่น ไอคอน Word, Excel)
  attachmentTypes: {
    [key: number]: { 
      type: 'image' | 'pdf' | 'excel' | 'word' | 'text' | 'archive' | 'video' | 'audio' | 'file';
      extension: string;
      filename: string;
      isLoading?: boolean; // กำลังเช็คว่าเป็นไฟล์อะไร
      isAnalyzed?: boolean; // เช็คเสร็จแล้ว
    }
  } = {};

  selectedAttachmentIds: Set<number> = new Set(); // รายชื่อไฟล์เก่าที่ User ติ๊กถูกเลือก (เพื่อเตรียมลบทิ้ง)

  private fileUploadTimeoutTimer: any = null; // นาฬิกาจับเวลา ถ้าอัปโหลดนานเกิน 30 วิ ให้ตัดจบ
  private readonly FILE_UPLOAD_TIMEOUT = 30000; // ตั้งเวลาไว้ 30 วินาที

  private isAutoSaving = false; // ป้ายบอกว่า "กำลังบันทึกร่างอัตโนมัติอยู่นะ ห้ามกวน"
  private routerSubscription?: Subscription; // ตัวติดตามการเปลี่ยนหน้าเว็บ

  // ✅ สถานะปุ่มจัดรูปแบบข้อความ (เช่น ตอนนี้ปุ่ม "ตัวหนา" ถูกกดอยู่ไหม)
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

  // =================================================================================================
  // ส่วนที่ 4: เริ่มต้นสร้างฟอร์ม (Constructor)
  // =================================================================================================

  constructor() {
    // กำหนดโครงสร้างแบบฟอร์มว่าต้องมีช่องอะไรบ้าง
    this.ticketForm = this.fb.group({
      projectId: ['', Validators.required], // ช่องโปรเจกต์: ห้ามเว้นว่าง
      categoryId: ['', Validators.required], // ช่องหมวดหมู่: ห้ามเว้นว่าง
      // ช่องรายละเอียด: ห้ามเว้นว่าง และต้องพิมพ์อย่างน้อย 10 ตัวอักษร
      issueDescription: ['', [Validators.required, Validators.minLength(10)]], 
      attachments: [[]] // ช่องไฟล์แนบ
    });
  }

  // =================================================================================================
  // ส่วนที่ 5: เริ่มต้นการทำงานเมื่อเข้าหน้าเว็บ (ngOnInit)
  // =================================================================================================
  ngOnInit(): void {
    // 1. ไปดูว่าใครล็อกอินเข้ามา
    this.currentUser = this.authService.getCurrentUser();
    
    // 2. คอยดูว่าถ้า User กด Back กลับมาหน้านี้ จะให้กู้คืนงานที่ทำค้างไว้ไหม
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd)) // รอจนหน้าเว็บโหลดเสร็จ
      .subscribe((event: any) => {
        if (event.url.includes('/tickets/new')) {
          this.onNavigationBack(); // เรียกฟังก์ชันกู้คืนงานเก่า (Draft)
        }
      });

    // 3. ตรวจสอบว่าเข้ามาเพื่อ "สร้างใหม่" หรือ "แก้ไขของเดิม"
    this.checkEditMode();

    // 4. --- ระบบบันทึกอัตโนมัติ (Auto-Save) ---
    // จับตาดูช่อง "รายละเอียด"
    this.ticketForm.get('issueDescription')?.valueChanges
      .pipe(
        debounceTime(1000), // รอให้หยุดพิมพ์ 1 วินาที (จะได้ไม่บันทึกถี่ยิบ)
        distinctUntilChanged() // ถ้าพิมพ์แล้วลบกลับมาเหมือนเดิม ก็ไม่ต้องบันทึก
      )
      .subscribe(value => {
        if (!this.isEditMode) this.onFormCompleted(); // ถ้าไม่ใช่โหมดแก้ไข ให้บันทึกร่าง
      });

    // จับตาดูช่อง "โปรเจกต์" (รอ 0.8 วิ ค่อยบันทึก)
    this.ticketForm.get('projectId')?.valueChanges
      .pipe(debounceTime(800), distinctUntilChanged())
      .subscribe(value => {
        if (!this.isEditMode) this.onFormCompleted();
      });

    // จับตาดูช่อง "หมวดหมู่" (รอ 0.8 วิ ค่อยบันทึก)
    this.ticketForm.get('categoryId')?.valueChanges
      .pipe(debounceTime(800), distinctUntilChanged())
      .subscribe(value => {
        if (!this.isEditMode) this.onFormCompleted();
      });
  }

  // เมื่อปิดหน้าเว็บนี้ หรือเปลี่ยนไปหน้าอื่น
  ngOnDestroy(): void {
    // ล้างข้อมูลรูปภาพที่โหลดค้างไว้ใน Memory เครื่อง (เพื่อไม่ให้เครื่องอืด)
    Object.values(this.filePreviewUrls).forEach(url => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    this.clearAllTimers(); // หยุดนาฬิกาจับเวลาทุกตัว
    this.clearEditData(); // ล้างข้อมูลการแก้ไขชั่วคราว
    if (this.routerSubscription) this.routerSubscription.unsubscribe(); // หยุดการติดตามการเปลี่ยนหน้า
  }

  // ฟังก์ชันแปลภาษา (เช่น เปลี่ยนคำว่า 'File' เป็น 'ไฟล์')
  t(key: string, params?: any): string {
    return this.languageService.translate(key, params);
  }

  // =================================================================================================
  // ส่วนที่ 6: เครื่องมือแก้ไขข้อความแบบ Word (Rich Text Editor)
  // =================================================================================================

  // ตรวจสอบว่าตอนนี้เคอร์เซอร์เมาส์อยู่ที่ตัวหนังสือแบบไหน (ตัวหนา? ตัวเอียง?) เพื่อปรับสีปุ่มเครื่องมือ
  checkToolbarStatus(): void {
    // ถาม Browser ว่า "ตอนนี้ตรงที่พิมพ์อยู่ เป็นตัวหนาไหม?"
    this.toolbarState.bold = document.queryCommandState('bold');
    this.toolbarState.italic = document.queryCommandState('italic');
    this.toolbarState.underline = document.queryCommandState('underline');
    this.toolbarState.insertUnorderedList = document.queryCommandState('insertUnorderedList');
    this.toolbarState.insertOrderedList = document.queryCommandState('insertOrderedList');
    this.toolbarState.justifyLeft = document.queryCommandState('justifyLeft');
    this.toolbarState.justifyCenter = document.queryCommandState('justifyCenter');
    this.toolbarState.justifyRight = document.queryCommandState('justifyRight');
    this.toolbarState.justifyFull = document.queryCommandState('justifyFull');

    // ถ้าไม่ได้จัดหน้าแบบไหนเลย ให้ถือว่าชิดซ้ายเป็นค่าเริ่มต้น
    if (!this.toolbarState.justifyCenter && !this.toolbarState.justifyRight && !this.toolbarState.justifyFull) {
      this.toolbarState.justifyLeft = true;
    }
  }

  // เมื่อมีการคลิกหรือพิมพ์ในกล่องข้อความ ให้เช็คสถานะปุ่มเครื่องมือใหม่
  onEditorEvent(): void {
    this.checkToolbarStatus();
  }

  // สั่งให้ทำตัวหนา ตัวเอียง หรือขีดเส้นใต้ (ตามปุ่มที่กด)
  formatText(command: string): void {
    document.execCommand(command, false); // สั่ง Browser ให้ทำตามคำสั่ง
    this.checkToolbarStatus(); // อัปเดตสีปุ่ม
    this.updateFormContent(); // เอาข้อความที่จัดรูปแบบแล้ว ไปเก็บลงในฟอร์ม
  }

  // สั่งทำรายการ (List) แบบมีจุด หรือ มีตัวเลข
  insertList(ordered: boolean): void {
    const command = ordered ? 'insertOrderedList' : 'insertUnorderedList';
    document.execCommand(command, false);
    this.checkToolbarStatus();
    this.updateFormContent();
  }

  // สั่งแทรกลิงก์เว็บไซต์
  insertLink(): void {
    const url = prompt(this.t('tickets.enterUrl')); // เด้งกล่องถามว่าจะให้ลิ้งก์ไปไหน
    if (url) {
      document.execCommand('createLink', false, url);
      this.checkToolbarStatus();
      this.updateFormContent();
    }
  }

  // เมื่อผู้ใช้เลือกรูปภาพมาแปะในเนื้อหาข้อความ (ไม่ใช่ไฟล์แนบนะ อันนี้แปะในเนื้อเรื่องเลย)
  onRichTextConfigImage(event: any): void {
    const file = event.target.files[0];
    if (file) {
      // เช็คก่อนว่าเป็นรูปจริงไหม
      if (!file.type.startsWith('image/')) {
        alert(this.t('tickets.invalidImageType') || 'Please select an image file.');
        return;
      }

      // แปลงไฟล์รูปเป็นรหัสข้อความยาวๆ (Base64) เพื่อฝังลงไปในเนื้อหา
      const reader = new FileReader();
      reader.onload = (e: any) => {
        document.execCommand('insertImage', false, e.target.result); // แปะรูปลงไป
        this.updateFormContent(); // บันทึกลงฟอร์ม
      };
      reader.readAsDataURL(file); // เริ่มอ่านไฟล์
    }
    event.target.value = ''; // เคลียร์ช่องเลือกไฟล์ (เพื่อให้เลือกรูปเดิมซ้ำได้ถ้าต้องการ)
  }

  // ดึงข้อความ HTML จากกล่องข้อความ ไปใส่ในตัวแปร Form เพื่อเตรียมส่ง Server
  private updateFormContent(): void {
    const richEditor = document.querySelector('.rich-editor') as HTMLElement;
    if (richEditor) {
      // อัปเดตข้อมูลเงียบๆ ไม่ต้องแจ้งเตือนระบบ Auto-save (เพื่อป้องกันการทำงานซ้ำซ้อน)
      this.ticketForm.patchValue({ issueDescription: richEditor.innerHTML }, { emitEvent: false });
    }
  }
  
  // ทำงานทุกครั้งที่ผู้ใช้พิมพ์ข้อความ
  onDescriptionInput(event: Event): void {
    const target = event.target as HTMLElement;
    const content = target.innerHTML;
    this.ticketForm.patchValue({ issueDescription: content });
    this.checkToolbarStatus(); 

    // ถ้าพิมพ์ครบ 10 ตัวอักษรแล้ว ให้เอาตัวหนังสือสีแดงเตือนออก
    if (content && content.trim().length >= 10 && this.validationErrors['issueDescription']) {
      this.validationErrors['issueDescription'] = false;
    }
  }

  // =================================================================================================
  // ส่วนที่ 7: การจัดการไฟล์แนบ (File Management)
  // =================================================================================================

  // เมื่อกดปุ่มย้อนกลับ
  private onNavigationBack(): void {
    if (!this.isEditMode) this.restoreIncompleteTicket(); // ให้พยายามกู้คืนงานที่ทำค้างไว้
  }

  private clearAllTimers(): void {
    if (this.autoNavigationTimer) {
      clearTimeout(this.autoNavigationTimer);
      this.autoNavigationTimer = null;
    }
    if (this.fileUploadTimeoutTimer) {
      clearTimeout(this.fileUploadTimeoutTimer);
      this.fileUploadTimeoutTimer = null;
    }
  }

  // นับจำนวนไฟล์ทั้งหมด (ทั้งเก่าและใหม่)
  getTotalAttachmentCount(): number {
    return (this.existingAttachments?.length || 0) + (this.selectedFiles?.length || 0);
  }

  // นับเฉพาะไฟล์เก่าที่มีอยู่
  getTotalSelectableCount(): number {
    return this.existingAttachments?.length || 0;
  }

  // ถ้ามีไฟล์เก่ามากกว่า 1 ไฟล์ ให้โชว์ปุ่ม "ลบหลายรายการ"
  canShowBulkActions(): boolean {
    return this.getTotalSelectableCount() > 1;
  }

  // ปุ่ม "เลือกทั้งหมด" / "ยกเลิกเลือกทั้งหมด"
  toggleSelectAll(): void {
    if (this.selectedAttachmentCount === this.getTotalSelectableCount()) {
      this.clearAttachmentSelection(); // ถ้าเลือกครบแล้ว ให้ยกเลิกทั้งหมด
    } else {
      this.selectAllAttachments(); // ถ้ายังเลือกไม่ครบ ให้เลือกทั้งหมด
    }
  }

  // ลบไฟล์ที่ติ๊กถูกไว้หลายๆ ไฟล์พร้อมกัน
  removeSelectedItems(): void {
    if (!this.hasSelectedAttachments) return; // ถ้าไม่ได้เลือกอะไรเลย ก็ไม่ต้องทำอะไร
    const selectedIds = Array.from(this.selectedAttachmentIds);
    if (selectedIds.length === 0) return;

    // ถามย้ำเพื่อความชัวร์
    if (!confirm(this.t('tickets.deleteConfirm', { ticketNo: `${selectedIds.length} ${this.t('tickets.tickets')}` }))) {
      return;
    }
    this.removeMultipleExistingAttachments(selectedIds); // สั่งลบ
    this.clearAttachmentSelection(); // เคลียร์การติ๊กถูก
  }

  // แปลงนามสกุลไฟล์ (.jpg, .pdf) เป็นกลุ่มประเภท (image, pdf) เพื่อเอาไปเลือกสีหรือไอคอน
  getFileTypeFromExtension(filename: string): string {
    const extension = this.getFileExtension(filename).toLowerCase();
    // ถ้าเป็นพวกรูปภาพ
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico'].includes(extension)) return 'image';
    if (extension === 'pdf') return 'pdf';
    // ถ้าเป็นพวก Excel
    if (['xls', 'xlsx', 'csv', 'ods'].includes(extension)) return 'excel';
    // ถ้าเป็นพวก Word
    if (['doc', 'docx', 'rtf', 'odt'].includes(extension)) return 'word';
    // ถ้าเป็นพวกไฟล์ข้อความ/โค้ด
    if (['txt', 'log', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(extension)) return 'text';
    // ถ้าเป็นพวกไฟล์บีบอัด (Zip)
    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(extension)) return 'archive';
    // ถ้าเป็นวิดีโอหรือเสียง
    if (['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v'].includes(extension)) return 'video';
    if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma'].includes(extension)) return 'audio';
    return 'file'; // ถ้าไม่รู้จักเลย ให้เป็นไฟล์ทั่วไป
  }

  // เลือกสีป้ายกำกับตามประเภทไฟล์ (เช่น รูปภาพ=สีม่วง, PDF=สีแดง)
  getFileTypeColor(fileType: string): string {
    switch (fileType) {
      case 'image': return '#6f42c1'; // ม่วง
      case 'pdf': return '#dc3545';   // แดง
      case 'excel': return '#198754'; // เขียว
      case 'word': return '#0d6efd';  // น้ำเงิน
      case 'text': return '#6c757d';  // เทา
      case 'archive': return '#ffc107'; // เหลือง
      case 'video': return '#e83e8c'; // ชมพู
      case 'audio': return '#fd7e14'; // ส้ม
      default: return '#6c757d';
    }
  }

  // เช็คสถานะการอัปโหลดไฟล์ (เสร็จแล้ว? กำลังอัป? หรือพัง?)
  getFileUploadStatus(fileName: string): 'uploaded' | 'uploading' | 'error' | 'pending' {
    if (this.isFileUploaded(fileName)) return 'uploaded';
    else if (this.isFileUploading(fileName)) return 'uploading';
    else if (this.isFileError(fileName)) return 'error';
    else return 'pending';
  }

  // เอาสถานะมาแปลงเป็นข้อความให้อ่านรู้เรื่อง
  getUploadStatusMessage(fileName: string): string {
    const status = this.getFileUploadStatus(fileName);
    switch (status) {
      case 'uploaded': return this.t('tickets.fileUploaded'); // "อัปโหลดเสร็จแล้ว"
      case 'uploading': return this.t('tickets.fileUploading'); // "กำลังอัปโหลด..."
      case 'error': return this.t('tickets.fileUploadFailed'); // "ล้มเหลว"
      case 'pending': return this.t('tickets.fileUploadPending'); // "รอคิว"
      default: return this.t('tickets.unknown');
    }
  }

  // =================================================================================================
  // ส่วนที่ 8: การโหลดข้อมูลเก่ามาแก้ไข (Edit Mode)
  // =================================================================================================

  private checkEditMode(): void {
    // ดูที่ URL ว่ามีเลข Ticket ติดมาไหม ถ้ามีแปลว่ากำลังจะแก้ไข
    this.editTicketNo = this.route.snapshot.params['ticket_no'];
    if (this.editTicketNo) {
      this.isEditMode = true;
      this.restoreEditTicketData(); // ไปดึงข้อมูลเก่าจาก Server
    } else {
      this.isEditMode = false;
      this.restoreIncompleteTicket(); // ไปดึงข้อมูลร่างที่บันทึกไว้ในเครื่อง (Draft)
    }
  }

  // ฟังก์ชันดึงข้อมูล Ticket เก่าจาก Server มาแสดง
  private restoreEditTicketData(): void {
    try {
      const currentUserId = this.currentUser?.id || this.currentUser?.user_id;
      if (!currentUserId) {
        this.backToTicketDetail(); // ถ้าไม่รู้ว่าใครล็อกอิน ให้เด้งกลับไปหน้าหลัก
        return;
      }

      this.isLoading = true; // โชว์วงกลมหมุนๆ
      // ส่งคำขอไปที่ Server
      this.apiService.getTicketData({ ticket_no: this.editTicketNo }).subscribe({
        next: (response) => {
          if (response.code === 1 && response.data) {
            const ticketData = response.data.ticket;
            // ตั้งค่าตัวแปรต่างๆ จากข้อมูลที่ได้มา
            this.isEditMode = true;
            this.ticketId = ticketData.id;
            this.ticket_no = ticketData.ticket_no;
            this.isTicketCreated = true;

            // จัดการรายชื่อไฟล์แนบเดิม
            this.existingAttachments = (response.data.issue_attachment || []).map((att: any) => {
              const attachmentId = att.attachment_id;
              // ใส่ข้อมูลหลอกๆ ไว้ก่อนว่ากำลังโหลด (เพราะยังไม่รู้ประเภทไฟล์แน่ชัด)
              this.attachmentTypes[attachmentId] = {
                type: 'file',
                extension: '',
                filename: `Attachment ${attachmentId}`,
                isLoading: true,
                isAnalyzed: false
              };
              return { attachment_id: attachmentId, path: att.path, filename: null, file_type: null, file_size: null };
            });

            // เก็บข้อมูลต้นฉบับไว้เปรียบเทียบ (เผื่อ User แก้แล้วเปลี่ยนใจอยากดูของเดิม)
            this.originalTicketData = {
              userId: currentUserId,
              ticketId: this.ticketId,
              ticket_no: this.ticket_no,
              isEditMode: true,
              formData: {
                projectId: ticketData.project_id,
                categoryId: ticketData.categories_id,
                issueDescription: ticketData.issue_description
              },
              selectedProject: { id: ticketData.project_id, name: ticketData.project_name },
              selectedCategory: { id: ticketData.categories_id, name: ticketData.categories_name },
              existingAttachments: this.existingAttachments
            };

            // เอาข้อมูลไปใส่ในช่องกรอก (Form)
            this.ticketForm.patchValue({
              projectId: ticketData.project_id,
              categoryId: ticketData.categories_id,
              issueDescription: ticketData.issue_description
            });

            // ตั้งค่า Dropdown
            this.selectedProject = this.originalTicketData.selectedProject;
            this.selectedCategory = this.originalTicketData.selectedCategory;

            // รอแป๊บนึงค่อยสั่งให้หน้าจออัปเดตและเริ่มตรวจสอบไฟล์แนบ
            setTimeout(() => {
              this.updateUIFromRestoredData(this.originalTicketData);
              this.addSuccessState(); // เปลี่ยนกรอบฟอร์มเป็นสีเขียว เพื่อบอกว่าโหลดเสร็จแล้ว
              this.analyzeAttachmentsFromUrls(); // เริ่มเช็คว่าไฟล์แนบแต่ละอันเป็นไฟล์อะไร
              this.isLoading = false; // หยุดหมุน
            }, 800);
          } else {
            throw new Error(response.message || 'Failed to load ticket data');
          }
        },
        error: (error) => {
          this.isLoading = false;
          // ถ้าโหลดไม่สำเร็จ ให้แจ้งเตือนและดีดกลับหน้าหลัก
          this.alertMessage = this.t('tickets.loadError') + '\n' + this.t('tickets.tryAgain');
          this.alertType = 'error';
          this.showCustomAlert = true;
          setTimeout(() => { this.backToTicketDetail(); }, 2000);
        }
      });
    } catch (error) {
      this.isLoading = false;
      this.backToTicketDetail();
    }
  }

  // วนลูปเช็คประเภทไฟล์ของไฟล์แนบทุกตัว
  private analyzeAttachmentsFromUrls(): void {
    if (!this.existingAttachments || this.existingAttachments.length === 0) return;
    this.existingAttachments.forEach((attachment) => {
      this.checkFileTypeFromHeaders(attachment.path, attachment.attachment_id);
    });
  }

  // แยกนามสกุลไฟล์จากชื่อไฟล์ (เช่น "job.pdf" -> "pdf")
  private getFileExtension(filename: string): string {
    if (!filename || filename === 'unknown' || typeof filename !== 'string') return '';
    try {
      const cleanName = filename.split('?')[0]; // ตัดส่วนเกินท้ายชื่อไฟล์ออก
      const parts = cleanName.split('.');
      return parts.length > 1 && /^[a-z0-9]{1,10}$/i.test(parts[parts.length - 1]) ? parts[parts.length - 1].toLowerCase() : '';
    } catch { return ''; }
  }

  // วิธีเช็คประเภทไฟล์แบบประหยัดเน็ต (ถามแค่หัวข้อไฟล์ ไม่โหลดไฟล์ทั้งก้อน)
  private checkFileTypeFromHeaders(url: string, attachmentId: number): void {
    if (!url) { this.setFallbackFileType(attachmentId); return; }
    
    // ตั้งเวลาตัดจบถ้าเน็ตช้าเกิน 5 วิ
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch(url, { method: 'HEAD', mode: 'cors', signal: controller.signal, cache: 'no-cache' })
      .then(response => {
        clearTimeout(timeoutId);
        const contentType = response.headers.get('Content-Type'); // ชนิดไฟล์ที่ Server บอก
        const contentDisposition = response.headers.get('Content-Disposition'); // ชื่อไฟล์ที่ Server บอก
        
        // พยายามแกะชื่อไฟล์
        let filename = 'unknown';
        if (contentDisposition) {
          const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match && match[1]) filename = match[1].replace(/['"]/g, '');
        }
        if (filename === 'unknown') filename = this.extractFilenameFromPath(url); // แกะจาก URL แทน
        
        const extension = this.getFileExtension(filename);
        let fileType: any = 'file';

        // แปลงชนิดไฟล์เป็นกลุ่ม (เช่น image, pdf)
        if (contentType) {
          if (contentType.startsWith('image/')) fileType = 'image';
          else if (contentType === 'application/pdf') fileType = 'pdf';
          else if (contentType.includes('excel') || contentType.includes('spreadsheet')) fileType = 'excel';
          else if (contentType.includes('word') || contentType.includes('document')) fileType = 'word';
          else if (contentType.startsWith('text/')) fileType = 'text';
          else if (contentType.includes('zip') || contentType.includes('compressed')) fileType = 'archive';
          else if (contentType.startsWith('video/')) fileType = 'video';
          else if (contentType.startsWith('audio/')) fileType = 'audio';
        } else if (extension) {
          fileType = this.getFileTypeFromExtension(filename);
        }
        
        // บันทึกผลลัพธ์ลงตัวแปร เพื่อให้หน้าจอเอาไปแสดงผล
        this.attachmentTypes[attachmentId] = { type: fileType, extension: extension, filename: filename, isLoading: false, isAnalyzed: true };
        this.cdr.detectChanges(); // สั่งอัปเดตหน้าจอทันที
      })
      .catch(() => {
        // ถ้าเช็คแบบประหยัดไม่ได้ ลองโหลดแบบรูปภาพดู
        clearTimeout(timeoutId);
        this.tryImageLoad(url, attachmentId);
      });
  }

  // ลองโหลดเป็นรูปภาพดู (ถ้าโหลดขึ้นก็แสดงว่าเป็นรูป)
  private tryImageLoad(url: string, attachmentId: number): void {
    const img = new Image();
    const timeoutId = setTimeout(() => {
      img.src = '';
      this.setFallbackFileType(attachmentId, this.extractFilenameFromPath(url)); // ถ้า 3 วิ ไม่มา ตีว่าเป็นไฟล์ทั่วไป
    }, 3000);

    img.onload = () => {
      clearTimeout(timeoutId);
      const filename = this.extractFilenameFromPath(url);
      // โหลดขึ้น = เป็นรูป
      this.attachmentTypes[attachmentId] = { type: 'image', extension: this.getFileExtension(filename), filename: filename, isLoading: false, isAnalyzed: true };
      this.cdr.detectChanges();
    };
    img.onerror = () => {
      clearTimeout(timeoutId);
      // โหลดไม่ขึ้น = ไม่ใช่รูป
      this.setFallbackFileType(attachmentId, this.extractFilenameFromPath(url));
    };
    img.src = url;
  }

  // ตั้งค่าเป็นไฟล์ทั่วไป (ถ้าไม่รู้อะไรเลย)
  private setFallbackFileType(attachmentId: number, filename?: string): void {
    this.attachmentTypes[attachmentId] = { type: 'file', extension: '', filename: filename || `file_${attachmentId}`, isLoading: false, isAnalyzed: true };
    this.cdr.detectChanges();
  }

  // ชื่อหัวข้อหน้าเว็บ
  getPageTitle(): string {
    return this.isEditMode ? this.t('tickets.editTicket') : this.t('tickets.newTicket');
  }

  // ข้อความบนปุ่มกดบันทึก
  getSubmitButtonText(): string {
    if (this.isSubmitting) return this.isEditMode ? this.t('tickets.updatingTicket') : this.t('tickets.creatingTicket');
    return this.isEditMode ? this.t('tickets.updateTicket') : this.t('tickets.createTicket');
  }

  // กลับไปหน้าดูรายละเอียด
  private backToTicketDetail(): void {
    this.router.navigate([this.editTicketNo ? `/tickets/${this.editTicketNo}` : '/tickets']);
  }

  // เช็คว่าเป็นรูปภาพหรือไม่
  isExistingAttachmentImage(attachment: any): boolean {
    return attachment?.attachment_id && this.attachmentTypes[attachment.attachment_id]?.type === 'image';
  }

  // เลือกไอคอนมาแสดง
  getExistingAttachmentIcon(attachment: any): string {
    if (!attachment?.attachment_id) return 'bi-file-earmark-fill';
    const type = this.attachmentTypes[attachment.attachment_id]?.type;
    switch (type) {
      case 'image': return 'bi-image-fill';
      case 'pdf': return 'bi-file-earmark-pdf-fill';
      // ... ไอคอนอื่นๆ
      default: return 'bi-file-earmark-fill';
    }
  }

  // หาชื่อไฟล์จาก Path
  getExistingAttachmentDisplayName(attachment: any): string {
    return this.attachmentTypes[attachment?.attachment_id]?.filename || attachment?.filename || this.extractFilenameFromPath(attachment?.path) || this.t('tickets.unknownFile');
  }

  // ตัดเอาแค่ชื่อไฟล์จากลิงก์ยาวๆ
  private extractFilenameFromPath(path: string): string {
    if (!path || typeof path !== 'string') return 'unknown';
    try {
      if (path.startsWith('data:')) return 'data_file';
      if (path.startsWith('http')) return decodeURIComponent(new URL(path).pathname.split('/').pop() || 'unknown');
      return decodeURIComponent(path.split('/').pop()?.split('?')[0] || 'unknown');
    } catch { return 'unknown'; }
  }

  // รวมข้อมูลไฟล์เพื่อส่งให้หน้าจอ
  getExistingAttachmentFileInfo(attachmentId: number): any {
    const info = this.attachmentTypes[attachmentId];
    return info ? { ...info, icon: this.getExistingAttachmentIcon({ attachment_id: attachmentId }) } : { type: 'unknown', filename: this.t('tickets.unknownFile'), isLoading: false, icon: 'bi-file-earmark-fill' };
  }

  // แปลงขนาดไฟล์จากตัวเลขดิบๆ เป็น KB, MB
  formatExistingAttachmentSize(attachment: any): string {
    return attachment?.file_size ? this.formatFileSize(attachment.file_size) : '';
  }

  // ถ้ารูปโหลดไม่ขึ้น ให้เปลี่ยนเป็นไอคอนไฟล์แทน
  onExistingAttachmentImageError(attachmentId: number): void {
    if (this.attachmentTypes[attachmentId]) { this.attachmentTypes[attachmentId].type = 'file'; this.attachmentTypes[attachmentId].isAnalyzed = true; }
  }

  onExistingAttachmentImageLoad(attachmentId: number): void {
    if (this.attachmentTypes[attachmentId]) { this.attachmentTypes[attachmentId].type = 'image'; this.attachmentTypes[attachmentId].isAnalyzed = true; }
  }

  hasExistingAttachments(): boolean {
    return this.isEditMode && this.existingAttachments && this.existingAttachments.length > 0;
  }

  // เช็คว่าไฟล์นี้กำลังถูกลบอยู่ไหม (เพื่อโชว์วงกลมหมุนๆ ที่ปุ่มลบ)
  isAttachmentDeleting(attachmentId: number): boolean {
    return this.deletingAttachmentIds.has(attachmentId);
  }

  // ลบไฟล์แนบเดิม 1 ไฟล์
  removeExistingAttachment(index: number, attachment?: any): void {
    const item = attachment || this.existingAttachments[index];
    if (!item?.attachment_id) { this.showFileUploadError(this.t('tickets.deleteFileFailed')); return; }
    if (!confirm(this.t('tickets.deleteFileConfirm', { filename: this.getExistingAttachmentDisplayName(item) }))) return;

    this.deletingAttachmentIds.add(item.attachment_id); // จดว่ากำลังลบไฟล์นี้นะ
    this.apiService.deleteAttachment(item.attachment_id).subscribe({
      next: (res) => {
        this.deletingAttachmentIds.delete(item.attachment_id); // ลบเสร็จแล้ว เอาออกจากสมุดจด
        if (res.code === 1 || res.code === 200) {
          this.existingAttachments.splice(index, 1); // ลบออกจากหน้าจอ
          delete this.attachmentTypes[item.attachment_id];
          this.showFileUploadSuccess(this.t('tickets.deleteFileSuccess', { filename: this.getExistingAttachmentDisplayName(item) }));
        } else this.showFileUploadError(res.message || this.t('tickets.deleteFileFailed'));
      },
      error: () => { this.deletingAttachmentIds.delete(item.attachment_id); this.showFileUploadError(this.t('tickets.deleteError')); }
    });
  }

  // ดาวน์โหลดไฟล์
  downloadExistingAttachment(attachment: any): void {
    if (!attachment?.path) { this.showFileUploadError(this.t('tickets.downloadFileFailed')); return; }
    try {
      if (attachment.path.startsWith('data:')) {
        // ถ้าเป็นไฟล์ใน Memory (Base64) สร้างลิงก์หลอกๆ ให้กดโหลด
        const link = document.createElement('a');
        link.href = attachment.path;
        link.download = this.getExistingAttachmentDisplayName(attachment);
        document.body.appendChild(link).click();
        document.body.removeChild(link);
      } else window.open(attachment.path.startsWith('http') ? attachment.path : `${this.apiService['apiUrl']}/${attachment.path}`, '_blank');
    } catch { this.showFileUploadError(this.t('tickets.downloadError')); }
  }

  // จัดการการเลือก Checkbox (ติ๊กถูก)
  toggleAttachmentSelection(attachmentId: number): void {
    this.selectedAttachmentIds.has(attachmentId) ? this.selectedAttachmentIds.delete(attachmentId) : this.selectedAttachmentIds.add(attachmentId);
  }

  isAttachmentSelected(attachmentId: number): boolean {
    return this.selectedAttachmentIds.has(attachmentId);
  }

  selectAllAttachments(): void {
    this.existingAttachments.forEach(att => { if (att.attachment_id) this.selectedAttachmentIds.add(att.attachment_id); });
  }

  clearAttachmentSelection(): void {
    this.selectedAttachmentIds.clear();
  }

  get hasSelectedAttachments(): boolean { return this.selectedAttachmentIds.size > 0; }
  get selectedAttachmentCount(): number { return this.selectedAttachmentIds.size; }

  // ลบไฟล์ทีละหลายๆ ไฟล์
  removeMultipleExistingAttachments(attachmentIds: number[]): void {
    if (attachmentIds.length === 0) return;
    if (!confirm(this.t('tickets.deleteMultipleConfirm', { count: attachmentIds.length }))) return;
    attachmentIds.forEach(id => this.deletingAttachmentIds.add(id));
    
    // ส่งคำขอลบไปที่ Server พร้อมกันทุกไฟล์
    Promise.allSettled(attachmentIds.map(id => this.apiService.deleteAttachment(id).toPromise())).then(results => {
      let success = 0, error = 0;
      results.forEach((res, i) => {
        const id = attachmentIds[i];
        this.deletingAttachmentIds.delete(id);
        if (res.status === 'fulfilled' && res.value?.code === 1) {
          success++;
          const idx = this.existingAttachments.findIndex(att => att.attachment_id === id);
          if (idx > -1) this.existingAttachments.splice(idx, 1);
          delete this.attachmentTypes[id];
        } else error++;
      });
      if (success > 0) this.showFileUploadSuccess(this.t('tickets.deleteMultipleSuccess', { count: success }));
      if (error > 0) this.showFileUploadError(this.t('tickets.deleteMultipleFailed', { count: error }));
    });
  }

  // =================================================================================================
  // ส่วนที่ 9: การกู้คืนงานที่ทำค้างไว้ (Draft Restore)
  // =================================================================================================

  private restoreIncompleteTicket(): void {
    if (this.isEditMode) return;
    try {
      const currentUserId = this.currentUser?.id || this.currentUser?.user_id;
      if (!currentUserId) return;
      
      // ลองค้นหาใน "สมุดทดของ Browser" (LocalStorage)
      const saved = localStorage.getItem(`incompleteTicket_${currentUserId}`);
      if (saved) {
        const data = JSON.parse(saved);
        // ถ้าเป็นของเก่าเกิน 24 ชม. ให้ลบทิ้ง
        if (data.userId !== currentUserId || (new Date().getTime() - data.timestamp) / 36e5 > 24) {
          localStorage.removeItem(`incompleteTicket_${currentUserId}`);
          return;
        }
        
        // เอาข้อมูลกลับคืนมา
        this.ticketId = data.ticketId;
        this.ticket_no = data.ticket_no;
        this.isTicketCreated = data.isTicketCreated;
        this.ticketForm.patchValue({
          projectId: data.formData.projectId,
          categoryId: data.formData.categoryId,
          issueDescription: data.formData.issueDescription
        });
        this.selectedProject = data.selectedProject;
        this.selectedCategory = data.selectedCategory;
        
        // ถ้าเคยสร้าง Ticket ไปแล้ว ให้โหลดไฟล์แนบมาด้วย
        if (this.isTicketCreated && this.ticketId) this.loadExistingAttachments(this.ticketId);
        setTimeout(() => { this.updateUIFromRestoredData(data); }, 800);
        if (this.isTicketCreated) this.addSuccessState();
      }
    } catch { localStorage.removeItem(`incompleteTicket_${this.currentUser?.id}`); }
  }

  // โหลดไฟล์แนบสำหรับ Draft
  private loadExistingAttachments(ticketId: number): void {
    if (!this.ticket_no) return;
    this.apiService.getTicketData({ ticket_no: this.ticket_no }).subscribe({
      next: (res) => {
        if (res.code === 1 && res.data?.issue_attachment) {
          this.existingAttachments = res.data.issue_attachment.map((att: any) => {
            this.attachmentTypes[att.attachment_id] = { type: 'file', extension: '', filename: `Attachment ${att.attachment_id}`, isLoading: true, isAnalyzed: false };
            return { attachment_id: att.attachment_id, path: att.path, filename: att.filename, file_type: att.file_type, file_size: att.file_size };
          });
          setTimeout(() => { this.analyzeAttachmentsFromUrls(); }, 100);
        } else this.existingAttachments = [];
      },
      error: () => { this.existingAttachments = []; }
    });
  }

  // เอาข้อมูล Draft มาแสดงบนหน้าจอ
  private updateUIFromRestoredData(ticketData: any): void {
    if (ticketData.formData.issueDescription) {
      const editor = document.querySelector('.rich-editor') as HTMLElement;
      if (editor) editor.innerHTML = ticketData.formData.issueDescription;
    }
    this.ticketForm.patchValue({
      projectId: ticketData.formData.projectId,
      categoryId: ticketData.formData.categoryId,
      issueDescription: ticketData.formData.issueDescription
    }, { emitEvent: true });

    // สั่งให้ Dropdown เลือกค่าตามที่บันทึกไว้
    setTimeout(() => {
      if (this.projectDropdown) this.projectDropdown.forceSync();
      if (this.categoryDropdown) this.categoryDropdown.forceSync();
      this.cdr.detectChanges();
    }, 500);
  }

  // บันทึก Draft ลงสมุดทด (LocalStorage)
  private saveIncompleteTicket(): void {
    if (this.isEditMode || !this.ticketId) return;
    const currentUserId = this.currentUser?.id || this.currentUser?.user_id;
    if (!currentUserId) return;
    
    // แปลงข้อมูลเป็นข้อความ แล้วเก็บลงเครื่อง
    localStorage.setItem(`incompleteTicket_${currentUserId}`, JSON.stringify({
      userId: currentUserId,
      ticketId: this.ticketId,
      ticket_no: this.ticket_no,
      isTicketCreated: this.isTicketCreated,
      formData: this.ticketForm.value,
      selectedProject: this.selectedProject,
      selectedCategory: this.selectedCategory,
      timestamp: new Date().getTime() // แปะเวลาไว้ด้วย จะได้รู้ว่าเก่าแค่ไหน
    }));
  }

  // ลบ Draft ทิ้ง (เมื่อสร้างเสร็จสมบูรณ์แล้ว)
  private clearIncompleteTicket(): void {
    if (!this.isEditMode && this.currentUser?.id) localStorage.removeItem(`incompleteTicket_${this.currentUser.id}`);
  }

  private clearEditData(): void {
    if (this.isEditMode && this.editTicketNo && this.currentUser?.id) localStorage.removeItem(`editTicket_${this.currentUser.id}_${this.editTicketNo}`);
  }

  // เมื่อผู้ใช้เลือกโปรเจกต์จาก Dropdown
  onProjectChange(event: any): void {
    this.selectedProject = event.project;
    this.ticketForm.patchValue({ projectId: event.projectId });
    // ถ้าเลือกแล้ว ให้ลบตัวหนังสือสีแดงเตือนออก
    if (event.projectId) this.validationErrors['projectId'] = false;
  }

  // เมื่อผู้ใช้เลือกหมวดหมู่
  onCategoryChange(event: any): void {
    this.selectedCategory = event.category;
    this.ticketForm.patchValue({ categoryId: event.categoryId });
    if (event.categoryId) this.validationErrors['categoryId'] = false;
  }

  // =================================================================================================
  // ส่วนที่ 10: ระบบบันทึกอัตโนมัติ (Auto-Save Logic)
  // =================================================================================================

  // ฟังก์ชันนี้จะถูกเรียกเมื่อผู้ใช้หยุดพิมพ์ไปพักนึง
  onFormCompleted(): void {
    if (this.isEditMode || this.isAutoSaving) return; // ถ้ากำลังแก้ของเก่า หรือกำลังบันทึกอยู่ ก็ไม่ต้องทำอะไร
    if (!this.validateFormForAutoSave().isValid) return; // ถ้าข้อมูลยังกรอกไม่ครบ ก็ยังไม่บันทึก
    
    // ถ้าเคยมีเลข Ticket แล้ว ให้ "อัปเดต" ถ้ายังไม่มี ให้ "สร้างใหม่"
    this.isTicketCreated && this.ticketId ? this.updateTicketDraft() : this.createTicketAutomatically();
  }

  // ตรวจสอบว่ากรอกข้อมูลครบพอที่จะ Auto-save หรือยัง
  private validateFormForAutoSave(): { isValid: boolean; errors?: string[] } {
    const { projectId, categoryId, issueDescription } = this.ticketForm.value;
    const errors: string[] = [];
    if (!projectId) errors.push(this.t('validation.required'));
    if (!categoryId) errors.push(this.t('validation.required'));
    if (!issueDescription || issueDescription.trim().length < 10) errors.push(this.t('validation.minLength', { min: 10 }));
    return { isValid: errors.length === 0, errors };
  }

  // ส่งแจ้งเตือนไปบอกคนอื่นว่ามี Ticket ใหม่
  private sendNewTicketNotification(ticketNo: string): void {
    this.notificationService.notifyTicketChanges({ ticket_no: ticketNo, isNewTicket: true }).subscribe({ error: (e) => console.warn(e) });
  }

  // สร้าง Ticket ใหม่แบบเงียบๆ (ไม่แสดงกล่องข้อความรบกวน)
  private createTicketAutomatically(): void {
    if (this.isEditMode || this.isAutoSaving || this.isSubmitting) return;
    this.isAutoSaving = true;
    this.isSubmitting = true;
    const formData = this.ticketForm.value;
    
    // ส่งข้อมูลไป Server
    this.apiService.saveTicket({ 
        project_id: +formData.projectId, 
        categories_id: +formData.categoryId, 
        issue_description: formData.issueDescription 
    }).subscribe({
      next: (res) => {
        if (res.code === 1) {
          // สำเร็จ! จดเลข Ticket ไว้
          this.ticketId = res.ticket_id;
          this.ticket_no = res.ticket_no;
          this.isTicketCreated = true;
          this.showSuccessMessage(this.t('tickets.ticketCreatedSuccess', { ticketNo: this.ticket_no }));
          this.addSuccessState(); // เปลี่ยนขอบฟอร์มเป็นสีเขียว
          this.saveIncompleteTicket(); // อัปเดต Draft ในเครื่อง
        } else this.onAutoCreateError(this.t('tickets.createTicketFailed'));
        this.isSubmitting = false;
        this.isAutoSaving = false;
      },
      error: () => { 
          this.onAutoCreateError(this.t('tickets.createError')); 
          this.isSubmitting = false; 
          this.isAutoSaving = false; 
      }
    });
  }

  // อัปเดตข้อมูล Ticket ที่มีอยู่แล้ว
  private updateTicketDraft(): void {
    if (this.isEditMode || !this.ticketId || this.isAutoSaving || this.isSubmitting) return;
    this.isAutoSaving = true;
    const formData = this.ticketForm.value;
    this.apiService.updateTicketData(this.ticketId, { 
        project_id: +formData.projectId, 
        categories_id: +formData.categoryId, 
        issue_description: formData.issueDescription 
    }).subscribe({
      next: (res) => { if (res.code === 1) this.saveIncompleteTicket(); this.isAutoSaving = false; },
      error: () => { this.isAutoSaving = false; }
    });
  }

  private onAutoCreateError(error: any): void {
    this.alertMessage = typeof error === 'string' ? error : error?.message || this.t('tickets.createError');
    this.alertType = 'error';
    this.showCustomAlert = true;
    this.isTicketCreated = false;
    this.ticketId = null;
    this.ticket_no = '';
  }

  private showSuccessMessage(message: string): void { console.log('Success:', message); }

  // เปลี่ยนสีฟอร์มเป็นสีเขียว เพื่อบอก User ว่า "บันทึกแล้วนะ"
  private addSuccessState(): void {
    setTimeout(() => {
      document.querySelector('.ticket-form')?.classList.add('success');
      document.querySelector('.rich-text-editor-container')?.classList.add('success');
      if (this.selectedFiles.length > 0) document.querySelector('.file-upload-area')?.classList.add('has-files');
    }, 100);
  }

  // อัปเดต Ticket แบบ Manual (ผู้ใช้กดปุ่มเอง)
  private updateExistingTicket(): void {
    if (!this.ticketId) return;
    this.isSubmitting = true;
    const formData = this.ticketForm.value;
    
    // 1. อัปเดตข้อความก่อน
    this.apiService.updateTicketData(this.ticketId, { 
        project_id: +formData.projectId, 
        categories_id: +formData.categoryId, 
        issue_description: formData.issueDescription 
    }).subscribe({
      next: (res) => {
        if (res.code === 1) {
          // 2. ถ้ามีไฟล์ใหม่ที่ยังไม่ได้อัป ให้อัปต่อ
          const newFiles = this.selectedFiles.filter(f => !this.uploadedFileNames.includes(f.name) && !this.uploadingFileNames.includes(f.name));
          if (newFiles.length > 0) {
              this.uploadFilesToExistingTicket(newFiles);
              this.waitForFileUploadsToComplete(); // รอจนไฟล์เสร็จ
          } else {
              this.completeTicketUpdateSuccess(0, 0); // เสร็จเลย
          }
        } else this.onUpdateError(this.t('tickets.updateTicketFailed'));
      },
      error: () => { this.onUpdateError(this.t('tickets.statusChangeError')); }
    });
  }

  // วนลูปเช็คว่าไฟล์อัปโหลดเสร็จหมดหรือยัง
  private waitForFileUploadsToComplete(): void {
    let checkCount = 0;
    const checkInterval = setInterval(() => {
      checkCount++;
      const stillUploading = this.uploadingFileNames.length > 0;
      const completedFiles = this.uploadedFileNames.length + this.errorFileNames.length;
      
      // ถ้าไม่มีการอัปโหลดแล้ว หรือ รอนานเกิน 30 วิ
      if ((!stillUploading && (completedFiles >= this.selectedFiles.length || this.selectedFiles.length === 0)) || checkCount >= 60) {
        clearInterval(checkInterval);
        if (this.selectedFiles.length === 0) this.completeTicketUpdateSuccess(0, 0);
        else this.errorFileNames.length === 0 ? this.completeTicketUpdateSuccess(this.uploadedFileNames.length, 0) : this.completeTicketUpdatePartial(this.uploadedFileNames.length, this.errorFileNames.length);
      }
    }, 500);
  }

  // แจ้งเตือนความสำเร็จแล้วเปลี่ยนหน้า
  private completeTicketUpdateSuccess(success: number, failed: number): void {
    this.clearEditData();
    let msg = this.t('tickets.updateTicketSuccess', { ticketNo: this.ticket_no });
    if (success > 0) msg += `\n\n${this.t('tickets.filesUploadedSuccess', { count: success })}`;
    if (failed > 0) msg += `\n${this.t('tickets.filesUploadedFailed', { count: failed })}`;
    this.alertMessage = msg;
    this.alertType = success > 0 || failed === 0 ? 'success' : 'error';
    this.showCustomAlert = true;
    this.isSubmitting = false;
    this.autoNavigationTimer = setTimeout(() => { if (!this.isNavigating) this.navigateToTicketDetail(); }, 3000);
  }

  private completeTicketUpdatePartial(success: number, failed: number): void { this.completeTicketUpdateSuccess(success, failed); }
  private completeTicketUpdateWithError(failed: number): void { this.isSubmitting = false; this.alertMessage = this.t('tickets.updateSuccessButFilesFailedPartial', { count: failed }); this.alertType = 'error'; this.showCustomAlert = true; }

  private onUpdateError(error: any): void {
    this.alertMessage = typeof error === 'string' ? error : error?.message || this.t('tickets.statusChangeError');
    this.alertType = 'error';
    this.showCustomAlert = true;
    this.isSubmitting = false;
  }

  // =================================================================================================
  // ส่วนที่ 11: การเลือกไฟล์และอัปโหลด (File Upload Action)
  // =================================================================================================

  // เมื่อผู้ใช้กดปุ่ม "เลือกไฟล์"
  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    // ถ้ายังกรอกข้อมูลสำคัญไม่ครบ ห้ามอัปไฟล์ (เพราะต้องใช้เลข Ticket ID จากการสร้าง)
    if (!this.isEditMode && !this.validateFormForAutoSave().isValid) {
      input.value = '';
      this.alertMessage = this.t('tickets.fillAllFields');
      this.alertType = 'error';
      this.showCustomAlert = true;
      this.showValidationErrors = true;
      this.markFieldsAsInvalid();
      return;
    }
    if (input.files) {
      // กรองไฟล์ซ้ำออก
      const newFiles = Array.from(input.files).filter(f => !this.selectedFiles.some(ef => ef.name === f.name && ef.size === f.size));
      if (newFiles.length === 0) { input.value = ''; this.showFileUploadError(this.t('tickets.fileDuplicate')); return; }
      
      // เช็คจำนวนไฟล์ (ห้ามเกิน 5)
      if (this.getTotalAttachmentCount() + newFiles.length > 5) { this.showFileUploadError(this.t('tickets.maxFilesExceeded', { max: 5, current: this.getTotalAttachmentCount() })); input.value = ''; return; }
      
      // เช็คขนาดไฟล์
      const validation = this.ticketService.validateFiles([...this.selectedFiles, ...newFiles]);
      if (!validation.isValid) { this.fileErrors = validation.errors; input.value = ''; return; }

      // ล้าง Error เดิม
      newFiles.forEach(f => {
        this.uploadedFileNames = this.uploadedFileNames.filter(n => n !== f.name);
        this.errorFileNames = this.errorFileNames.filter(n => n !== f.name);
      });

      // สร้างรูปตัวอย่าง (Preview)
      Promise.all(newFiles.filter(f => this.isImageFile(f)).map(f => this.ticketService.createImagePreview(f).then(url => this.filePreviewUrls[f.name] = url)))
        .then(() => {
          this.selectedFiles = [...this.selectedFiles, ...newFiles];
          this.ticketForm.patchValue({ attachments: this.selectedFiles });
          // ถ้ามีเลข Ticket ID แล้ว ให้เริ่มอัปโหลดทันที (ไม่ต้องรอกดปุ่ม Submit ใหญ่)
          if (this.isTicketCreated && this.ticketId && !this.isEditMode) this.uploadFilesToExistingTicket(newFiles);
        });
      input.value = '';
    }
  }

  // ฟังก์ชันอัปโหลดไฟล์ไปที่ Server
  private uploadFilesToExistingTicket(files: File[]): void {
    if (!this.ticketId || files.length === 0) return;
    // เอาเฉพาะไฟล์ที่ยังไม่อัป
    const uploadList = files.filter(f => !this.uploadingFileNames.includes(f.name) && !this.uploadedFileNames.includes(f.name));
    if (uploadList.length === 0) return;
    
    // ตั้งสถานะว่า "กำลังอัปโหลด"
    uploadList.forEach(f => { this.errorFileNames = this.errorFileNames.filter(n => n !== f.name); if (!this.uploadingFileNames.includes(f.name)) this.uploadingFileNames.push(f.name); });
    this.startFileUploadTimeout(uploadList);

    // ส่งไฟล์ไป Server
    this.apiService.updateAttachment({ 
      ticket_id: this.ticketId, 
      files: uploadList, 
      project_id: +this.ticketForm.value.projectId, 
      categories_id: +this.ticketForm.value.categoryId, 
      issue_description: this.ticketForm.value.issueDescription
    }).subscribe({
      next: (res) => {
        this.clearFileUploadTimeout();
        if (res.code === 1 || res.code === 200 || res.code === 201) {
          // สำเร็จ: เปลี่ยนสถานะเป็น "เสร็จสิ้น"
          const successCount = Array.isArray(res.data) ? res.data.length : (res as any).uploaded_files?.length || uploadList.length;
          uploadList.forEach((f, i) => i < successCount ? this.markFileAsUploaded(f.name) : this.markFileAsError(f.name));
          this.showFileUploadSuccess(this.t('tickets.filesUploadedSuccess', { count: successCount }));
        } else this.handleFileUploadError(uploadList, (res as any).message || this.t('tickets.exportError'));
      },
      error: (e) => { this.clearFileUploadTimeout(); this.handleFileUploadError(uploadList, e?.error?.message || e?.message || this.t('tickets.exportError')); }
    });
  }

  // นาฬิกาจับเวลาตัดจบการอัปโหลด
  private startFileUploadTimeout(files: File[]): void {
    this.clearFileUploadTimeout();
    this.fileUploadTimeoutTimer = setTimeout(() => {
      files.forEach(f => { if (this.uploadingFileNames.includes(f.name)) this.markFileAsError(f.name); });
      this.showFileUploadError(this.t('tickets.uploadTimeout'));
    }, this.FILE_UPLOAD_TIMEOUT);
  }
  
  private clearFileUploadTimeout(): void { if (this.fileUploadTimeoutTimer) clearTimeout(this.fileUploadTimeoutTimer); }

  private handleFileUploadError(files: File[], msg: string): void { files.forEach(f => this.markFileAsError(f.name)); this.showFileUploadError(msg); }
  private markFileAsUploaded(name: string): void { this.uploadingFileNames = this.uploadingFileNames.filter(n => n !== name); this.errorFileNames = this.errorFileNames.filter(n => n !== name); if (!this.uploadedFileNames.includes(name)) this.uploadedFileNames.push(name); }
  private markFileAsError(name: string): void { this.uploadingFileNames = this.uploadingFileNames.filter(n => n !== name); this.uploadedFileNames = this.uploadedFileNames.filter(n => n !== name); if (!this.errorFileNames.includes(name)) this.errorFileNames.push(name); }
  
  private showFileUploadSuccess(msg: string): void { if (!this.fileSuccessMessages.includes(msg)) { this.fileSuccessMessages.push(msg); setTimeout(() => { this.fileSuccessMessages = this.fileSuccessMessages.filter(m => m !== msg); }, 3000); } }
  private resetFileStates(): void { this.uploadedFileNames = []; this.uploadingFileNames = []; this.errorFileNames = []; this.fileSuccessMessages = []; }
  private showFileUploadError(msg: string): void { this.fileErrors.push(msg); setTimeout(() => { this.fileErrors = this.fileErrors.filter(e => e !== msg); }, 5000); }

  // ลบไฟล์ที่เลือกมา แต่ยังไม่ได้ส่งฟอร์ม
  removeFile(index: number): void {
    const file = this.selectedFiles[index];
    if (this.filePreviewUrls[file.name]?.startsWith('blob:')) URL.revokeObjectURL(this.filePreviewUrls[file.name]);
    delete this.filePreviewUrls[file.name];
    this.uploadedFileNames = this.uploadedFileNames.filter(n => n !== file.name);
    this.uploadingFileNames = this.uploadingFileNames.filter(n => n !== file.name);
    this.errorFileNames = this.errorFileNames.filter(n => n !== file.name);
    this.selectedFiles.splice(index, 1);
    this.ticketForm.patchValue({ attachments: this.selectedFiles });
    this.fileErrors = this.selectedFiles.length === 0 ? [] : this.ticketService.validateFiles(this.selectedFiles).errors;
  }

  // --- ปุ่มบันทึกใหญ่ (Main Submit) ---
  onSubmit(): void {
    if (!this.validateFormForAutoSave().isValid) {
      // กรอกไม่ครบ แจ้งเตือน
      this.alertMessage = this.t('tickets.fillAllFields');
      this.alertType = 'error';
      this.showCustomAlert = true;
      this.showValidationErrors = true;
      this.markFieldsAsInvalid();
      return;
    }
    // ถ้าแก้ไข -> ไปอัปเดต
    if (this.isEditMode) { this.updateExistingTicket(); return; }
    // ถ้ายังไม่ได้สร้าง Ticket -> สร้าง
    if (!this.isTicketCreated) { this.createTicketAutomatically(); return; }
    // ถ้ามีไฟล์กำลังอัปโหลด -> รอให้เสร็จ
    if (this.selectedFiles.length > 0 && this.uploadingFileNames.length > 0) { this.waitForUploadsAndFinish(); return; }
    
    this.completedTicketCreation();
  }

  // รอให้ Upload เสร็จ
  private waitForUploadsAndFinish(): void {
    this.isSubmitting = true;
    const interval = setInterval(() => {
      if (this.uploadingFileNames.length === 0 || this.uploadedFileNames.length + this.errorFileNames.length >= this.selectedFiles.length) {
        clearInterval(interval);
        this.isSubmitting = false;
        this.isEditMode ? this.completeTicketUpdateSuccess(this.uploadedFileNames.length, this.errorFileNames.length) : this.completedTicketCreation();
      }
    }, 500);
    setTimeout(() => { clearInterval(interval); if (this.isSubmitting) { this.isSubmitting = false; this.completedTicketCreation(); } }, 30000);
  }

  // จบงาน
  private completedTicketCreation(): void {
    this.clearIncompleteTicket(); // ลบ Draft
    if (this.ticket_no) this.sendNewTicketNotification(this.ticket_no);
    this.alertMessage = this.t('tickets.ticketCreatedSuccess', { ticketNo: this.ticket_no });
    this.alertType = 'success';
    this.showCustomAlert = true;
    this.autoNavigationTimer = setTimeout(() => { if (!this.isNavigating) this.navigateToTicketDetail(); }, 3000);
  }

  private navigateToTicketDetail(): void {
    if (this.ticket_no) { this.isNavigating = true; this.showCustomAlert = false; this.clearAllTimers(); this.router.navigate(['/tickets', this.ticket_no]); }
  }

  // ล้างค่าทุกอย่างในหน้าจอ (เหมือนกด F5 แต่เร็วกว่า)
  resetForm(): void {
    this.clearAllTimers();
    if (this.isEditMode) { this.clearEditData(); this.backToTicketDetail(); return; }
    this.clearIncompleteTicket();
    this.ticketForm.reset();
    this.selectedFiles = []; this.fileErrors = []; this.isTicketCreated = false; this.ticketId = null; this.ticket_no = ''; this.isSubmitting = false; this.showValidationErrors = false; this.validationErrors = {}; this.isNavigating = false;
    this.resetFileStates();
    this.selectedProject = null; this.selectedCategory = null;
    Object.values(this.filePreviewUrls).forEach(u => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); });
    this.filePreviewUrls = {};
    this.removeSuccessState();
  }

  private removeSuccessState(): void {
    document.querySelector('.ticket-form')?.classList.remove('success');
    document.querySelector('.rich-text-editor-container')?.classList.remove('success');
    document.querySelector('.file-upload-area')?.classList.remove('has-files');
  }

  // เช็คว่ากรอกครบหรือยัง
  get isFormCompleted(): boolean { return this.validateFormForAutoSave().isValid; }
  // เช็คว่ามีการแก้ไขแล้วยังไม่ได้เซฟไหม
  get hasUnsavedChanges(): boolean {
    if (this.isEditMode && this.originalTicketData) {
      const form = this.ticketForm.value;
      const orig = this.originalTicketData.formData;
      return form.projectId !== orig.projectId || form.categoryId !== orig.categoryId || form.issueDescription !== orig.issueDescription || this.selectedFiles.length > 0;
    }
    return this.isFormCompleted && !this.isTicketCreated;
  }

  isFileUploaded(name: string): boolean { return this.uploadedFileNames.includes(name); }
  isFileUploading(name: string): boolean { return this.uploadingFileNames.includes(name); }
  isFileError(name: string): boolean { return this.errorFileNames.includes(name); }
  getFileIconClass(file: File): string { return this.ticketService.getFileIcon(file.name); }
  formatFileSize(bytes: number): string { return this.ticketService.formatFileSize(bytes); }
  isImageFile(file: File): boolean { return this.ticketService.isImageFile(file); }
  getFilePreview(file: File): string { return this.filePreviewUrls[file.name] || ''; }
  
  getFileTypeClass(file: File): string {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'file-icon-pdf';
    if (['doc', 'docx'].includes(ext!)) return 'file-icon-doc';
    if (ext === 'txt') return 'file-icon-txt';
    if (['xls', 'xlsx'].includes(ext!)) return 'file-icon-excel';
    return 'file-icon-default';
  }

  // ไฮไลท์ช่องที่กรอกผิดให้เป็นสีแดง
  private markFieldsAsInvalid(): void {
    const { projectId, categoryId, issueDescription } = this.ticketForm.value;
    this.validationErrors = {
      projectId: !projectId,
      categoryId: !categoryId,
      issueDescription: !issueDescription || issueDescription.trim().length < 10
    };
  }
  
  isFieldInvalid(name: string): boolean { return this.showValidationErrors && this.validationErrors[name]; }
  
  getFieldError(name: string): string {
    if (!this.isFieldInvalid(name)) return '';
    if (name === 'projectId') return this.t('tickets.selectProject');
    if (name === 'categoryId') return this.t('tickets.selectCategory');
    if (name === 'issueDescription') return this.t('validation.minLength', { min: 10 });
    return this.t('validation.required');
  }

  onAlertClosed(): void {
    if (this.alertType === 'success' && this.ticket_no && !this.isNavigating) this.navigateToTicketDetail();
    else this.showCustomAlert = false;
  }

  // ถ้า User จะกดปิดหน้าเว็บ (กากบาท) ให้เด้งถามก่อนถ้างานยังไม่เสร็จ
  @HostListener('window:beforeunload', ['$event'])
  canDeactivate(event: BeforeUnloadEvent): boolean {
    this.clearAllTimers();
    if (this.hasUnsavedChanges) { event.returnValue = this.t('common.unsavedChanges'); return false; }
    return true;
  }
}