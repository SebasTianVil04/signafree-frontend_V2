import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CapturaUnificadaComponent } from './captura-unificada.component';

describe('CapturaUnificadaComponent', () => {
  let component: CapturaUnificadaComponent;
  let fixture: ComponentFixture<CapturaUnificadaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CapturaUnificadaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CapturaUnificadaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
