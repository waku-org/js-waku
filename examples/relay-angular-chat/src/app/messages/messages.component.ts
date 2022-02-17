import { Component, OnInit } from '@angular/core';
import { WakuService } from '../waku.service';
import { Waku, WakuMessage } from 'js-waku';
import protons from 'protons';

const proto = protons(`
message SimpleChatMessage {
  uint64 timestamp = 1;
  string text = 2;
}
`);

interface MessageInterface {
  timestamp: Date,
  text: string
}

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.css']
})
export class MessagesComponent implements OnInit {

  contentTopic: string = `/relay-angular-chat/1/chat/proto`;
  messages: MessageInterface[] = [];
  messageCount: number = 0;
  waku!: Waku;
  wakuStatus!: string;

  constructor(private wakuService: WakuService) { }

  ngOnInit(): void {
    this.wakuService.wakuStatus.subscribe(wakuStatus => {
      this.wakuStatus = wakuStatus;
    });
    
    this.wakuService.waku.subscribe(waku => {
      this.waku = waku;
      this.waku.relay.addObserver(this.processIncomingMessages, [this.contentTopic]);
    });

    window.onbeforeunload = () => this.ngOnDestroy();
  }

  ngOnDestroy(): void {
    this.waku.relay.deleteObserver(this.processIncomingMessages, [this.contentTopic]);
  }

  sendMessage(): void {
    const time = new Date().getTime();

    const payload = proto.SimpleChatMessage.encode({
      timestamp: time,
      text: `Here is a message #${this.messageCount}`,
    });

    WakuMessage.fromBytes(payload, this.contentTopic).then(wakuMessage => {
      this.waku.relay.send(wakuMessage).then(() => {
        console.log(`Message #${this.messageCount} sent`);
        this.messageCount += 1;
      });
    });
  }

  processIncomingMessages = (wakuMessage: WakuMessage) => {
    if (!wakuMessage.payload) return;

    const { timestamp, text } = proto.SimpleChatMessage.decode(
      wakuMessage.payload
    );
    const time = new Date();
    time.setTime(timestamp);
    const message = { text, timestamp: time };

    this.messages.push(message);
  }
}
