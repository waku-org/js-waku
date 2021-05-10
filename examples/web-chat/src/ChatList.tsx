import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from 'waku';
import {
  Message,
  MessageText,
  MessageGroup,
  MessageList,
} from '@livechat/ui-kit';

interface Props {
  archivedMessages: ChatMessage[];
  newMessages: ChatMessage[];
}

export default function ChatList(props: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  let updatedMessages;

  if (IsThereNewMessages(props.newMessages, messages)) {
    updatedMessages = messages.slice().concat(props.newMessages);
    if (IsThereNewMessages(props.archivedMessages, updatedMessages)) {
      updatedMessages = copyMergeUniqueReplace(
        props.archivedMessages,
        updatedMessages
      );
    }
  } else {
    if (IsThereNewMessages(props.archivedMessages, messages)) {
      updatedMessages = copyMergeUniqueReplace(
        props.archivedMessages,
        messages
      );
    }
  }

  if (updatedMessages) {
    setMessages(updatedMessages);
  }

  const messagesGroupedBySender = groupMessagesBySender(messages).map(
    (currentMessageGroup) => (
      <MessageGroup onlyFirstWithMeta>
        {currentMessageGroup.map((currentMessage) => (
          <Message
            key={
              currentMessage.timestamp.valueOf() +
              currentMessage.nick +
              currentMessage.payloadAsUtf8
            }
            authorName={currentMessage.nick}
            date={formatDisplayDate(currentMessage)}
          >
            <MessageText>{currentMessage.payloadAsUtf8}</MessageText>
          </Message>
        ))}
      </MessageGroup>
    )
  );

  return (
    <MessageList active containScrollInSubtree>
      {messagesGroupedBySender}
      <AlwaysScrollToBottom newMessages={props.newMessages} />
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

const AlwaysScrollToBottom = (props: { newMessages: ChatMessage[] }) => {
  const elementRef = useRef<HTMLDivElement>();

  useEffect(() => {
    // @ts-ignore
    elementRef.current.scrollIntoView();
  }, [props.newMessages]);

  // @ts-ignore
  return <div ref={elementRef} />;
};

function IsThereNewMessages(
  newValues: ChatMessage[],
  currentValues: ChatMessage[]
): boolean {
  if (newValues.length === 0) return false;
  if (currentValues.length === 0) return true;

  return !newValues.find((newMsg) =>
    currentValues.find(isEqual.bind({}, newMsg))
  );
}

function copyMergeUniqueReplace(
  newValues: ChatMessage[],
  currentValues: ChatMessage[]
) {
  const copy = currentValues.slice();
  newValues.forEach((msg) => {
    if (!copy.find(isEqual.bind({}, msg))) {
      copy.push(msg);
    }
  });
  copy.sort((a, b) => a.timestamp.valueOf() - b.timestamp.valueOf());
  return copy;
}

function isEqual(lhs: ChatMessage, rhs: ChatMessage): boolean {
  return (
    lhs.nick === rhs.nick &&
    lhs.payloadAsUtf8 === rhs.payloadAsUtf8 &&
    lhs.timestamp.toString() === rhs.timestamp.toString()
  );
}
