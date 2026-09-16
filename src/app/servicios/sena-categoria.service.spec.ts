import { TestBed } from '@angular/core/testing';

import { SenaCategoriaService } from './sena-categoria.service';

describe('SenaCategoriaService', () => {
  let service: SenaCategoriaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SenaCategoriaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
