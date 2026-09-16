import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionImagenesDatasetComponent } from './gestion-imagenes-dataset.component';

describe('GestionImagenesDatasetComponent', () => {
  let component: GestionImagenesDatasetComponent;
  let fixture: ComponentFixture<GestionImagenesDatasetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ GestionImagenesDatasetComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GestionImagenesDatasetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
