import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraficoProgresoComponent } from './grafico-progreso.component';

describe('GraficoProgresoComponent', () => {
  let component: GraficoProgresoComponent;
  let fixture: ComponentFixture<GraficoProgresoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GraficoProgresoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GraficoProgresoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
