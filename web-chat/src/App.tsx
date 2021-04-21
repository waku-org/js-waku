import { Paper } from '@material-ui/core';
import { multiaddr } from 'multiaddr';
import PeerId from 'peer-id';
import React from 'react';
import './App.css';
import { ChatMessage } from 'waku-chat/chat_message';
import { WakuMessage } from 'waku/waku_message';
import { RelayDefaultTopic } from 'waku/waku_relay';
import Room from './Room';
import Waku from 'waku/waku';
import { WakuContext } from './WakuContext';

export const ChatContentTopic = 'dingpu';

interface Props {
}

interface State {
  messages: string[],
  waku?: Waku
}

class App extends React.Component<Props, State> {
  waku?: Waku;

  constructor(props: Props) {
    super(props);

    this.state = {
      messages: []
    };

    Waku.create({}).then((waku) => {
      this.state = { waku: waku, messages: this.state.messages };

      waku.libp2p.peerStore.addressBook
        .add(PeerId.createFromB58String('QmUJKveCpfwA4cY1zRybMEt5z64FRtMHLFFQwndWrSfMmf'),
          [multiaddr('/ip4/127.0.0.1/tcp/7777/ws')]);

      waku.libp2p.pubsub.on(RelayDefaultTopic, (event) => {
        const wakuMsg = WakuMessage.decode(event.data);
        if (wakuMsg.payload) {
          const chatMsg = ChatMessage.decode(wakuMsg.payload);
          const msgStr = printMessage(chatMsg);

          const messages = this.state.messages.slice();
          messages.push(msgStr);
          this.setState({ messages });
        }

      });

      // Fire and forget
      // waku.dial('/ip4/127.0.0.1/tcp/7777/ws/p2p/QmUJKveCpfwA4cY1zRybMEt5z64FRtMHLFFQwndWrSfMmf').then(() => {
      //   console.log('Remote node dialed');
      // }).catch((e) => {
      //   console.log('Error when dialing peer ', e);
      // });
    }).catch((e) => {
      console.log('Error starting waku ', e);
    }).then(()=> {
      console.log("Waku is started");
    });
  }

  render() {
    return (
      <div className='App'>
        <div className='chat-room'>
          <WakuContext.Provider value={{ waku: this.state.waku }}>
            <Paper>
              <Room lines={this.state.messages} />
            </Paper>
          </WakuContext.Provider>
        </div>
      </div>
    );
  }
}

export default App;

// TODO: Make it a proper component
function printMessage(chatMsg: ChatMessage) {
  const timestamp = chatMsg.timestamp.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  });
  return `<${timestamp}> ${chatMsg.nick}: ${chatMsg.message}`;
}
