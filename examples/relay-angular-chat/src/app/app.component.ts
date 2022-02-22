import { Component } from '@angular/core';
import { WakuService } from './waku.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent {

  title: string = 'relay-angular-chat';
  wakuStatus!: string;

  constructor(private wakuService: WakuService) {}
  
  ngOnInit(): void {
    this.wakuService.init();
    this.wakuService.wakuStatus.subscribe(wakuStatus => {
      this.wakuStatus = wakuStatus;
    });
  }
}
