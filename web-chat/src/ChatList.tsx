import {
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@material-ui/core';
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

  // {`<${timestamp}> ${chatMsg.nick}: ${chatMsg.message}`}
  return (
    <Card className="chat-message" variant="outlined">
      <CardContent>
        <Typography className="chat-nick" variant="subtitle2">
          {chatMsg.nick}
          <Typography
            className="chat-timestamp"
            color="textSecondary"
            variant="caption"
            style={{ marginLeft: 3 }}
          >
            {timestamp}
          </Typography>
        </Typography>
        <Typography
          className="chat-message-content"
          variant="body1"
          component="p"
        >
          {chatMsg.message}
        </Typography>
      </CardContent>
    </Card>
  );
}
