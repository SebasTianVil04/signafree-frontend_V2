import { TestBed } from '@angular/core/testing';

import { ProgresoClasesService } from './progreso-clases.service';

describe('ProgresoClasesService', () => {
  let service: ProgresoClasesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProgresoClasesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
