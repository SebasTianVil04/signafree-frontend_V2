import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionExamenesComponent } from './gestion-examenes.component';

describe('GestionExamenesComponent', () => {
  let component: GestionExamenesComponent;
  let fixture: ComponentFixture<GestionExamenesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GestionExamenesComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GestionExamenesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
