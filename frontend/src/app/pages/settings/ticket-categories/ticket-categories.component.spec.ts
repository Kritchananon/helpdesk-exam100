import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketCategoriesComponent } from './ticket-categories.component';

describe('TicketCategoriesComponent', () => {
  let component: TicketCategoriesComponent;
  let fixture: ComponentFixture<TicketCategoriesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketCategoriesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TicketCategoriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
