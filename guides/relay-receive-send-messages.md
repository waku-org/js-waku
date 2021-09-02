# Receive and Send Messages Using Waku Relay

Waku Relay is a gossip protocol that enables you to send and receive messages.
You can find Waku Relay's specifications on [Vac RFC](https://rfc.vac.dev/spec/11/).

Before starting, you need to choose a _Content Topic_ for your dApp.
Check out the [how to choose a content topic guide](choose-content-topic.md) to learn more about content topics.

For this guide, we are using a single content topic: `/relay-guide/1/chat/proto`.

# Installation

You can install [js-waku](https://npmjs.com/package/js-waku) using your favorite package manager:

```shell
npm install js-waku
```

# Create Waku Instance

In order to interact with the Waku network, you first need a Waku instance:

```js
import { Waku } from 'js-waku';

const wakuNode = await Waku.create({ bootstrap: true });
```

Passing the `bootstrap` option will connect your node to predefined Waku nodes.
If you want to bootstrap to your own nodes, you can pass an array of multiaddresses instead:

```js
import { Waku } from 'js-waku';

const wakuNode = await Waku.create({
  bootstrap: [
    '/dns4/node-01.ac-cn-hongkong-c.wakuv2.test.statusim.net/tcp/443/wss/p2p/16Uiu2HAkvWiyFsgRhuJEb9JfjYxEkoHLgnUQmr1N5mKWnYjxYRVm',
    '/dns4/node-01.do-ams3.wakuv2.test.statusim.net/tcp/443/wss/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ'
  ]
});
```

# Wait to be connected

When using the `bootstrap` option, it may take some time to connect to other peers.
To ensure that you have relay peers available to send and receive messages,
use the following function:

```js
await waku.waitForConnectedPeer();
```

The returned Promise will resolve once you are connected to a Waku Relay peer.

# Receive messages

To watch messages for your app, you need to register an observer on relay for your app's content topic:

```js
const processIncomingMessage = (wakuMessage) => {
  console.log(`Message Received: ${wakuMessage.payloadAsUtf8}`);
};

waku.relay.addObserver(processIncomingMessage, ['/relay-guide/1/chat/proto']);
```

# Send Messages

You are now ready to send messages.
Let's start by sending simple strings as messages.

To send a message, you need to wrap the message in a `WakuMessage`.
When using a basic string payload, you can use the `WakuMessage.fromUtf8String` helper:

```js
import { WakuMessage } from 'js-waku';

const wakuMessage = await WakuMessage.fromUtf8String('Here is a message', `/relay-guide/1/chat/proto`);
```

Then, use the `relay` module to send the message to our peers,
the message will then be relayed to the rest of the network thanks to Waku Relay:

```js
await waku.relay.send(wakuMessage);
```

# Use Protobuf

Sending strings as messages in unlikely to cover your dApps needs.

Waku v2 protocols use [protobuf](https://developers.google.com/protocol-buffers/) [by default](https://rfc.vac.dev/spec/10/).

Let's review how you can use protobuf to include structured objects in Waku Messages.

First, define a data structure.
For this guide, we will use a simple chat message that contains a timestamp and text:

```js
{
  timestamp: Date;
  text: string;
}
```

To encode and decode protobuf payloads, you can use the [protons](https://www.npmjs.com/package/protons) package.

## Install Protobuf Library

First, install protons:

```shell
npm install protons
```

## Protobuf Definition

Then define the simple chat message:

```js
import protons from 'protons';

const proto = protons(`
message SimpleChatMessage {
  uint64 timestamp = 1;
  string text = 2;
}
`);
```

You can learn about protobuf message definitions here:
[Protocol Buffers Language Guide](https://developers.google.com/protocol-buffers/docs/proto).

## Encode Messages

Instead of wrapping an utf-8 string in a Waku Message,
you are going to wrap a protobuf payload.

First, encode the object:

```js
const payload = proto.SimpleChatMessage.encode({
  timestamp: Date.now(),
  text: 'Here is a message'
});
```

Then, wrap it in a Waku Message:

```js
const wakuMessage = await WakuMessage.fromBytes(payload, ContentTopic);
```

Now, you can send the message over Waku Relay the same way than before:

```js
await waku.relay.send(wakuMessage);
```

## Decode Messages

To decode the messages received over Waku Relay,
you need to extract the protobuf payload and decode it using `protons`.

```js
const processIncomingMessage = (wakuMessage) => {
  // No need to attempt to decode a message if the payload is absent
  if (!wakuMessage.payload) return;

  const { timestamp, text } = proto.SimpleChatMessage.decode(
    wakuMessage.payload
  );

  console.log(`Message Received: ${text}, sent at ${timestamp.toString()}`);
};
```

Like before, add this callback as an observer to Waku Relay:

```js
waku.relay.addObserver(processIncomingMessage, ['/relay-guide/1/chat/proto']);
```

# Conclusion

That is it! Now, you know how to send and receive messages over Waku using the Waku Relay protocol.

Feel free to check out other [guides](menu.md) or [examples](/examples/examples.md).

Here is the final code:

```js
import { getBootstrapNodes, Waku, WakuMessage } from 'js-waku';
import protons from 'protons';

const proto = protons(`
message SimpleChatMessage {
  uint64 timestamp = 1;
  string text = 2;
}
`);

const wakuNode = await Waku.create();

const nodes = await getBootstrapNodes();
await Promise.all(nodes.map((addr) => waku.dial(addr)));

const processIncomingMessage = (wakuMessage) => {
  // No need to attempt to decode a message if the payload is absent
  if (!wakuMessage.payload) return;

  const { timestamp, text } = proto.SimpleChatMessage.decode(
    wakuMessage.payload
  );

  console.log(`Message Received: ${text}, sent at ${timestamp.toString()}`);
};

waku.relay.addObserver(processIncomingMessage, ['/relay-guide/1/chat/proto']);

const payload = proto.SimpleChatMessage.encode({
  timestamp: Date.now(),
  text: 'Here is a message'
});
const wakuMessage = await WakuMessage.fromBytes(payload, ContentTopic);
await waku.relay.send(wakuMessage);
```
