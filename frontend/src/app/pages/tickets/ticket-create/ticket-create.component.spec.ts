import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { TicketCreateComponent } from './ticket-create.component';

interface ValidateResult { isValid: boolean; errors: string[] }

// Mock Services
class MockApiService {
  getTicketData = (params: any) => of({ code: 1, data: { ticket: { id: 1, ticket_no: 'TKT-001', project_id: 1, categories_id: 1, issue_description: 'Test Issue' }, issue_attachment: [] as { attachment_id: number; path: string }[] } });
  saveTicket = (data: any) => of({ code: 1, ticket_id: 2, ticket_no: 'TKT-002' });
  updateTicketData = (id: number, data: any) => of({ code: 1 });
  deleteAttachment = (id: number) => of({ code: 1 });
  updateAttachment = (data: any) => of({ code: 1, uploaded_files: [{ filename: 'test.jpg' }] });
}

class MockAuthService {
  getCurrentUser = () => ({ id: 99, user_id: 99, name: 'Test User' });
}

class MockTicketService {
  validateFiles = (files: File[]): ValidateResult => ({
    isValid: true,
    errors: [] as string[]       // ← ป้องกัน never[]
  });
  formatFileSize = (bytes: number) => '1 KB';
  isImageFile = (file: File) => file.name.endsWith('.jpg');
  createImagePreview = (file: File) => Promise.resolve('blob:http://preview');
  getFileIcon = (name: string) => 'bi-file';
}

class MockNotificationService {
  notifyTicketChanges = (data: any) => of({} as any);
}

class MockLanguageService {
  translate = (key: string, params?: any) => key.split('.').pop() + (params ? JSON.stringify(params) : '');
}

const mockRouter = {
  navigate: jasmine.createSpy('navigate'),
  events: new Subject<any>(),
  url: ''
};

const mockActivatedRoute = {
  snapshot: {
    params: {}
  }
};

describe('TicketCreateComponent', () => {
  let component: TicketCreateComponent;
  let fixture: ComponentFixture<TicketCreateComponent>;
  let apiService: MockApiService;
  let ticketService: MockTicketService;
  let router: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketCreateComponent, ReactiveFormsModule, HttpClientTestingModule],
      providers: [
        FormBuilder,
        { provide: MockApiService, useClass: MockApiService },
        { provide: MockAuthService, useClass: MockAuthService },
        { provide: MockTicketService, useClass: MockTicketService },
        { provide: MockNotificationService, useClass: MockNotificationService },
        { provide: MockLanguageService, useClass: MockLanguageService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TicketCreateComponent);
    component = fixture.componentInstance;
    apiService = TestBed.inject(MockApiService);
    ticketService = TestBed.inject(MockTicketService) as unknown as MockTicketService;
    router = TestBed.inject(Router);
    // ตั้งค่า localStorage สำหรับทดสอบ
    spyOn(localStorage, 'getItem').and.returnValue(null);
    spyOn(localStorage, 'setItem');
    spyOn(localStorage, 'removeItem');
    fixture.detectChanges(); // ngOnInit ถูกเรียกที่นี่
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- Core State & Initialization Tests ---

  it('should initialize in creation mode if no ticket_no in route params', () => {
    mockActivatedRoute.snapshot.params = {};
    component.ngOnInit();
    expect(component.isEditMode).toBeFalse();
    expect(component.getPageTitle()).toContain('newTicket');
  });

  it('should initialize in edit mode and load data if ticket_no is present', fakeAsync(() => {
    mockActivatedRoute.snapshot.params = { ticket_no: 'TKT-001' };
    spyOn(apiService, 'getTicketData').and.returnValue(of({
      code: 1,
      data: {
        ticket: {
          id: 1,
          ticket_no: "TEST-001",
          project_id: 1,
          categories_id: 1,
          issue_description: "Test Issue"
        },
        issue_attachment: [] as { attachment_id: number; path: string }[]   // ← ต้องใส่ type
      }
    }));


    component.ngOnInit();
    tick(1000); // 800ms timeout + buffer
    fixture.detectChanges();

    expect(component.isEditMode).toBeTrue();
    expect(apiService.getTicketData).toHaveBeenCalledWith({ ticket_no: 'TKT-001' });
    expect(component.ticketForm.value.projectId).toBe(1);
    expect(component.ticket_no).toBe('TKT-001');
    expect(component.existingAttachments.length).toBe(1);
    expect(component.getPageTitle()).toContain('editTicket');
  }));

  it('should restore incomplete ticket data on creation mode init if saved', () => {
    const savedData = {
      userId: 99, timestamp: new Date().getTime(), ticketId: 5, ticket_no: 'DRAFT-005', isTicketCreated: true,
      formData: { projectId: 1, categoryId: 2, issueDescription: 'Incomplete Draft' },
      selectedProject: { id: 1 }, selectedCategory: { id: 2 }
    };
    (localStorage.getItem as jasmine.Spy).and.returnValue(JSON.stringify(savedData));

    component.ngOnInit();
    expect(localStorage.getItem).toHaveBeenCalled();
    // เนื่องจากมีการเรียก setTimeout ใน restoreIncompleteTicket, ต้องใช้ fakeAsync
    // แต่สำหรับการเช็คค่าเบื้องต้น สามารถทำได้ทันที
    expect(component.ticketId).toBe(5);
    expect(component.ticket_no).toBe('DRAFT-005');
  });

  // --- Form & Validation Tests ---

  it('should mark fields as invalid and show alert on form submit with missing data', () => {
    component.ticketForm.patchValue({ projectId: '', categoryId: '', issueDescription: '' });
    component.onSubmit();
    fixture.detectChanges();

    expect(component.showValidationErrors).toBeTrue();
    expect(component.showCustomAlert).toBeTrue();
    expect(component.alertMessage).toContain('fillAllFields');
    expect(component.isFieldInvalid('projectId')).toBeTrue();
    expect(component.getFieldError('issueDescription')).toContain('minLength');
  });

  it('should get correct field error messages', () => {
    component.showValidationErrors = true;
    component.validationErrors = { projectId: true, categoryId: true, issueDescription: true };
    expect(component.getFieldError('projectId')).toContain('selectProject');
    expect(component.getFieldError('categoryId')).toContain('selectCategory');
    expect(component.getFieldError('issueDescription')).toContain('minLength');
  });

  // --- Creation & Update Logic Tests ---

  it('should call createTicketAutomatically on submit when not in edit mode and form is valid but not created yet', fakeAsync(() => {
    spyOn(component as any, 'createTicketAutomatically').and.callThrough();
    component.isEditMode = false;
    component.isTicketCreated = false;
    component.ticketForm.patchValue({ projectId: 1, categoryId: 2, issueDescription: 'Valid issue description minimum 10 characters' });

    component.onSubmit();
    tick(1);

    expect((component as any).createTicketAutomatically).toHaveBeenCalled();
    expect(component.isSubmitting).toBeTrue();

    // Mock response success
    component.isSubmitting = false;
    component.ticketId = 10;
    component.ticket_no = 'TKT-010';
    component.isTicketCreated = true;
    // FIX: Access private method using (component as any)
    (component as any).completedTicketCreation();

    tick(3000); // Wait for navigation timer
    expect(router.navigate).toHaveBeenCalledWith(['/tickets', 'TKT-010']);
  }));

  it('should call updateExistingTicket on submit when in edit mode and form is valid', fakeAsync(() => {
    spyOn(component as any, 'updateExistingTicket').and.callThrough();
    component.isEditMode = true;
    component.ticketId = 1;
    component.ticket_no = 'TKT-001';
    component.selectedFiles = [];
    component.ticketForm.patchValue({ projectId: 1, categoryId: 2, issueDescription: 'Valid issue description minimum 10 characters' });
    spyOn(apiService, 'updateTicketData').and.returnValue(of({ code: 1 }));

    component.onSubmit();
    tick(1);

    expect((component as any).updateExistingTicket).toHaveBeenCalled();
    expect(apiService.updateTicketData).toHaveBeenCalled();
    expect(component.isSubmitting).toBeTrue();

    // Complete update success (no files)
    component.isSubmitting = false;
    component.showCustomAlert = true;
    expect(component.alertType).toBe('success');

    tick(3000); // Wait for navigation timer
    expect(router.navigate).toHaveBeenCalledWith(['/tickets', 'TKT-001']);
  }));

  // --- File Upload & Management Tests ---

  it('should add files to selectedFiles and not upload if not created yet', fakeAsync(() => {
    const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    component.isTicketCreated = false;
    component.ticketForm.patchValue({ projectId: 1, categoryId: 2, issueDescription: 'Valid issue description minimum 10 characters' });

    component.onFileSelect({ target: { files: [mockFile], value: '' } } as unknown as Event);
    tick();

    expect(component.selectedFiles.length).toBe(1);
    expect(component.selectedFiles[0].name).toBe('test.pdf');
    expect(component.ticketForm.value.attachments.length).toBe(1);
  }));

  it('should show error if file validation fails on select', () => {
    spyOn(ticketService, 'validateFiles')
      .and.returnValue(<ValidateResult>{
        isValid: false,
        errors: ['Max file size exceeded']
      });

    const mockFile = new File(['content'], 'large.jpg', { type: 'image/jpeg' });
    component.isTicketCreated = false;
    component.ticketForm.patchValue({ projectId: 1, categoryId: 2, issueDescription: 'Valid issue description minimum 10 characters' });

    component.onFileSelect({ target: { files: [mockFile], value: '' } } as unknown as Event);

    expect(component.fileErrors.length).toBeGreaterThan(0);
    expect(component.selectedFiles.length).toBe(0);
  });

  it('should remove file correctly', () => {
    const mockFile = new File(['content'], 'delete.jpg', { type: 'image/jpeg' });
    component.selectedFiles = [mockFile];
    component.filePreviewUrls['delete.jpg'] = 'blob:url';
    spyOn(URL, 'revokeObjectURL');

    component.removeFile(0);

    expect(component.selectedFiles.length).toBe(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
  });

  // --- Rich Text Editor Tests ---

  it('should update form control on rich editor input', () => {
    const mockContent = '<b>test</b>';
    const mockEvent = { target: { innerHTML: mockContent } } as unknown as Event;
    component.onDescriptionInput(mockEvent);
    expect(component.ticketForm.value.issueDescription).toBe(mockContent);
  });

  it('should execute command for text formatting', () => {
    spyOn(document, 'execCommand');
    spyOn(component as any, 'updateFormContent');

    component.formatText('bold');

    expect(document.execCommand).toHaveBeenCalledWith('bold', false);
    expect((component as any).updateFormContent).toHaveBeenCalled();
  });

  it('should update toolbar state on editor event', () => {
    spyOn(document, 'queryCommandState').and.returnValues(true, false, false, false, false, true, false, false, false); // Bold active, JustifyLeft active
    component.toolbarState = {
      bold: false, italic: false, underline: false, justifyLeft: false, justifyCenter: false, justifyRight: false, justifyFull: false, insertUnorderedList: false, insertOrderedList: false
    };

    component.onEditorEvent();

    expect(component.toolbarState.bold).toBeTrue();
    expect(component.toolbarState.justifyLeft).toBeTrue();
    expect(component.toolbarState.justifyCenter).toBeFalse();
  });

  // --- Lifecycle & Cleanup Tests ---

  it('should clear incomplete ticket on successful creation', () => {
    spyOn(component as any, 'clearIncompleteTicket');
    component.isTicketCreated = true;
    component.ticket_no = 'TKT-001';
    (component as any).completedTicketCreation();
    expect((component as any).clearIncompleteTicket).toHaveBeenCalled();
  });

  it('should clear timers and revoke blob URLs on destroy', () => {
    component.filePreviewUrls['test'] = 'blob:http://test';
    // FIX: Access private properties using (component as any)
    (component as any).autoNavigationTimer = setTimeout(() => { }, 100);
    (component as any).fileUploadTimeoutTimer = setTimeout(() => { }, 100);
    spyOn(window, 'clearTimeout');
    spyOn(URL, 'revokeObjectURL');

    component.ngOnDestroy();

    expect(window.clearTimeout).toHaveBeenCalledTimes(2);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://test');
  });

  it('should call router.navigate to go back to detail after update', fakeAsync(() => {
    component.isEditMode = true;
    component.ticket_no = 'TKT-001';
    component.ticketId = 1;
    (component as any).completeTicketUpdateSuccess(0, 0);

    tick(3000); // Wait for autoNavigationTimer
    expect(router.navigate).toHaveBeenCalledWith(['/tickets', 'TKT-001']);
  }));

  // --- Attachment Display Helpers ---

  it('should return correct file type from extension', () => {
    expect(component.getFileTypeFromExtension('report.pdf')).toBe('pdf');
    expect(component.getFileTypeFromExtension('image.jpg')).toBe('image');
    expect(component.getFileTypeFromExtension('archive.zip')).toBe('archive');
    expect(component.getFileTypeFromExtension('data.unknown')).toBe('file');
  });

  it('should return correct file type color', () => {
    expect(component.getFileTypeColor('pdf')).toBe('#dc3545');
    expect(component.getFileTypeColor('image')).toBe('#6f42c1');
    expect(component.getFileTypeColor('file')).toBe('#6c757d');
  });

});