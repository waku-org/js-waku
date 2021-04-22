import { Paper } from '@material-ui/core';
import { multiaddr } from 'multiaddr';
import PeerId from 'peer-id';
import React, { useEffect, useState } from 'react';
import './App.css';
import { ChatMessage } from 'waku-chat/chat_message';
import { WakuMessage } from 'waku/waku_message';
import { RelayDefaultTopic } from 'waku/waku_relay';
import Room from './Room';
import Waku from 'waku/waku';
import { WakuContext } from './WakuContext';

export const ChatContentTopic = 'dingpu';

interface State {
  messages: ChatMessage[],
  waku?: Waku
}

export default function App() {
  let [state, setState] = useState<State>({ messages: [] });


  useEffect(() => {
    async function initWaku() {
      try {
        const waku = await Waku.create({});

        setState(({ messages }) => {
          return {waku, messages};
        });

        waku.libp2p.peerStore.addressBook.add(
          PeerId.createFromB58String('QmbEnEniueE2Cetej6UkYAtvHuXuare4fSEeyvm43kdmfq'),
          [multiaddr('/ip4/127.0.0.1/tcp/7777/ws')]);
      } catch (e) {
        console.log('Issue starting waku ', e);
      }

    }

    if (!state.waku) {
      initWaku()
        .then(() => console.log('Waku init done'))
        .catch((e) => console.log('Waku init failed ', e));
    } else {
      state.waku.libp2p.pubsub.on(RelayDefaultTopic, (event) => {
        const wakuMsg = WakuMessage.decode(event.data);
        if (wakuMsg.payload) {
          const chatMsg = ChatMessage.decode(wakuMsg.payload);
          const messages = state.messages.slice();
          messages.push(chatMsg);
          console.log("setState on ", messages);
          setState({ messages, waku:  state.waku });
        }
      });
    }
  });

  return (
    <div className='App'>
      <div className='chat-room'>
        <WakuContext.Provider value={{ waku: state.waku }}>
          <Paper>
            <Room lines={state.messages} />
          </Paper>
        </WakuContext.Provider>
      </div>
    </div>
  );
}
