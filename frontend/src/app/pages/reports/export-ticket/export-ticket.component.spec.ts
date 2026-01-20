import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportTicketComponent } from './export-ticket.component';

describe('ExportTicketComponent', () => {
  let component: ExportTicketComponent;
  let fixture: ComponentFixture<ExportTicketComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportTicketComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExportTicketComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
