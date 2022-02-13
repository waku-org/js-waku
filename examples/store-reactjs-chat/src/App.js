import { Waku } from "js-waku";
import * as React from "react";
import protons from "protons";

const ContentTopic = "/toy-chat/2/huilong/proto";

const proto = protons(`
message ChatMessage {
  uint64 timestamp = 1;
  string nick = 2;
  bytes text = 3;
}
`);

function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState("None");
  const [messages, setMessages] = React.useState([]);

  React.useEffect(() => {
    if (wakuStatus !== "None") return;

    setWakuStatus("Starting");

    Waku.create({ bootstrap: { default: true } }).then((waku) => {
      setWaku(waku);
      setWakuStatus("Connecting");
    });
  }, [waku, wakuStatus]);

  React.useEffect(() => {
    if (!waku) return;

    // We do not handle disconnection/re-connection in this example
    if (wakuStatus === "Connected") return;

    waku.waitForRemotePeer().then(() => {
      // We are now connected to a store node
      setWakuStatus("Connected");
    });
  }, [waku, wakuStatus]);

  React.useEffect(() => {
    if (wakuStatus !== "Connected") return;

    const processMessages = (retrievedMessages) => {
      const messages = retrievedMessages.map(decodeMessage).filter(Boolean);

      setMessages((currentMessages) => {
        return currentMessages.concat(messages.reverse());
      });
    };

    const startTime = new Date();
    // 7 days/week, 24 hours/day, 60min/hour, 60secs/min, 100ms/sec
    startTime.setTime(startTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    waku.store
      .queryHistory([ContentTopic], {
        callback: processMessages,
        timeFilter: { startTime, endTime: new Date() },
      })
      .catch((e) => {
        console.log("Failed to retrieve messages", e);
      });
  }, [waku, wakuStatus]);

  return (
    <div className="App">
      <header className="App-header">
        <h2>{wakuStatus}</h2>
        <h3>Messages</h3>
        <ul>
          <Messages messages={messages} />
        </ul>
      </header>
    </div>
  );
}

export default App;

function decodeMessage(wakuMessage) {
  if (!wakuMessage.payload) return;

  const { timestamp, nick, text } = proto.ChatMessage.decode(
    wakuMessage.payload
  );

  if (!timestamp || !text || !nick) return;

  const time = new Date();
  time.setTime(timestamp);

  const utf8Text = Buffer.from(text).toString("utf-8");

  return { text: utf8Text, timestamp: time, nick };
}

function Messages(props) {
  return props.messages.map(({ text, timestamp, nick }) => {
    return (
      <li>
        ({formatDate(timestamp)}) {nick}: {text}
      </li>
    );
  });
}

function formatDate(timestamp) {
  return timestamp.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
