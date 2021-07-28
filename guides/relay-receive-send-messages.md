# Receive and Send messages using Waku Relay

Waku
Relay
is
a
gossip protocol that enables you to send and receive messages.
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
  console.log("Message Received", wakuMessage);
};

waku.relay.addObserver(processIncomingMessage, ["/relay-guide/1/chat/proto"]);
```

# Send messages

You are now ready to send messages.
Let's start by sending simple strings as messages.

To send a message, you need to wrap the message in a `WakuMessage`.
When using a basic string payload, you can use the `WakuMessage.fromUtf8String` helper:

```js
import { WakuMessage } from 'js-waku';

const wakuMessage = await WakuMessage.fromUtf8String(message, `/relay-guide/1/chat/proto`);
```

Then, use the `relay` module to send the message to our peers,
the message will then be relayed to the rest of the network thanks to Waku Relay:

```js
import { WakuMessage } from 'js-waku';

const wakuMessage = await WakuMessage.fromUtf8String(message, `/relay-guide/1/chat/proto`);

await waku.relay.send(wakuMessage);
```

# Conclusion

That is it! Now, you know how to send and receive messages over Waku using the Waku Relay protocol.

Feel free to check out other [guides](menu.md) or [examples](../examples).

Here is the final code:

```js
import { getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';

const wakuNode = await Waku.create();

const nodes = await getStatusFleetNodes();
await Promise.all(nodes.map((addr) => waku.dial(addr)));

const processIncomingMessage = (wakuMessage) => {
  console.log('Message Received', wakuMessage);
};

waku.relay.addObserver(processIncomingMessage, ['/relay-guide/1/chat/proto']);

const wakuMessage = await WakuMessage.fromUtf8String(message, `/relay-guide/1/chat/proto`);
await waku.relay.send(wakuMessage);
```
