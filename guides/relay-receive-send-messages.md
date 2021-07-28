# Received and Send messages using Waku Relay

Waku Relay is a gossip protocol that enables you to send and receive messages.
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

# Send messages

We are now ready to send message.
Let's start by sending simple strings as messages.

To send a message, we need to wrap the message in a `WakuMessage`.
When using a basic string payload, we can just use the `WakuMessage.fromUtf8String` helper:

```js
import { WakuMessage } from 'js-waku';

const wakuMessage = await WakuMessage.fromUtf8String(message, `/relay-guide/1/chat/proto`);
```

Then, we use the `relay` module to send the message to our peers,
the message will then be relayed to the rest of the network thanks to Waku Relay:

```js
import { WakuMessage } from 'js-waku';

const wakuMessage = await WakuMessage.fromUtf8String(message, `/relay-guide/1/chat/proto`);

await waku.relay.send(wakuMessage)
```

So far, we have:

```js
import { getStatusFleetNodes, Waku, WakuMessage } from 'js-waku';

const wakuNode = await Waku.create();

import { getStatusFleetNodes } from 'js-waku';

const nodes = await getStatusFleetNodes();
await Promise.all(nodes.map((addr) => waku.dial(addr)));

const wakuMessage = await WakuMessage.fromUtf8String(message, `/relay-guide/1/chat/proto`);

await waku.relay.send(wakuMessage)
```

