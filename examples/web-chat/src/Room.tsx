import { ChatMessage, WakuMessage } from 'js-waku';
import { ChatContentTopic } from './App';
import ChatList from './ChatList';
import MessageInput from './MessageInput';
import { useWaku } from './WakuContext';
import { TitleBar } from '@livechat/ui-kit';
import { Message } from './Message';

interface Props {
  newMessages: Message[];
  archivedMessages: Message[];
  commandHandler: (cmd: string) => void;
  nick: string;
}

export default function Room(props: Props) {
  const { waku } = useWaku();

  return (
    <div
      className="chat-container"
      style={{ height: '98vh', display: 'flex', flexDirection: 'column' }}
    >
      <TitleBar title="Waku v2 chat app" />
      <ChatList
        newMessages={props.newMessages}
        archivedMessages={props.archivedMessages}
      />
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
    const wakuMsg = WakuMessage.fromBytes(
      chatMessage.encode(),
      ChatContentTopic,
      timestamp
    );
    return messageSender(wakuMsg);
  }
}
