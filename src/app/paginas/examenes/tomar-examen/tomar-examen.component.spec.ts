import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TomarExamenComponent } from './tomar-examen.component';

describe('TomarExamenComponent', () => {
  let component: TomarExamenComponent;
  let fixture: ComponentFixture<TomarExamenComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TomarExamenComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TomarExamenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
