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

  const commandHandler = (input: string) => {
    let commandResponses: string[] = [];
    const args = input.split(' ');
    const cmd = args.shift()!;
    if (!stateWaku) {
      commandResponses.push('Waku is not yet initialized');
    } else {
      switch (cmd) {
        case '/help':
          commandResponses.push('/nick <nickname>: set a new nickname');
          commandResponses.push('/info: some information about the node');
          commandResponses.push(
            '/connect <Multiaddr>: connect to the given peer'
          );
          commandResponses.push('/help: Display this help');
          break;
        case '/nick':
          const arg = args.shift();
          if (!arg) {
            commandResponses.push('No nick provided');
          } else {
            setNick(arg);
            commandResponses.push(`New nick: ${arg}`);
          }
          break;
        case '/info':
          if (!stateWaku) {
            commandResponses.push(`Waku node is starting`);
          } else {
            commandResponses.push(
              `PeerId: ${stateWaku.libp2p.peerId.toB58String()}`
            );
          }
          break;
        case '/connect':
          const peer = args.shift();
          if (!peer) {
            commandResponses.push('No peer provided');
          } else {
            try {
              const peerMultiaddr = multiaddr(peer);
              const peerId = peerMultiaddr.getPeerId();
              if (!peerId) {
                commandResponses.push('Peer Id needed to dial');
              } else {
                stateWaku.libp2p.peerStore.addressBook.add(
                  PeerId.createFromB58String(peerId),
                  [peerMultiaddr]
                );
              }
            } catch (e) {
              commandResponses.push('Invalid multaddr: ' + e);
            }
          }
          break;
        case '/peers':
          stateWaku.libp2p.peerStore.peers.forEach((peer, peerId) => {
            commandResponses.push(peerId + ':');
            let addresses = '  addresses: [';
            peer.addresses.forEach(({ multiaddr }) => {
              addresses += ' ' + multiaddr.toString() + ',';
            });
            addresses = addresses.replace(/,$/, '');
            addresses += ']';
            commandResponses.push(addresses);
            let protos = '  protos: [';
            protos += peer.protocols;
            protos += ']';
            commandResponses.push(protos);
          });
          break;
        default:
          commandResponses.push('Unknown Command');
      }
    }
    const messages = stateMessages.slice();
    commandResponses.forEach((res) => {
      messages.push(new ChatMessage(new Date(), cmd, res));
    });
    setMessages(messages);
  };

  return (
    <div className="App">
      <div className="chat-room">
        <WakuContext.Provider value={{ waku: stateWaku }}>
          <Paper>
            <Room
              nick={nick}
              lines={stateMessages}
              commandHandler={commandHandler}
            />
          </Paper>
        </WakuContext.Provider>
      </div>
    </div>
  );
}
