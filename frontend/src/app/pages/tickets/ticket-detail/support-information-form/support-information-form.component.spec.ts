import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupportInformationFormComponent } from './support-information-form.component';

describe('SupportInformationFormComponent', () => {
  let component: SupportInformationFormComponent;
  let fixture: ComponentFixture<SupportInformationFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupportInformationFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupportInformationFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
