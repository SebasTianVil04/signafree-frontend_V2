import { TestBed } from '@angular/core/testing';

import { HandDetectionService } from './hand-detection.service';

describe('HandDetectionService', () => {
  let service: HandDetectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HandDetectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
