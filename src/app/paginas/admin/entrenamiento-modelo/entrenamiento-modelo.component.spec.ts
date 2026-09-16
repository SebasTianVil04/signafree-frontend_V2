import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntrenamientoModeloComponent } from './entrenamiento-modelo.component';

describe('EntrenamientoModeloComponent', () => {
  let component: EntrenamientoModeloComponent;
  let fixture: ComponentFixture<EntrenamientoModeloComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EntrenamientoModeloComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EntrenamientoModeloComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
