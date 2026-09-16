import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraficoEstadisticasComponent } from './grafico-estadisticas.component';

describe('GraficoEstadisticasComponent', () => {
  let component: GraficoEstadisticasComponent;
  let fixture: ComponentFixture<GraficoEstadisticasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GraficoEstadisticasComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GraficoEstadisticasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
