import React, { useState } from 'react';
import { ChatMessage } from 'waku-chat/chat_message';
import { WakuMessage } from 'waku/waku_message';
import { ChatContentTopic } from './App';
import ChatList from './ChatList';
import MessageInput from './MessageInput';
import { useWaku } from './WakuContext';

interface Props {
  lines: ChatMessage[];
  commandHandler: (cmd: string) => void;
  nick: string;
}

export default function Room(props: Props) {
  let [messageToSend, setMessageToSend] = useState<string>('');
  const { waku } = useWaku();

  return (
    <div
      className="chat-container"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <div className="chat-list" style={{ flexGrow: 1, overflow: 'scroll' }}>
        <ChatList messages={props.lines} />
      </div>
      <div className="chat-input" style={{ flexGrow: 0, height: '120px' }}>
        <MessageInput
          messageHandler={setMessageToSend}
          sendMessage={
            waku
              ? async () => {
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
    const chatMessage = new ChatMessage(new Date(), nick, message);
    const wakuMsg = WakuMessage.fromBytes(
      chatMessage.encode(),
      ChatContentTopic
    );
    return messageSender(wakuMsg);
  }
}
