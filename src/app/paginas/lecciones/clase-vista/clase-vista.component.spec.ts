import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClaseVistaComponent } from './clase-vista.component';

describe('ClaseVistaComponent', () => {
  let component: ClaseVistaComponent;
  let fixture: ComponentFixture<ClaseVistaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ClaseVistaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ClaseVistaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
