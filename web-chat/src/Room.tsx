import { List, ListItem, ListItemText } from '@material-ui/core';
import React, { useState } from 'react';
import { ChatMessage } from 'waku-chat/chat_message';
import { WakuMessage } from 'waku/waku_message';
import { ChatContentTopic } from './App';
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
        <Lines messages={props.lines} />
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

interface LinesProps {
  messages: ChatMessage[];
}

const Lines = (props: LinesProps) => {
  const renderedLines = [];

  for (const i in props.messages) {
    renderedLines.push(
      <ListItem>
        <ListItemText
          key={'chat-message-' + i}
          primary={printMessage(props.messages[i])}
        />
      </ListItem>
    );
  }

  return <List dense={true}>{renderedLines}</List>;
};

// TODO: Make it a proper component
function printMessage(chatMsg: ChatMessage) {
  const timestamp = chatMsg.timestamp.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  return `<${timestamp}> ${chatMsg.nick}: ${chatMsg.message}`;
}
