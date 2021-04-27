import { multiaddr } from 'multiaddr';
import PeerId from 'peer-id';
import React, { useEffect, useState } from 'react';
import './App.css';
import { ChatMessage } from 'waku-chat/chat_message';
import { WakuMessage } from 'waku/waku_message';
import { RelayDefaultTopic } from 'waku/waku_relay';
import handleCommand from './command';
import Room from './Room';
import Waku from 'waku/waku';
import { WakuContext } from './WakuContext';

export const ChatContentTopic = 'dingpu';

export default function App() {
  let [stateMessages, setMessages] = useState<ChatMessage[]>([]);
  let [stateWaku, setWaku] = useState<Waku | undefined>(undefined);
  let [nick, setNick] = useState<string>('web-chat');

  useEffect(() => {
    async function initWaku() {
      try {
        const waku = await Waku.create({
          config: {
            pubsub: {
              enabled: true,
              emitSelf: true,
            },
          },
        });

        setWaku(waku);

        // FIXME: Connect to a go-waku instance by default, temporary hack until
        //  we have a go-waku instance in the fleet
        waku.libp2p.peerStore.addressBook.add(
          PeerId.createFromB58String(
            '16Uiu2HAmVVi6Q4j7MAKVibquW8aA27UNrA4Q8Wkz9EetGViu8ZF1'
          ),
          [multiaddr('/ip4/134.209.113.86/tcp/9001/ws')]
        );
      } catch (e) {
        console.log('Issue starting waku ', e);
      }
    }

    const handleNewMessages = (event: { data: Uint8Array }) => {
      const wakuMsg = WakuMessage.decode(event.data);
      if (wakuMsg.payload) {
        const chatMsg = ChatMessage.decode(wakuMsg.payload);
        const messages = stateMessages.slice();
        messages.push(chatMsg);
        console.log('setState on ', messages);
        setMessages(messages);
      }
    };

    if (!stateWaku) {
      initWaku()
        .then(() => console.log('Waku init done'))
        .catch((e) => console.log('Waku init failed ', e));
    } else {
      stateWaku.libp2p.pubsub.on(RelayDefaultTopic, handleNewMessages);

      // To clean up listener when component unmounts
      return () => {
        stateWaku?.libp2p.pubsub.removeListener(
          RelayDefaultTopic,
          handleNewMessages
        );
      };
    }
  });

  return (
    <div className="chat-app">
      <WakuContext.Provider value={{ waku: stateWaku }}>
        <Room
          nick={nick}
          lines={stateMessages}
          commandHandler={(input: string) => {
            const { command, response } = handleCommand(
              input,
              stateWaku,
              setNick
            );
            const messages = stateMessages.slice();
            response.forEach((msg) => {
              messages.push(new ChatMessage(new Date(), command, msg));
            });
            setMessages(messages);
          }}
        />
      </WakuContext.Provider>
    </div>
  );
}
