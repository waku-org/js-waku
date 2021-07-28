import './App.css';
import { getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';
import * as React from 'react';

const ContentTopic = `/relay-guide/1/chat/proto`;

function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState('NotStarted');

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
    console.log('Message Received', wakuMessage);
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
  const wakuMessage = await WakuMessage.fromUtf8String(message, ContentTopic);
  await waku.relay.send(wakuMessage);
}
