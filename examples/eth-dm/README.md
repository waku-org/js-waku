# Ethereum Direct Message Web App

**Demonstrates**:

- Private Messaging
- React/TypeScript
- Waku Light Push
- Signature with Web3
- Asymmetric Encryption

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
