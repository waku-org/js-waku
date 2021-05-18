import PeerId from 'peer-id';
import { useEffect, useState } from 'react';
import './App.css';
import {
  ChatMessage,
  getStatusFleetNodes,
  Environment,
  StoreCodec,
  Waku,
  WakuMessage,
} from 'js-waku';
import handleCommand from './command';
import Room from './Room';
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

async function retrieveStoreMessages(
  waku: Waku,
  peerId: PeerId,
  setArchivedMessages: (value: ChatMessage[]) => void
): Promise<number> {
  const callback = (wakuMessages: WakuMessage[]): void => {
    const messages = wakuMessages
      .map((wakuMsg) => wakuMsg.payload)
      .filter((payload) => !!payload)
      .map((payload) => ChatMessage.decode(payload as Uint8Array));
    setArchivedMessages(messages);
  };

  const res = await waku.store.queryHistory({
    peerId,
    contentTopics: [ChatContentTopic],
    pageSize: 5,
    callback,
  });

  return res ? res.length : 0;
}

export default function App() {
  let [newMessages, setNewMessages] = useState<ChatMessage[]>([]);
  let [archivedMessages, setArchivedMessages] = useState<ChatMessage[]>([]);
  let [stateWaku, setWaku] = useState<Waku | undefined>(undefined);
  let [nick, setNick] = useState<string>(generate());

  useEffect(() => {
    const handleRelayMessage = (wakuMsg: WakuMessage) => {
      if (wakuMsg.payload) {
        const chatMsg = ChatMessage.decode(wakuMsg.payload);
        if (chatMsg) {
          setNewMessages([chatMsg]);
        }
      }
    };

    // TODO: Split this
    const handleProtocolChange = async (
      waku: Waku,
      { peerId, protocols }: { peerId: PeerId; protocols: string[] }
    ) => {
      if (protocols.includes(StoreCodec)) {
        console.log(`${peerId.toB58String()}: retrieving archived messages}`);
        try {
          const length = await retrieveStoreMessages(
            waku,
            peerId,
            setArchivedMessages
          );
          console.log(`${peerId.toB58String()}: messages retrieved:`, length);
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
      stateWaku.relay.addObserver(handleRelayMessage, [ChatContentTopic]);

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
                return ChatMessage.fromUtf8String(new Date(), command, msg);
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

    const nodes = await getNodes();
    await Promise.all(
      nodes.map((addr) => {
        return waku.dial(addr);
      })
    );
  } catch (e) {
    console.log('Issue starting waku ', e);
  }
}

function getNodes() {
  // Works with react-scripts
  if (process?.env?.NODE_ENV === 'development') {
    return getStatusFleetNodes(Environment.Test);
  } else {
    return getStatusFleetNodes(Environment.Prod);
  }
}
