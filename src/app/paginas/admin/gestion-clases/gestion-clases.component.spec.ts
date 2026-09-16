import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionClasesComponent } from './gestion-clases.component';

describe('GestionClasesComponent', () => {
  let component: GestionClasesComponent;
  let fixture: ComponentFixture<GestionClasesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GestionClasesComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GestionClasesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
