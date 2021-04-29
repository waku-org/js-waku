import { useEffect, useRef } from 'react';
import { ChatMessage } from '../../build/main/chat/chat_message';
import { Message, MessageText, MessageGroup } from '@livechat/ui-kit';

interface Props {
  messages: ChatMessage[];
}

export default function ChatList(props: Props) {
  const messages = props.messages;

  const listItems = messages.map((currentMessage) => (
    <Message
      key={currentMessage.timestamp.toString()}
      authorName={currentMessage.nick}
      date={formatDisplayDate(currentMessage)}
    >
      <MessageText>{currentMessage.message}</MessageText>
    </Message>
  ));

  return (
    <MessageGroup>
      {listItems}
      <AlwaysScrollToBottom messages={messages} />
    </MessageGroup>
  );

  function formatDisplayDate(message: ChatMessage) {
    return message.timestamp.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
    });
  }
}

const AlwaysScrollToBottom = (props: Props) => {
  const elementRef = useRef<HTMLDivElement>();

  useEffect(() => {
    // @ts-ignore
    elementRef.current.scrollIntoView();
  }, [props.messages]);

  // @ts-ignore
  return <div ref={elementRef} />;
};
