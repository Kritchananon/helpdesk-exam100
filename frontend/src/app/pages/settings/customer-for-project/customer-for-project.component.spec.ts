import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomerForProjectComponent } from './customer-for-project.component';

describe('CustomerForProjectComponent', () => {
  let component: CustomerForProjectComponent;
  let fixture: ComponentFixture<CustomerForProjectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerForProjectComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CustomerForProjectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
