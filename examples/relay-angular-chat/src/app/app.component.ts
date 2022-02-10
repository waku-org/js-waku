import { Component } from '@angular/core';
import { Waku, WakuMessage } from 'js-waku';
import protons from "protons";

const proto = protons(`
message SimpleChatMessage {
  uint64 timestamp = 1;
  string text = 2;
}
`);

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})

export class AppComponent {
  
  contentTopic: string = `/relay-angular-chat/1/chat/proto`;
  title: string = 'relay-angular-chat';
  // TODO: Probably better to create a Message interface and use that type here rather than any.
  messages: any[] = [];
  messageCount: number = 0;
  // TODO: The other ignores are because of this. the Waku type isn't being picked up for some reason.
  // hacked around it with this dirty empty object for now
  waku = {};
  wakuStatus: string = 'None';

  ngOnInit(): void {
    Waku.create({ bootstrap: { default: true } }).then((waku) => {
      this.wakuStatus = 'Connecting...'
      
      waku.waitForRemotePeer().then(() => {
        this.wakuStatus = 'Connected';
        this.waku = waku;
        // @ts-ignore: As this uses an object _on_ the waku object, TS moans. Properly imported type should fix it
        this.waku.relay.addObserver(this.processIncomingMessages, [this.contentTopic]);
      });
    });
  }

  processIncomingMessages = (wakuMessage: WakuMessage) => {
    // Empty message?
    if (!wakuMessage.payload) return;

    // Decode the protobuf payload
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

    // Encode to protobuf
    const payload = proto.SimpleChatMessage.encode({
      timestamp: time,
      text: message,
    });

    // Wrap in a Waku Message
    return WakuMessage.fromBytes(payload, this.contentTopic).then((wakuMessage) => {
      // Send over Waku Relay
      // @ts-ignore: As this uses an object _on_ the waku object, TS moans. Properly imported type should fix it
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
