import { TestBed } from '@angular/core/testing';

import { RecursosSenasService } from './recursos-senas.service';

describe('RecursosSenasService', () => {
  let service: RecursosSenasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RecursosSenasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
