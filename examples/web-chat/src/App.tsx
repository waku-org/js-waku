import { multiaddr } from 'multiaddr';
import PeerId from 'peer-id';
import { useEffect, useState } from 'react';
import './App.css';
import { ChatMessage } from './ChatMessage';
import { ChatMessage as WakuChatMessage } from 'waku/chat_message';
import { WakuMessage } from 'waku/waku_message';
import { StoreCodec } from 'waku/waku_store';
import handleCommand from './command';
import Room from './Room';
import Waku from 'waku/waku';
import { WakuContext } from './WakuContext';
import { ThemeProvider } from '@livechat/ui-kit';
import { generate } from 'server-name-generator';

const themes = {
  AuthorName: {
    css: {
      fontSize: '1.1em',
    },
  },
  Message: {
    css: {
      margin: '0em',
      padding: '0em',
      fontSize: '0.83em',
    },
  },
  MessageText: {
    css: {
      margin: '0em',
      padding: '0.1em',
      paddingLeft: '1em',
      fontSize: '1.1em',
    },
  },
  MessageGroup: {
    css: {
      margin: '0em',
      padding: '0.2em',
    },
  },
};

export const ChatContentTopic = 'dingpu';

export default function App() {
  let [newMessages, setNewMessages] = useState<ChatMessage[]>([]);
  let [archivedMessages, setArchivedMessages] = useState<ChatMessage[]>([]);
  let [stateWaku, setWaku] = useState<Waku | undefined>(undefined);
  let [nick, setNick] = useState<string>(generate());

  useEffect(() => {
    const handleRelayMessage = (wakuMsg: WakuMessage) => {
      if (wakuMsg.payload) {
        const chatMsg = ChatMessage.fromWakuChatMessage(
          WakuChatMessage.decode(wakuMsg.payload)
        );
        if (chatMsg) {
          setNewMessages([chatMsg]);
        }
      }
    };

    const handleProtocolChange = async (
      waku: Waku,
      { peerId, protocols }: { peerId: PeerId; protocols: string[] }
    ) => {
      if (protocols.includes(StoreCodec)) {
        console.log(`${peerId.toB58String()}: retrieving archived messages}`);
        try {
          const response = await waku.store.queryHistory(peerId, [
            ChatContentTopic,
          ]);
          console.log(`${peerId.toB58String()}: messages retrieved:`, response);
          if (response) {
            const messages = response
              .map((wakuMsg) => wakuMsg.payload)
              .filter((payload) => !!payload)
              .map((payload) => WakuChatMessage.decode(payload as Uint8Array))
              .map((wakuChatMessage) =>
                ChatMessage.fromWakuChatMessage(wakuChatMessage)
              );
            setArchivedMessages(messages);
          }
        } catch (e) {
          console.log(
            `${peerId.toB58String()}: error encountered when retrieving archived messages`,
            e
          );
        }
      }
    };

    if (!stateWaku) {
      initWaku(setWaku)
        .then(() => console.log('Waku init done'))
        .catch((e) => console.log('Waku init failed ', e));
    } else {
      stateWaku.relay.addObserver(handleRelayMessage);

      stateWaku.libp2p.peerStore.on(
        'change:protocols',
        handleProtocolChange.bind({}, stateWaku)
      );

      // To clean up listener when component unmounts
      return () => {
        stateWaku?.libp2p.peerStore.removeListener(
          'change:protocols',
          handleProtocolChange.bind({}, stateWaku)
        );
      };
    }
  }, [stateWaku]);

  return (
    <div
      className="chat-app"
      style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}
    >
      <WakuContext.Provider value={{ waku: stateWaku }}>
        <ThemeProvider theme={themes}>
          <Room
            nick={nick}
            newMessages={newMessages}
            archivedMessages={archivedMessages}
            commandHandler={(input: string) => {
              const { command, response } = handleCommand(
                input,
                stateWaku,
                setNick
              );
              const commandMessages = response.map((msg) => {
                return new ChatMessage(new Date(), new Date(), command, msg);
              });
              setNewMessages(commandMessages);
            }}
          />
        </ThemeProvider>
      </WakuContext.Provider>
    </div>
  );
}

async function initWaku(setter: (waku: Waku) => void) {
  try {
    const waku = await Waku.create({
      config: {
        pubsub: {
          enabled: true,
          emitSelf: true,
        },
      },
    });

    setter(waku);

    waku.libp2p.peerStore.addressBook.add(
      PeerId.createFromB58String(
        '16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ'
      ),
      [multiaddr('/dns4/node-01.do-ams3.jdev.misc.statusim.net/tcp/7010/wss')]
    );
    waku.libp2p.peerStore.addressBook.add(
      PeerId.createFromB58String(
        '16Uiu2HAmSyrYVycqBCWcHyNVQS6zYQcdQbwyov1CDijboVRsQS37'
      ),
      [multiaddr('/dns4/node-01.do-ams3.jdev.misc.statusim.net/tcp/7009/wss')]
    );
  } catch (e) {
    console.log('Issue starting waku ', e);
  }
}
