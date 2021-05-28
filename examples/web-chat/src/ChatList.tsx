import { useEffect, useRef, useState } from 'react';
import {
  Message as LiveMessage,
  MessageText,
  MessageGroup,
  MessageList,
} from '@livechat/ui-kit';
import { Message } from './Message';

interface Props {
  archivedMessages: Message[];
  newMessages: Message[];
}

export default function ChatList(props: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupedMessages, setGroupedMessages] = useState<Message[][]>([]);
  let updatedMessages;

  if (IsThereNewMessages(props.newMessages, messages)) {
    updatedMessages = messages.concat(props.newMessages);
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
    setGroupedMessages(groupMessagesBySender(updatedMessages));
    setMessages(updatedMessages);
  }

  const renderedGroupedMessages = groupedMessages.map((currentMessageGroup) => (
    <MessageGroup onlyFirstWithMeta>
      {currentMessageGroup.map((currentMessage) => (
        <LiveMessage
          key={
            currentMessage.sentTimestamp
              ? currentMessage.sentTimestamp.valueOf()
              : '' +
                currentMessage.timestamp.valueOf() +
                currentMessage.nick +
                currentMessage.payloadAsUtf8
          }
          authorName={currentMessage.nick}
          date={formatDisplayDate(currentMessage)}
        >
          <MessageText>{currentMessage.payloadAsUtf8}</MessageText>
        </LiveMessage>
      ))}
    </MessageGroup>
  ));

  return (
    <MessageList active containScrollInSubtree>
      {renderedGroupedMessages}
      <AlwaysScrollToBottom newMessages={props.newMessages} />
    </MessageList>
  );
}

function groupMessagesBySender(messageArray: Message[]): Message[][] {
  let currentSender = -1;
  let lastNick = '';
  let messagesBySender: Message[][] = [];
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

function formatDisplayDate(message: Message): string {
  return message.timestamp.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}

const AlwaysScrollToBottom = (props: { newMessages: Message[] }) => {
  const elementRef = useRef<HTMLDivElement>();

  useEffect(() => {
    // @ts-ignore
    elementRef.current.scrollIntoView();
  }, [props.newMessages]);

  // @ts-ignore
  return <div ref={elementRef} />;
};

function IsThereNewMessages(
  newValues: Message[],
  currentValues: Message[]
): boolean {
  if (newValues.length === 0) return false;
  if (currentValues.length === 0) return true;

  return !newValues.find((newMsg) =>
    currentValues.find(isEqual.bind({}, newMsg))
  );
}

function copyMergeUniqueReplace(
  newValues: Message[],
  currentValues: Message[]
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

function isEqual(lhs: Message, rhs: Message): boolean {
  return (
    lhs.nick === rhs.nick &&
    lhs.payloadAsUtf8 === rhs.payloadAsUtf8 &&
    lhs.timestamp.valueOf() === rhs.timestamp.valueOf() &&
    lhs.sentTimestamp?.valueOf() === rhs.sentTimestamp?.valueOf()
  );
}
