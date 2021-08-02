# CLI Chat App

**Demonstrates**:

- Group chat
- Node JS/TypeScript
- Waku Relay
- Waku Light Push
- Waku Store

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
