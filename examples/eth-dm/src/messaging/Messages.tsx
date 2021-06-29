/**
 * Clear text message
 */
export interface Message {
  text: string;
  timestamp: Date;
}

export interface Props {
  messages: Message[];
}

export default function Messages(props: Props) {
  const messages = props.messages.map((msg) => {
    return (
      <li>
        {formatDisplayDate(msg.timestamp)} {msg.text}
      </li>
    );
  });

  return <ul>{messages}</ul>;
}

function formatDisplayDate(timestamp: Date): string {
  return timestamp.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}
