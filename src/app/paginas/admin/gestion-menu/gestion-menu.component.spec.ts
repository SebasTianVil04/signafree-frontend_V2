import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GestionMenuComponent } from './gestion-menu.component';

describe('GestionMenuComponent', () => {
  let component: GestionMenuComponent;
  let fixture: ComponentFixture<GestionMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GestionMenuComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GestionMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
