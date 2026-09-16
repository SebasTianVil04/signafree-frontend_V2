import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TarjetaProgresoComponent } from './tarjeta-progreso.component';

describe('TarjetaProgresoComponent', () => {
  let component: TarjetaProgresoComponent;
  let fixture: ComponentFixture<TarjetaProgresoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TarjetaProgresoComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TarjetaProgresoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
