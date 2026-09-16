import { TestBed } from '@angular/core/testing';

import { CapturaService } from './captura.service';

describe('CapturaService', () => {
  let service: CapturaService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CapturaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
