import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PracticaLeccionComponent } from './practica-leccion.component';

describe('PracticaLeccionComponent', () => {
  let component: PracticaLeccionComponent;
  let fixture: ComponentFixture<PracticaLeccionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PracticaLeccionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PracticaLeccionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
