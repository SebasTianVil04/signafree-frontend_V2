import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VisualizadorPuntosComponent } from './visualizador-puntos.component';

describe('VisualizadorPuntosComponent', () => {
  let component: VisualizadorPuntosComponent;
  let fixture: ComponentFixture<VisualizadorPuntosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VisualizadorPuntosComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VisualizadorPuntosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
