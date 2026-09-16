import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CamaraReconocimientoExamenComponent } from './camara-reconocimiento-examen.component';

describe('CamaraReconocimientoExamenComponent', () => {
  let component: CamaraReconocimientoExamenComponent;
  let fixture: ComponentFixture<CamaraReconocimientoExamenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CamaraReconocimientoExamenComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CamaraReconocimientoExamenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
