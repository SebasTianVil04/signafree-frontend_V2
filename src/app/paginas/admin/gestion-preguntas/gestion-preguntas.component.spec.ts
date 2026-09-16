import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionPreguntasComponent } from './gestion-preguntas.component';

describe('GestionPreguntasComponent', () => {
  let component: GestionPreguntasComponent;
  let fixture: ComponentFixture<GestionPreguntasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GestionPreguntasComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GestionPreguntasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
