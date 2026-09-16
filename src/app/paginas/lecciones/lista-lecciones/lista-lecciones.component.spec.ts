import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListaLeccionesComponent } from './lista-lecciones.component';

describe('ListaLeccionesComponent', () => {
  let component: ListaLeccionesComponent;
  let fixture: ComponentFixture<ListaLeccionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ListaLeccionesComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ListaLeccionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
