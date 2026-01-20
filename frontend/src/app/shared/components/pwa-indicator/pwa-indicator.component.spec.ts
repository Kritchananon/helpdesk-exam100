import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PWAIndicatorComponent } from './pwa-indicator.component';

describe('PWAIndicatorComponent', () => {
  let component: PWAIndicatorComponent;
  let fixture: ComponentFixture<PWAIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PWAIndicatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PWAIndicatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
