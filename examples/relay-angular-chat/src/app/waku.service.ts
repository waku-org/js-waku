import { Injectable } from '@angular/core';
import { Waku } from 'js-waku';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WakuService {

  private wakuSubject = new Subject<Waku>();
  public waku = this.wakuSubject.asObservable();

  private wakuStatusSubject = new BehaviorSubject('');
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
