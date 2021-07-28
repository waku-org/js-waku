import './App.css';
import { getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';
import * as React from 'react';
import protons from 'protons';

const ContentTopic = `/relay-guide/1/chat/proto`;

const initialMessageState = {
  messages: [],
};

const proto = protons(`
message SimpleChatMessage {
  float timestamp = 1;
  string text = 2;
}
`);

function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState('NotStarted');
  const [messagesState, dispatchMessages] = React.useReducer(
    reduceMessages,
    initialMessageState
  );

  React.useEffect(() => {
    if (!!waku) return;
    if (wakuStatus !== 'NotStarted') return;

    setWakuStatus('Starting');

    Waku.create().then((waku) => {
      setWaku(waku);
      setWakuStatus('Connecting');
      bootstrapWaku(waku).then(() => {
        setWakuStatus('Ready');
      });
    });
  }, [waku, wakuStatus]);

  // Need to keep the same reference around to add and delete from relay observer
  const processIncomingMessage = React.useCallback((wakuMessage) => {
    if (!wakuMessage.payload) return;

    const { timestamp, text } = proto.SimpleChatMessage.decode(
      wakuMessage.payload
    );

    dispatchMessages({
      type: 'Add',
      message: {
        timestamp: new Date(timestamp),
        text,
      },
    });
  }, []);

  React.useEffect(() => {
    if (!waku) return;

    waku.relay.addObserver(processIncomingMessage, [ContentTopic]);

    return function cleanUp() {
      waku.relay.deleteObserver(processIncomingMessage, [ContentTopic]);
    };
  }, [waku, wakuStatus, processIncomingMessage]);

  const sendMessageOnClick = () => {
    if (wakuStatus !== 'Ready') return;

    sendMessage('Here is a message', waku).then(() =>
      console.log('Message sent')
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <p>{wakuStatus}</p>
        <button onClick={sendMessageOnClick} disabled={wakuStatus !== 'Ready'}>
          Send Message
        </button>
        <ul>
          {messagesState.messages.map((msg) => {
            return (
              <li>
                <p>
                  {msg.timestamp.toString()}: {msg.text}
                </p>
              </li>
            );
          })}
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

async function sendMessage(message, waku) {
  const payload = proto.SimpleChatMessage.encode({
    timestamp: Date.now(),
    text: message,
  });

  const wakuMessage = await WakuMessage.fromBytes(payload, ContentTopic);
  await waku.relay.send(wakuMessage);
}

function reduceMessages(state, action) {
  switch (action.type) {
    case 'Add':
      const messages = state.messages.slice();
      messages.push(action.message);
      return { ...state, messages };
    default:
      return state;
  }
}
