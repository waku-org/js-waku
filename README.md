# js-waku

A JavaScript implementation of the [Waku v2 protocol](https://specs.vac.dev/specs/waku/v2/waku-v2).

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

## Bugs, Questions & Features

If you encounter any bug or would like to propose new features, feel free to [open an issue](https://github.com/status-im/js-waku/issues/new/).

For support, questions & more general topics, please join the discussion on the [Vac forum](https://forum.vac.dev/tag/js-waku) (use _\#js-waku_ tag).

## Examples

## Web Chat App (ReactJS)

A ReactJS web app is provided as an a show case of the library used in the browser.

A deployed version is available at https://status-im.github.io/js-waku/

To run a development version locally, do:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd web-chat   
npm install   # Install dependencies for the web app
npm run start # Start development server to serve the web app on http://localhost:3000/js-waku
```

Use `/help` to see the available commands.

## CLI Chat App (NodeJS)

A node chat app is provided as a working example of the library.
It is interoperable with the [nim-waku chat app example](https://github.com/status-im/nim-waku/blob/master/examples/v2/chat2.nim).
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
