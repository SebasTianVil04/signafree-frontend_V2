import { TestBed } from '@angular/core/testing';

import { ProgresoService } from './progreso.service';

describe('ProgresoService', () => {
  let service: ProgresoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProgresoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
