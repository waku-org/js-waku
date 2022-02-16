import { Injectable } from '@angular/core';
import { Waku } from 'js-waku';
import { distinctUntilChanged, BehaviorSubject, ReplaySubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WakuService {

  // private wakuSubject = new BehaviorSubject<Waku>({} as Waku);
  private wakuSubject = new ReplaySubject<Waku>();
  public waku = this.wakuSubject.asObservable();

  private wakuStatusSubject = new ReplaySubject<string>();
  public wakuStatus = this.wakuStatusSubject.asObservable();

  constructor() { }

  init() {
    Waku.create({ bootstrap: { default: true } }).then(waku => {
      this.wakuSubject.next(waku);
      this.wakuStatusSubject.next('Connecting...');

      waku.waitForRemotePeer().then(() => {
        this.wakuStatusSubject.next('Connected');
      });
    });
  }
}
