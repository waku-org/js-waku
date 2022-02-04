import { memo, useEffect, useRef } from "react";
import {
  Message as LiveMessage,
  MessageText,
  MessageList,
} from "@livechat/ui-kit";
import { Message } from "./Message";

interface Props {
  messages: Message[];
}

memo(ChatList);

export default function ChatList(props: Props) {
  const renderedMessages = props.messages.map((message) => (
    <LiveMessage
      key={
        message.sentTimestamp
          ? message.sentTimestamp.valueOf()
          : "" +
            message.timestamp.valueOf() +
            message.nick +
            message.payloadAsUtf8
      }
      authorName={message.nick}
      date={formatDisplayDate(message)}
    >
      <MessageText>{message.payloadAsUtf8}</MessageText>
    </LiveMessage>
  ));

  return (
    <MessageList active containScrollInSubtree>
      {renderedMessages}
      <AlwaysScrollToBottom messages={props.messages} />
    </MessageList>
  );
}

function formatDisplayDate(message: Message): string {
  return message.timestamp.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
}

const AlwaysScrollToBottom = (props: { messages: Message[] }) => {
  const elementRef = useRef<HTMLDivElement>();

  useEffect(() => {
    // @ts-ignore
    elementRef.current.scrollIntoView();
  }, [props.messages]);

  // @ts-ignore
  return <div ref={elementRef} />;
};
