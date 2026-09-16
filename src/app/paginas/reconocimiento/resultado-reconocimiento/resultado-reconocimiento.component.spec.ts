import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultadoReconocimientoComponent } from './resultado-reconocimiento.component';

describe('ResultadoReconocimientoComponent', () => {
  let component: ResultadoReconocimientoComponent;
  let fixture: ComponentFixture<ResultadoReconocimientoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ResultadoReconocimientoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ResultadoReconocimientoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
