import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionLeccionesComponent } from './gestion-lecciones.component';

describe('GestionLeccionesComponent', () => {
  let component: GestionLeccionesComponent;
  let fixture: ComponentFixture<GestionLeccionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GestionLeccionesComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GestionLeccionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
