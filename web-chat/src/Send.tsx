import React from 'react';
import { ChatMessage } from 'waku-chat/chat_message';
import { WakuMessage } from 'waku/waku_message';
import { ChatContentTopic } from './App';
import { useWaku } from './WakuContext';
import { Button } from '@material-ui/core';

interface Props {
  message: string
}

const Send = (props: Props) => {
  const { waku } = useWaku();

  const handleClick = async () => {
    const chatMessage = new ChatMessage(new Date(), 'web-chat', props.message);

    const wakuMsg = WakuMessage.fromBytes(chatMessage.encode(), ChatContentTopic);
    await waku!.relay.send(wakuMsg);
  };

  return (
    <Button variant="contained" color="primary" size="large" onClick={handleClick}>
      Send
    </Button>
  );
};

export default Send;
