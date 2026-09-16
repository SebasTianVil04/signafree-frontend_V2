import { TestBed } from '@angular/core/testing';

import { EntrenamientoEstadoService } from './entrenamiento-estado.service';

describe('EntrenamientoEstadoService', () => {
  let service: EntrenamientoEstadoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EntrenamientoEstadoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
