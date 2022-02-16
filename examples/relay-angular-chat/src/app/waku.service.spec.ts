import { TestBed } from '@angular/core/testing';

import { WakuService } from './waku.service';

describe('WakuService', () => {
  let service: WakuService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WakuService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
