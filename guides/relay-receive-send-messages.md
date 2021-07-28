# Receive and Send messages using Waku Relay

Waku
Relay
is
a
gossip
protocol
that
enables
you
to send and receive messages.
You can find Waku Relay's specifications on [Vac RFC](https://rfc.vac.dev/spec/11/).

Before starting, you need to choose a _Content Topic_ for your dApp.
Check out the [choose a content topic guide](choose-content-topic.md) to learn more about content topics.

For the purpose of this guide, we are using a unique content topic: `/relay-guide/1/chat/proto`.

# Installation

You can install [js-waku](https://npmjs.com/package/js-waku) using your favorite package manager:

```shell
npm install js-waku
```

# Create Waku instance

In order to interact with the Waku network, you first need a Waku instance:

```js
import { Waku } from 'js-waku';

const wakuNode = await Waku.create();
```

# Connect to other peers

The Waku instance needs to connect to other peers to communicate with the network.
You are free to choose any method to bootstrap and DappConnect will ship with new methods in the future.

For now, the easiest way is to connect to Status' Waku fleet:

```js
import { getStatusFleetNodes } from 'js-waku';

const nodes = await getStatusFleetNodes();
await Promise.all(nodes.map((addr) => waku.dial(addr))); 
```

# Receive messages

To monitor messages for your app, you need to register an observer on relay for your app's content topic:

```js
const processIncomingMessage = (wakuMessage) => {
  console.log(`Message Received: ${wakuMessage.payloadAsUtf8}`);
};

waku.relay.addObserver(processIncomingMessage, ['/relay-guide/1/chat/proto']);
```

`WakuMessage.payloadAsUtf8` is a nice helper to show UTF-8 encoding messages.
However, you will probably need more structure messages, this is covered in [use protobuf section](#use-protobuf).

# Send messages

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

# Use protobuf

Sending strings as messages in unlikely to cover your dApps needs.
To include structured objects in Waku Messages,
it is recommended to use [protobuf](https://developers.google.com/protocol-buffers/).

First, let's define an object.
For this guide, we will use a simple chat message that contains a timestamp and text:

```js
{
  timestamp: Date;
  text: string;
}
```

To encode and decode protobuf, you can use the [protons](https://www.npmjs.com/package/protons) package.

## Install protobuf library

First, install it:

```shell
npm install protons
```

## Protobuf Definition

Then define the simple chat message:

```js
import protons from 'protons';

const proto = protons(`
message SimpleChatMessage {
  float timestamp = 1;
  string text = 2;
}
`);
```

You can learn about protobuf definitions here:
[Protocol Buffers Language Guide](https://developers.google.com/protocol-buffers/docs/proto).

## Encode messages

Instead of wrapping a string in a Waku Message, you need to encode the message in protobuf.
The result is a byte array that can then be wrapped in a Waku Message.

First, encode the message:

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

## Decode messages

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

Same than before, you can pass add this function as an observer to Waku Relay to process incoming messages:

```js
waku.relay.addObserver(processIncomingMessage, ['/relay-guide/1/chat/proto']);
```

# Conclusion

That is it! Now, you know how to send and receive messages over Waku using the Waku Relay protocol.

Feel free to check out other [guides](menu.md) or [examples](../examples).

Here is the final code:

```js
import { getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';
import protons from 'protons';

const proto = protons(`
message SimpleChatMessage {
  float timestamp = 1;
  string text = 2;
}
`);

const wakuNode = await Waku.create();

const nodes = await getStatusFleetNodes();
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
