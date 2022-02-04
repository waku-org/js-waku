import React from "react";
import { List, ListItem, ListItemText } from "@material-ui/core";

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

export default function Messages({ messages }: Props) {
  return <List dense={true}>{generate(messages)}</List>;
}

function generate(messages: Message[]) {
  return messages.map((msg) => {
    const text = `<${formatDisplayDate(msg.timestamp)}> ${msg.text}`;

    return (
      <ListItem>
        <ListItemText key={formatDisplayDate(msg.timestamp)} primary={text} />
      </ListItem>
    );
  });
}

function formatDisplayDate(timestamp: Date): string {
  return timestamp.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
}
