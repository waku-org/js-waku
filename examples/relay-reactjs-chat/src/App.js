import { Waku } from 'js-waku';
import * as React from 'react';
import protons from 'protons';
import { WakuMessage } from 'js-waku';

const ContentTopic = `/relay-reactjs-chat/1/chat/proto`;

const proto = protons(`
message SimpleChatMessage {
  uint64 timestamp = 1;
  string text = 2;
}
`);

function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState('None');
  // Using a counter just for the messages to be different
  const [sendCounter, setSendCounter] = React.useState(0);

  React.useEffect(() => {
    if (!!waku) return;
    if (wakuStatus !== 'None') return;

    setWakuStatus('Starting');

    Waku.create({ bootstrap: true }).then((waku) => {
      setWaku(waku);
      setWakuStatus('Connecting');
      waku.waitForConnectedPeer().then(() => {
        setWakuStatus('Ready');
      });
    });
  }, [waku, wakuStatus]);

  const processIncomingMessage = React.useCallback((wakuMessage) => {
    // Empty message?
    if (!wakuMessage.payload) return;

    // Decode the protobuf payload
    const { timestamp, text } = proto.SimpleChatMessage.decode(
      wakuMessage.payload
    );
    const time = new Date();
    time.setTime(timestamp);

    // For now, just log new messages on the console
    console.log(`message received at ${time.toString()}: ${text}`);
  }, []);

  React.useEffect(() => {
    if (!waku) return;

    // Pass the content topic to only process messages related to your dApp
    waku.relay.addObserver(processIncomingMessage, [ContentTopic]);

    // `cleanUp` is called when the component is unmounted, see ReactJS doc.
    return function cleanUp() {
      waku.relay.deleteObserver(processIncomingMessage, [ContentTopic]);
    };
  }, [waku, wakuStatus, processIncomingMessage]);

  const sendMessageOnClick = () => {
    // Check Waku is started and connected first.
    if (wakuStatus !== 'Ready') return;

    sendMessage(`Here is message #${sendCounter}`, waku, new Date()).then(() =>
      console.log('Message sent')
    );

    // For demonstration purposes.
    setSendCounter(sendCounter + 1);
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

function sendMessage(message, waku, timestamp) {
  const time = timestamp.getTime();

  // Encode to protobuf
  const payload = proto.SimpleChatMessage.encode({
    timestamp: time,
    text: message
  });

  // Wrap in a Waku Message
  return WakuMessage.fromBytes(payload, ContentTopic).then((wakuMessage) =>
    // Send over Waku Relay
    waku.relay.send(wakuMessage)
  );
}

export default App;
