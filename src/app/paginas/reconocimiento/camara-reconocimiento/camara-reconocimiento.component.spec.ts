import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CamaraReconocimientoComponent } from './camara-reconocimiento.component';

describe('CamaraReconocimientoComponent', () => {
  let component: CamaraReconocimientoComponent;
  let fixture: ComponentFixture<CamaraReconocimientoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CamaraReconocimientoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CamaraReconocimientoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
