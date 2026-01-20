import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupportInformationDisplayComponent } from './support-information-display.component';

describe('SupportInformationDisplayComponent', () => {
  let component: SupportInformationDisplayComponent;
  let fixture: ComponentFixture<SupportInformationDisplayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SupportInformationDisplayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupportInformationDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
