import { WakuMessage } from 'js-waku';
import { ChatContentTopic } from './App';
import ChatList from './ChatList';
import MessageInput from './MessageInput';
import { useWaku } from './WakuContext';
import { TitleBar } from '@livechat/ui-kit';
import { Message } from './Message';
import { ChatMessage } from './chat_message';
import { useEffect, useState } from 'react';
import PeerId from 'peer-id';

interface Props {
  messages: Message[];
  commandHandler: (cmd: string) => void;
  nick: string;
}

export default function Room(props: Props) {
  const { waku } = useWaku();

  const [peers, setPeers] = useState<PeerId[]>([]);
  const [storePeers, setStorePeers] = useState(0);
  const [relayPeers, setRelayPeers] = useState(0);

  useEffect(() => {
    // Add a peer to the list every time a connection happen to ensure the stats update correctly
    if (!waku) return;

    const addPeer = (event: { peerId: PeerId }) => {
      setPeers((peers) => {
        return [...peers, event.peerId];
      });
    };

    waku.libp2p.peerStore.on('change:protocols', addPeer);

    return () => {
      waku.libp2p.connectionManager.removeListener('change:protocols', addPeer);
    };
  }, [waku]);

  useEffect(() => {
    if (!waku) return;

    setRelayPeers(waku.relay.getPeers().size);

    (async () => {
      let counter = 0;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _peer of waku.store.peers) {
        counter++;
      }
      setStorePeers(counter);
    })();
  }, [waku, peers]);

  return (
    <div
      className="chat-container"
      style={{ height: '98vh', display: 'flex', flexDirection: 'column' }}
    >
      <TitleBar
        leftIcons={[`Peers: ${relayPeers} relay ${storePeers} store.`]}
        title="Waku v2 chat app"
      />
      <ChatList messages={props.messages} />
      <MessageInput
        sendMessage={
          waku
            ? async (messageToSend) => {
                return handleMessage(
                  messageToSend,
                  props.nick,
                  props.commandHandler,
                  waku.relay.send.bind(waku.relay)
                );
              }
            : undefined
        }
      />
    </div>
  );
}

async function handleMessage(
  message: string,
  nick: string,
  commandHandler: (cmd: string) => void,
  messageSender: (msg: WakuMessage) => Promise<void>
) {
  if (message.startsWith('/')) {
    commandHandler(message);
  } else {
    const timestamp = new Date();
    const chatMessage = ChatMessage.fromUtf8String(timestamp, nick, message);
    const wakuMsg = await WakuMessage.fromBytes(
      chatMessage.encode(),
      ChatContentTopic,
      { timestamp }
    );
    return messageSender(wakuMsg);
  }
}
