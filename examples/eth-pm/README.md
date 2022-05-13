# Ethereum Private Message Web App

**Demonstrates**:

- Private Messaging
- React/TypeScript
- Waku Light Push
- Signature with Web3
- Asymmetric Encryption
- Symmetric Encryption

A PoC implementation of [20/ETH-DM](https://rfc.vac.dev/spec/20/).

Ethereum Private Message, or Eth-PM, is a protocol that allows sending encrypted message to a recipient,
only knowing their Ethereum Address.

This protocol has been created to demonstrated how encryption and signature could be added to message
sent over the Waku v2 network.

The `master` branch's HEAD is deployed at https://js-waku.wakuconnect.dev/examples/eth-pm/.

To run a development version locally, do:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd examples/eth-pm
npm install   # Install dependencies for the web app
npm run start # Start development server to serve the web app on http://localhost:3000/js-waku/eth-pm
```
