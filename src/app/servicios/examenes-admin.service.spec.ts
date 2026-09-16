import { TestBed } from '@angular/core/testing';

import { ExamenesAdminService } from './examenes-admin.service';

describe('ExamenesAdminService', () => {
  let service: ExamenesAdminService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExamenesAdminService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
