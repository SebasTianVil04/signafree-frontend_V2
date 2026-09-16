import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetalleLeccionComponent } from './detalle-leccion.component';

describe('DetalleLeccionComponent', () => {
  let component: DetalleLeccionComponent;
  let fixture: ComponentFixture<DetalleLeccionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DetalleLeccionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DetalleLeccionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
