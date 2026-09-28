import { TestBed } from '@angular/core/testing';

import { PrivacyFilterService } from './privacy-filter.service';

describe('PrivacyFilterService', () => {
  let service: PrivacyFilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PrivacyFilterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
