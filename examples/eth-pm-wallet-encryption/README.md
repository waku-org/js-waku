# Ethereum Private Message Using Wallet Encryption Web App

**Demonstrates**:

- Private Messaging
- React/TypeScript
- Waku Light Push
- Signature with Web3 using [EIP-712 v4: `eth_signTypedData_v4`](https://eips.ethereum.org/EIPS/eip-712)
- Asymmetric Encryption
- Usage of [`eth_decrypt`](https://docs.metamask.io/guide/rpc-api.html#eth-decrypt) Wallet API

This dApp demonstrates how to send and received end-to-end encrypted messages
using the encryption API provided by some Web3 Wallet provider such as [Metamask](https://metamask.io/).

The sender only needs to know the Ethereum address of the recipient.
The recipient must broadcast his encryption public Key as a first step.

To run a development version locally, do:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd examples/eth-pm-wallet-encryption   
npm install   # Install dependencies for the web app
npm run start # Start development server to serve the web app on http://localhost:3000/js-waku/eth-pm-wallet
```
