# js-waku

A JavaScript implementation of the [Waku v2 protocol](https://rfc.vac.dev/spec/10/).

## Usage

Install `js-waku` package:

```shell
npm install js-waku
```

Start a waku node:

```javascript
import { Waku } from 'js-waku';

const waku = await Waku.create();
```

Connect to a new peer:

```javascript
import { multiaddr } from 'multiaddr';
import PeerId from 'peer-id';

// Directly dial a new peer
await waku.dial('/dns4/node-01.do-ams3.wakuv2.test.statusim.net/tcp/443/wss/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ');

// Or, add peer to address book so it auto dials in the background
waku.addPeerToAddressBook(
  '16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ',
  ['/dns4/node-01.do-ams3.wakuv2.test.statusim.net/tcp/443/wss']
);
```

You can also use `getStatusFleetNodes` to connect to nodes run by Status:

```javascript
import { getStatusFleetNodes } from 'js-waku';

const nodes = await getStatusFleetNodes();
await Promise.all(
  nodes.map((addr) => {
    return waku.dial(addr);
  })
);
```

The `contentTopic` is a metadata `string` that allows categorization of messages on the waku network.
Depending on your use case, you can either create one (or several) new `contentTopic`(s) or look at the [RFCs](https://rfc.vac.dev/) and use an existing `contentTopic`.
See the [Waku v2 Topic Usage Recommendations](https://rfc.vac.dev/spec/23/) for more details.

For example, if you were to use a new `contentTopic` such as `/my-cool-app/1/my-use-case/proto`,
here is how to listen to new messages received via [Waku v2 Relay](https://rfc.vac.dev/spec/11/):

```javascript
waku.relay.addObserver((msg) => {
  console.log("Message received:", msg.payloadAsUtf8)
}, ["/my-cool-app/1/my-use-case/proto"]);
```

The examples chat apps currently use content topic `"/toy-chat/2/huilong/proto"`.

Send a message on the waku relay network:

```javascript
import { WakuMessage } from 'js-waku';

const msg = await WakuMessage.fromUtf8String("Here is a message!", { contentTopic: "/my-cool-app/1/my-use-case/proto" })
await waku.relay.send(msg);
```

The [Waku v2 Store protocol](https://rfc.vac.dev/spec/13/) enables full nodes to store messages received via relay
and clients to retrieve them (e.g. after resuming connectivity).
The protocol implements pagination meaning that it may take several queries to retrieve all messages.

Query a waku store peer to check historical messages:

```javascript
// Process messages once they are all retrieved:
const messages = await waku.store.queryHistory({ contentTopics: ["my-cool-app"] });
messages.forEach((msg) => {
  console.log("Message retrieved:", msg.payloadAsUtf8)
})

// Or, pass a callback function to be executed as pages are received:
waku.store.queryHistory({
    contentTopics: ["my-cool-app"],
    callback: (messages) => {
      messages.forEach((msg) => {
        console.log("Message retrieved:", msg.payloadAsUtf8);
      });
    }
  });
```

Find more [examples](#examples) below
or checkout the latest `main` branch documentation at [https://status-im.github.io/js-waku/docs/](https://status-im.github.io/js-waku/docs/).

Docs can also be generated locally using:

```shell
npm install
npm run doc
```

## Changelog

Release changelog can be found [here](https://github.com/status-im/js-waku/blob/main/CHANGELOG.md).

## Waku Protocol Support

You can track progress on the [project board](https://github.com/status-im/js-waku/projects/1).

- ✔: Supported
- 🚧: Implementation in progress
- ⛔: Support is not planned

| Spec | Implementation Status |
| ---- | -------------- |
|[6/WAKU1](https://rfc.vac.dev/spec/6)|⛔|
|[7/WAKU-DATA](https://rfc.vac.dev/spec/7)|⛔|
|[8/WAKU-MAIL](https://rfc.vac.dev/spec/8)|⛔|
|[9/WAKU-RPC](https://rfc.vac.dev/spec/9)|⛔|
|[10/WAKU2](https://rfc.vac.dev/spec/10)|🚧|
|[11/WAKU2-RELAY](https://rfc.vac.dev/spec/11)|✔|
|[12/WAKU2-FILTER](https://rfc.vac.dev/spec/12)||
|[13/WAKU2-STORE](https://rfc.vac.dev/spec/13)|✔ (querying node only)|
|[14/WAKU2-MESSAGE](https://rfc.vac.dev/spec/14)|✔|
|[15/WAKU2-BRIDGE](https://rfc.vac.dev/spec/15)||
|[16/WAKU2-RPC](https://rfc.vac.dev/spec/16)|⛔|
|[17/WAKU2-RLNRELAY](https://rfc.vac.dev/spec/17)||
|[18/WAKU2-SWAP](https://rfc.vac.dev/spec/18)||
|[19/WAKU2-LIGHTPUSH](https://rfc.vac.dev/spec/19/)|✔|

## Bugs, Questions & Features

If you encounter any bug or would like to propose new features, feel free to [open an issue](https://github.com/status-im/js-waku/issues/new/).

For support, questions & more general topics,
please join the discussion on the [Vac forum](https://forum.vac.dev/tag/js-waku) (use _\#js-waku_ tag)
or [\#waku-support on Status Community Discord](https://discord.gg/Q9aNS6Fg).

## Examples

## Web Chat App (ReactJS)

A ReactJS chat app is provided as a showcase of the library used in the browser.
It implements [Waku v2 Toy Chat](https://rfc.vac.dev/spec/22/) protocol.
A deployed version is available at https://status-im.github.io/js-waku/.

Find the code in the [examples folder](https://github.com/status-im/js-waku/tree/main/examples/web-chat).

To run a development version locally, do:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd examples/web-chat   
npm install   # Install dependencies for the web app
npm run start # Start development server to serve the web app on http://localhost:3000/js-waku
```

Use `/help` to see the available commands.

## CLI Chat App (NodeJS)

A node chat app is provided as a working example of the library.
It implements [Waku v2 Toy Chat](https://rfc.vac.dev/spec/22/) protocol.

Find the code in the [examples folder](https://github.com/status-im/js-waku/tree/main/examples/cli-chat).

To run the chat app, first ensure you have [Node.js](https://nodejs.org/en/) v14 or above:

```shell
node --version
```

Then, install and run:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd examples/cli-chat
npm install # Install dependencies for the cli app
npm run start -- --autoDial
```

You can also specify an optional `listenAddr` parameter (.e.g `--listenAddr /ip4/0.0.0.0/tcp/7777/ws`).
This is only useful if you want a remote node to dial to your chat app, 
it is not necessary in normal usage when you just connect to the fleet.

## Ethereum Direct Message

A PoC implementation of [20/ETH-DM](https://rfc.vac.dev/spec/20/).

Ethereum Direct Message, or Eth-DM, is a protocol that allows sending encrypted message to a recipient,
only knowing their Ethereum Address.

This is protocol has been created to demonstrated how encryption and signature could be added to messages
sent over the Waku v2 network.

The `main` branch's HEAD is deployed on GitHub Pages at https://status-im.github.io/js-waku/eth-dm/.

To run a development version locally, do:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd examples/eth-dm   
npm install   # Install dependencies for the web app
npm run start # Start development server to serve the web app on http://localhost:3000/js-waku/eth-dm
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License
Licensed and distributed under either of

* MIT license: [LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT

or

* Apache License, Version 2.0, ([LICENSE-APACHE-v2](LICENSE-APACHE-v2) or http://www.apache.org/licenses/LICENSE-2.0)

at your option. These files may not be copied, modified, or distributed except according to those terms.
