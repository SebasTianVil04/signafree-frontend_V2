import { TestBed } from '@angular/core/testing';

import { SeguimientoTiempoService } from './seguimiento-tiempo.service';

describe('SeguimientoTiempoService', () => {
  let service: SeguimientoTiempoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SeguimientoTiempoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
