# WakuJS

A JavaScript implementation of the [Waku v2 protocol](https://rfc.vac.dev/spec/10/).

## Usage

Install `waku-js` package:

```shell
npm install waku-js
```

Start a waku node:

```javascript
import { Waku } from 'waku-js';

const waku = await Waku.create();
```

Connect to a new peer:

```javascript
import { multiaddr } from 'multiaddr';
import PeerId from 'peer-id';

// Directly dial a new peer
await waku.dial('/dns4/node-01.do-ams3.jdev.misc.statusim.net/tcp/7010/wss/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ');

// Or, add peer to address book so it auto dials in the background
waku.addPeerToAddressBook(
  '16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ',
  ['/dns4/node-01.do-ams3.jdev.misc.statusim.net/tcp/7010/wss']
);
```

The `contentTopic` is a metadata `string` that allows categorization of messages on the waku network.
Depending on your use case, you can either create a new `contentTopic` or look at the [RFCs](https://rfc.vac.dev/) and use an existing `contentTopic`.
See the [Waku v2 Message spec](https://rfc.vac.dev/spec/14/) for more details.

Listen to new messages received via [Waku v2 Relay](https://rfc.vac.dev/spec/11/), filtering the `contentTopic` to `waku/2/my-cool-app/proto`:

```javascript
waku.relay.addObserver((msg) => {
  console.log("Message received:", msg.payloadAsUtf8)
}, ["waku/2/my-cool-app/proto"]);
```

Send a message on the waku relay network:

```javascript
import { WakuMessage } from 'waku-js';

const msg = WakuMessage.fromUtf8String("Here is a message!", "waku/2/my-cool-app/proto")
await waku.relay.send(msg);
```

The [Waku v2 Store protocol](https://rfc.vac.dev/spec/13/) enables full nodes to store messages received via relay
and clients to retrieve them (e.g. after resuming connectivity).
The protocol implements pagination meaning that it may take several queries to retrieve all messages.

Query a waku store peer to check historical messages:

```javascript
// Process messages once they are all retrieved:
const messages = await waku.store.queryHistory(storePeerId, ["waku/2/my-cool-app/proto"]);
messages.forEach((msg) => {
  console.log("Message retrieved:", msg.payloadAsUtf8)
})

// Or, pass a callback function to be executed as pages are received:
waku.store.queryHistory(storePeerId, ["waku/2/my-cool-app/proto"],
  (messages) => {
    messages.forEach((msg) => {
      console.log("Message retrieved:", msg.payloadAsUtf8)
    })
  });
```

Find more [examples](#examples) below
or checkout the latest `main` branch documentation at [https://status-im.github.io/waku-js/docs/](https://status-im.github.io/waku-js/docs/).

Docs can also be generated locally using:

```shell
npm install
npm run doc
```

## Waku Protocol Support

You can track progress on the [project board](https://github.com/status-im/waku-js/projects/1).

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

## Bugs, Questions & Features

If you encounter any bug or would like to propose new features, feel free to [open an issue](https://github.com/status-im/waku-js/issues/new/).

For support, questions & more general topics, please join the discussion on the [Vac forum](https://forum.vac.dev/tag/waku-js) (use _\#js-waku_ tag).

## Examples

## Web Chat App (ReactJS)

A ReactJS chat app is provided as a showcase of the library used in the browser.
A deployed version is available at https://status-im.github.io/waku-js/

Find the code in the [examples folder](https://github.com/status-im/waku-js/tree/main/examples/web-chat).

To run a development version locally, do:

```shell
git clone https://github.com/status-im/waku-js/ ; cd waku-js
npm install   # Install dependencies for waku-js
npm run build # Build waku-js
cd examples/web-chat   
npm install   # Install dependencies for the web app
npm run start # Start development server to serve the web app on http://localhost:3000/waku-js
```

Use `/help` to see the available commands.

## CLI Chat App (NodeJS)

A node chat app is provided as a working example of the library.
It is interoperable with the [nim-waku chat app example](https://github.com/status-im/nim-waku/blob/master/examples/v2/chat2.nim).

Find the code in the [examples folder](https://github.com/status-im/waku-js/tree/main/examples/cli-chat).

To run the chat app, first ensure you have [Node.js](https://nodejs.org/en/) v14 or above:

```shell
node --version
```

Then, install and run:

```shell
git clone https://github.com/status-im/waku-js/ ; cd waku-js
npm install   # Install dependencies for waku-js
npm run build # Build waku-js
cd examples/cli-chat
npm install # Install dependencies for the cli app
npm run start -- --staticNode /ip4/134.209.139.210/tcp/30303/p2p/16Uiu2HAmPLe7Mzm8TsYUubgCAW1aJoeFScxrLj8ppHFivPo97bUZ
```

You can also specify an optional `listenAddr` parameter (.e.g `--listenAddr /ip4/0.0.0.0/tcp/7777/ws`).
This is only useful if you want a remote node to dial to your chat app, 
it is not necessary in normal usage when you just connect to the fleet.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License
Licensed and distributed under either of

* MIT license: [LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT

or

* Apache License, Version 2.0, ([LICENSE-APACHE-v2](LICENSE-APACHE-v2) or http://www.apache.org/licenses/LICENSE-2.0)

at your option. These files may not be copied, modified, or distributed except according to those terms.
