# Ethereum Private Message Using Wallet Encryption Web App

**Demonstrates**:

- Private Messaging
- React/TypeScript
- Waku Light Push
- Signature with Web3 using [EIP-712: `eth_signTypedData_v4`](https://eips.ethereum.org/EIPS/eip-712)
- Asymmetric Encryption
- Usage of [`eth_decrypt`](https://docs.metamask.io/guide/rpc-api.html#eth-decrypt) Wallet API

This dApp demonstrates how to send and received end-to-end encrypted messages
using the encryption API provided by some Web3 Wallet provider such as [MetaMask](https://metamask.io/).

The sender only needs to know the Ethereum address of the recipient.
The recipient must broadcast his encryption public key as a first step.

The `master` branch's HEAD is deployed at https://js-waku.wakuconnect.dev/examples/eth-pm-wallet-encryption/.

To run a development version locally, do:

```shell
git clone https://github.com/status-im/js-waku/ ; cd js-waku
npm install   # Install dependencies for js-waku
npm run build # Build js-waku
cd examples/eth-pm-wallet-encryption   
npm install   # Install dependencies for the web app
npm run start # Start development server to serve the web app on http://localhost:3000/js-waku/eth-pm-wallet
```

## Caveats

This is a PoC with some obvious UX caveats:

- As the message payload is fully encrypted, the dApp asks MetaMask who in turns ask the user to decrypt every received message (even if we are the sender).
- This only uses Relay protocol to receive messages, meaning that participants must have the dApp open at the same time to receive private messages or public keys from each other.
