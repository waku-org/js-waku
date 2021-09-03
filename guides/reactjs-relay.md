# Receive and Send Messages Using Waku Relay With ReactJS

It is easy to use DappConnect with ReactJS.
In this guide, we will demonstrate how your ReactJS dApp can use Waku Relay to send and receive messages. 

Before starting, you need to choose a _Content Topic_ for your dApp.
Check out the [how to choose a content topic guide](choose-content-topic.md) to learn more about content topics.
For this guide, we are using a single content topic: `/min-react-js-chat/1/chat/proto`.

# Setup

Create a new React app:

```shell
npx create-react-app min-react-js-chat
cd min-react-js-chat
```

Then, install [js-waku](https://npmjs.com/package/js-waku):

```shell
npm install js-waku
```

Start the dev server and open the dApp in your browser:

```shell
npm run start
```

Note: We have noticed some issues with React bundling due to `npm` pulling an old version of babel.
If you are getting an error about the [optional chaining (?.)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)
character not being valid, try cleaning up and re-installing your dependencies:

```shell
rm -rf node_modules package-lock.json
npm install
```

# Create Waku Instance

In order to interact with the Waku network, you first need a Waku instance.
Go to `App.js` and modify the `App` function:

```js
import { Waku } from 'js-waku';
import * as React from 'react';

function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState('None');

  // Start Waku
  React.useEffect(() => {
    // If Waku is already assigned, the job is done
    if (!!waku) return;
    // If Waku status not None, it means we are already starting Waku 
    if (wakuStatus !== 'None') return;

    setWakuStatus('Starting');

    // Create Waku
    Waku.create({ bootstrap: true }).then((waku) => {
      // Once done, put it in the state
      setWaku(waku);
      // And update the status
      setWakuStatus('Started');
    });
  }, [waku, wakuStatus]);

  return (
    <div className='App'>
      <header className='App-header'>
        // Display the status on the web page
        <p>{wakuStatus}</p>
      </header>
    </div>
  );
}
```

# Wait to be connected

When using the `bootstrap` option, it may take some time to connect to other peers.
To ensure that you have relay peers available to send and receive messages,
use the `Waku.waitForConnectedPeer()` async function:

```js
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
```

# Define Message Format

To define the Protobuf message format,
use [protons](https://www.npmjs.com/package/protons)

```shell
npm install protons
```

Define `SimpleChatMessage` with two fields: `timestamp` and `text`.

```js
import protons from 'protons';

const proto = protons(`
message SimpleChatMessage {
  uint64 timestamp = 1;
  string text = 2;
}
`);
```

# Send Messages

Create a function that takes the Waku instance and a message to send:

```js
import { WakuMessage } from 'js-waku';

const ContentTopic = `/min-react-js-chat/1/chat/proto`;

async function sendMessage(message, timestamp, waku) {
  const time = timestamp.getTime();

  // Encode to protobuf
  const payload = proto.SimpleChatMessage.encode({
    timestamp: time,
    text: message,
  });

  // Wrap in a Waku Message
  const wakuMessage = await WakuMessage.fromBytes(payload, ContentTopic);
  
  // Send over Waku Relay
  await waku.relay.send(wakuMessage);
}
```

Then, add a button to the `App` function:

```js
function App() {
  const [waku, setWaku] = React.useState(undefined);
  const [wakuStatus, setWakuStatus] = React.useState('None');
  // Using a counter just for the messages to be different
  const [sendCounter, setSendCounter] = React.useState(0);
  
  React.useEffect(() => {
    // ... creates Waku
  }, [waku, wakuStatus]);

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
        <button onClick={sendMessageOnClick} disabled={wakuStatus !== 'Ready'}> // Grey the button is Waku is not yet ready.
          Send Message
        </button>
      </header>
    </div>
  );
}
```

# Receive Messages

To process incoming messages, you need to register an observer on Waku Relay.
First, you need to define the observer function.

You will need to remove the observer when the component unmount.
Hence, you need the reference to the function to remain the same.
For that, use `React.useCallback`:

```js
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
```

Then, add this observer to Waku Relay.
Do not forget to delete the observer is the component is being unmounted:

```js
React.useEffect(() => {
  if (!waku) return;

  // Pass the content topic to only process messages related to your dApp
  waku.relay.addObserver(processIncomingMessage, [ContentTopic]);

  // `cleanUp` is called when the component is unmounted, see ReactJS doc.
  return function cleanUp() {
    waku.relay.deleteObserver(processIncomingMessage, [ContentTopic]);
  };
}, [waku, wakuStatus, processIncomingMessage]);
```

# Display Messages

The Waku work is now done.
Your dApp is able to send and receive messages using Waku.
For the sake of completeness, let's display received messages on the page.

First, add incoming messages to the state of the `App` component:

```js
function App() {
  //...

  const [messages, setMessages] = React.useState([]);

  const processIncomingMessage = React.useCallback((wakuMessage) => {
    if (!wakuMessage.payload) return;

    const { text, timestamp } = proto.SimpleChatMessage.decode(
      wakuMessage.payload
    );

    const time = new Date();
    time.setTime(timestamp);
    const message = { text, timestamp: time };

    setMessages((messages) => {
      return [message].concat(messages);
    });
  }, []);

  // ...
}
```
Then, render the messages:

```js
function App() {
  // ...

  return (
    <div className="App">
      <header className="App-header">
        <p>{wakuStatus}</p>
        <button onClick={sendMessageOnClick} disabled={wakuStatus !== 'Ready'}>
          Send Message
        </button>
        <ul>
          {messages.map((msg) => {
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
```

And Voilà! You should now be able to send and receive messages.
Try out by opening the app from different browsers.

You can see the complete code in the [Minimal ReactJS Chat App](/examples/min-react-js-chat).
