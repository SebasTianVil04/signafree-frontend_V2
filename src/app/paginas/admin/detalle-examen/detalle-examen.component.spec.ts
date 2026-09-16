import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalleExamenComponent } from './detalle-examen.component';

describe('DetalleExamenComponent', () => {
  let component: DetalleExamenComponent;
  let fixture: ComponentFixture<DetalleExamenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DetalleExamenComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DetalleExamenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
