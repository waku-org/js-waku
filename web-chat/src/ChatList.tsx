import { useEffect, useRef } from 'react';
import { ChatMessage } from '../../build/main/chat/chat_message';
import {
  Message,
  MessageText,
  MessageGroup,
  MessageList,
} from '@livechat/ui-kit';

interface Props {
  messages: ChatMessage[];
}

export default function ChatList(props: Props) {
  const messages = props.messages;

  const messagesGroupedBySender = groupMessagesBySender(props.messages).map(
    (currentMessageGroup) => (
      <MessageGroup onlyFirstWithMeta>
        {currentMessageGroup.map((currentMessage) => (
          <Message
            // We assume that the same user is not sending two messages in the same second
            key={currentMessage.timestamp.toString() + currentMessage.nick}
            authorName={currentMessage.nick}
            date={formatDisplayDate(currentMessage)}
          >
            <MessageText>{currentMessage.message}</MessageText>
          </Message>
        ))}
      </MessageGroup>
    )
  );

  return (
    <MessageList active containScrollInSubtree>
      {messagesGroupedBySender}
      <AlwaysScrollToBottom messages={messages} />
    </MessageList>
  );
}

function groupMessagesBySender(messageArray: ChatMessage[]): ChatMessage[][] {
  let currentSender = -1;
  let lastNick = '';
  let messagesBySender: ChatMessage[][] = [];
  let currentSenderMessage = 0;

  for (let currentMessage of messageArray) {
    if (lastNick !== currentMessage.nick) {
      currentSender++;
      messagesBySender[currentSender] = [];
      currentSenderMessage = 0;
      lastNick = currentMessage.nick;
    }
    messagesBySender[currentSender][currentSenderMessage++] = currentMessage;
  }
  return messagesBySender;
}

function formatDisplayDate(message: ChatMessage): string {
  return message.timestamp.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
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
