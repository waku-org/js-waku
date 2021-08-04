import './App.css';
import { getStatusFleetNodes, Waku } from 'js-waku';
import * as React from 'react';
import protons from 'protons';

const ContentTopic = '/toy-chat/2/huilong/proto';

const proto = protons(`
message ChatMessage {
  uint64 timestamp = 1;
  string nick = 2;
  bytes text = 3;
}
`);

function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState('None');
  const [messages, setMessages] = React.useState([]);

  React.useEffect(() => {
    if (!!waku) return;
    if (wakuStatus !== 'None') return;

    setWakuStatus('Starting');

    Waku.create().then((waku) => {
      setWaku(waku);
      setWakuStatus('Connecting');
      bootstrapWaku(waku).then(() => {
        setWakuStatus('Ready');
      });
    });
  }, [waku, wakuStatus]);

  React.useEffect(() => {
    if (!waku) return;

    const interval = setInterval(() => {
      waku.store
        .queryHistory([ContentTopic])
        .catch((e) => {
          // We may not be connected to a store node just yet
          console.log('Failed to retrieve messages', e);
        })
        .then((retrievedMessages) => {
          const messages = retrievedMessages.map(decodeMessage).filter(Boolean);

          setMessages(messages);
        });
    }, 10000);

    return () => clearInterval(interval);
  }, [waku]);

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

async function bootstrapWaku(waku) {
  const nodes = await getStatusFleetNodes();
  await Promise.all(nodes.map((addr) => waku.dial(addr)));
}

function decodeMessage(wakuMessage) {
  if (!wakuMessage.payload) return;

  const { timestamp, nick, text } = proto.ChatMessage.decode(
    wakuMessage.payload
  );

  if (!timestamp) return;
  if (!text) return;

  const time = new Date();
  time.setTime(timestamp);

  const utf8Text = Buffer.from(text).toString('utf-8');

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
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}
