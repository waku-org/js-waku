import { Component } from '@angular/core';
import { Waku, WakuMessage } from 'js-waku';
import protons from "protons";

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
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent {
  
  contentTopic: string = `/relay-angular-chat/1/chat/proto`;
  messages: MessageInterface[] = [];
  messageCount: number = 0;
  title: string = 'relay-angular-chat';
  waku!: Waku;
  wakuStatus: string = 'None';

  ngOnInit(): void {
    Waku.create({ bootstrap: { default: true } }).then((waku) => {
      this.wakuStatus = 'Connecting...'
      
      waku.waitForRemotePeer().then(() => {
        this.wakuStatus = 'Connected';
        this.waku = waku;

        this.waku.relay.addObserver(this.processIncomingMessages, [this.contentTopic]);
      });
    });

    window.onbeforeunload = () => this.ngOnDestroy();
    
  }
  
  ngOnDestroy(): void {
    this.waku.relay.deleteObserver(this.processIncomingMessages, [this.contentTopic]);
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

  send(message: string, waku: object, timestamp: Date) {
    const time = timestamp.getTime();

    const payload = proto.SimpleChatMessage.encode({
      timestamp: time,
      text: message,
    });

    return WakuMessage.fromBytes(payload, this.contentTopic).then((wakuMessage) => {
      this.waku.relay.send(wakuMessage);
    });
  }
  
  sendMessageOnClick(): void {
    this.send(`Here is a message #${this.messageCount}`, this.waku, new Date()).then(() => {
      console.log(`Message #${this.messageCount} sent`);
      this.messageCount += 1;
    });
  }
}
