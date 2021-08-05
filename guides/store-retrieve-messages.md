# Retrieve Messages Using Waku Store

When running a web dApp or a mobile phone application,
internet can be unreliable and disconnect.

[Waku Relay](https://rfc.vac.dev/spec/18/) is a gossip protocol.
As a user, it means that your peers forward you messages they just received.
If you cannot be reached by your peers, then messages are not relayed;
relay peers do **not** save messages for later.
However, [store](https://rfc.vac.dev/spec/13/) peers do save messages they relay,
allowing you to retrieve messages at any time.

In this guide, we'll review how you can use Waku Store to retrieve messages.

Before starting, you need to choose a _Content Topic_ for your dApp.
Check out the [how to choose a content topic guide](choose-content-topic.md) to learn more about content topics.

For this guide, we are using a single content topic: `/store-guide/1/news/proto`.

# Installation

You can install [js-waku](https://npmjs.com/package/js-waku) using your favorite package manager:

```shell
npm install js-waku
```

# Create Waku Instance

In order to interact with the Waku network, you first need a Waku instance:

```js
import { Waku } from 'js-waku';

const wakuNode = await Waku.create();
```

# Connect to Other Peers

The Waku instance needs to connect to other peers to communicate with the network.
You are free to choose any method to bootstrap and DappConnect will ship with new methods in the future.

For now, the easiest way is to connect to Status' Waku fleet:

```js
import { getStatusFleetNodes } from 'js-waku';
const nodes = await getStatusFleetNodes();
await Promise.all(nodes.map((addr) => waku.dial(addr))); 
```

# Use Protobuf

We recommend you use [protobuf](https://developers.google.com/protocol-buffers/) for messages.

First, let's define a data structure.
For this guide, we will use a simple news article that contains a date of publication, title and body:

```js
{
  date: Date;
  title: string;
  body: string;
}
```

To encode and decode protobuf payloads, you can use the [protons](https://www.npmjs.com/package/protons) package.

## Install Protobuf Library

First, install protons:

```shell
npm install protons
```

## Protobuf Definition

Then specify the data structure:

```js
import protons from 'protons';

const proto = protons(`
message ArticleMessage {
  uint64 date = 1;
  string title = 2;
  string body = 3;
}
`);
```

You can learn about protobuf message definitions here:
[Protocol Buffers Language Guide](https://developers.google.com/protocol-buffers/docs/proto).

## Decode Messages

To decode the messages retrieved from a Waku Store node,
you need to extract the protobuf payload and decode it using `protons`.

```js
const decodeWakuMessage = (wakuMessage) => {
  // No need to attempt to decode a message if the payload is absent
  if (!wakuMessage.payload) return;

  const { date, title, body } = proto.SimpleChatMessage.decode(
    wakuMessage.payload
  );

  // In protobuf, fields are optional so best to check
  if (!date || !title || !body) return;

  const publishDate = new Date();
  publishDate.setTime(date);

  return { publishDate, title, body };
};
```

## Retrieve messages

You now have all the building blocks to retrieve and decode messages for a store node.

Retrieve messages from a store node:

```js
const ContentTopic = '/store-guide/1/news/proto';

waku.store
  .queryHistory([ContentTopic])
  .catch((e) => {
    // Be sure to catch any potential error
    console.log('Failed to retrieve messages', e);
  })
  .then((retrievedMessages) => {
    const articles = retrievedMessages
      .map(decodeWakuMessage) // Decode messages
      .filter(Boolean); // Filter out undefined values

    console.log(`${articles.length} articles have been retrieved`);
  });
```

Note that `WakuStore.queryHistory` select an available store node for you.
However, it can only query connected node, which is why the bootstrapping is necessary.

The call can throw an error if no store node is available.

## Wait to be connected

Depending on your dApp design, you may want to wait for a store node to be available first.
In this case, you can listen for the [PeerStore's change protocol event](https://github.com/libp2p/js-libp2p/blob/master/doc/API.md#known-protocols-for-a-peer-change).
To know whether any of your connected peers is a store peer:

```js
// Using await and a promise
const storePeerId = await new Promise((resolve) => {
  waku.libp2p.peerStore.on('change:protocols', ({ peerId, protocols }) => {
    if (protocols.includes(StoreCodec)) {
      resolve(peerId);
    }
  });
});

// Or using a callback

waku.libp2p.peerStore.on('change:protocols', ({ peerId, protocols }) => {
  if (protocols.includes(StoreCodec)) {
    // A Store node is available!
  }
});
```
