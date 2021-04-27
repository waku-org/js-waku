import { List, ListItem, ListItemText } from '@material-ui/core';
import React from 'react';
import { ChatMessage } from '../../build/main/chat/chat_message';

interface Props {
  messages: ChatMessage[];
}

export default function ChatList(props: Props) {
  const messages = props.messages;

  const listItems = messages.map((message) => (
    <ListItem key={message.timestamp.toString()}>
      <ListItemText primary={<Message message={message} />} />
    </ListItem>
  ));

  return <List dense={true}>{listItems}</List>;
}

interface MessageProps {
  message: ChatMessage;
}

function Message(props: MessageProps) {
  const chatMsg = props.message;
  const timestamp = chatMsg.timestamp.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  return (
    <div className="chat-message">
      {`<${timestamp}> ${chatMsg.nick}: ${chatMsg.message}`}
    </div>
  );
}
