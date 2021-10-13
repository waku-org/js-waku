[![NPM](https://nodei.co/npm/js-waku.png)](https://npmjs.org/package/js-waku)

![GitHub Action](https://img.shields.io/github/workflow/status/status-im/js-waku/CI)
[![Discord chat](https://img.shields.io/discord/864066763682218004.svg?logo=discord&colorB=7289DA)](https://discord.gg/j5pGbn7MHZ)

# js-waku

A JavaScript implementation of the [Waku v2 protocol](https://rfc.vac.dev/spec/10/).

## Documentation

In the [section below](#usage) you can find explanations for the main API.

We also have [guides](https://github.com/status-im/js-waku/blob/main/guides/menu.md) available
and [code examples](https://github.com/status-im/js-waku/blob/main/examples/examples.md).

You can read the latest `main` branch documentation at [https://status-im.github.io/js-waku/docs/](https://status-im.github.io/js-waku/docs/).

Docs can also be generated locally using:

```shell
npm install
npm run doc
```


## Usage

Install `js-waku` package:

```shell
npm install js-waku
```

### Import js-waku

To use js-waku in your application, you can:

use `import`:

```js
import { Waku } from 'js-waku';

const waku = await Waku.create();
```

use `require`:

```js
const jsWaku = require('js-waku');

jsWaku.Waku.create().then(waku => {
  // ...
});
```

Or directly import it in a `<script>` tag:

```html
<script src='https://unpkg.com/js-waku@latest/build/umd/js-waku.min.bundle.js'></script>
<script>
  jswaku.Waku.create().then(waku => {
    // ...
  }
</script>
```

### Start a waku node

```ts
const waku = await Waku.create({ bootstrap: true });
```

### Listen for messages

The `contentTopic` is a metadata `string` that allows categorization of messages on the waku network.
Depending on your use case, you can either create one (or several) new `contentTopic`(s) or look at the [RFCs](https://rfc.vac.dev/) and use an existing `contentTopic`.
See [How to Choose a Content Topic](./guides/choose-content-topic.md) for more details.

For example, if you were to use a new `contentTopic` such as `/my-cool-app/1/my-use-case/proto`,
here is how to listen to new messages received via [Waku v2 Relay](https://rfc.vac.dev/spec/11/):

```ts
waku.relay.addObserver((msg) => {
  console.log("Message received:", msg.payloadAsUtf8)
}, ["/my-cool-app/1/my-use-case/proto"]);
```

The examples chat apps currently use content topic `"/toy-chat/2/huilong/proto"`.

### Send messages

There are two ways to send messages:

#### Waku Relay

[Waku Relay](https://rfc.vac.dev/spec/11/) is the most decentralized option,
peer receiving your messages are unlikely to know whether you are the originator or simply forwarding them.
However, it does not give you any delivery information.

```ts
import { WakuMessage } from 'js-waku';

const msg = await WakuMessage.fromUtf8String("Here is a message!", "/my-cool-app/1/my-use-case/proto")
await waku.relay.send(msg);
```

#### Waku Light Push

[Waku Light Push](https://rfc.vac.dev/spec/19/) gives you confirmation that the light push server node has
received your message.
However, it means that said node knows you are the originator of the message.
It cannot guarantee that the node will forward the message.

```ts
const ack = await waku.lightPush.push(message);
if (!ack?.isSuccess) {
  // Message was not sent
}
```

### Retrieve archived messages

The [Waku v2 Store protocol](https://rfc.vac.dev/spec/13/) enables more permanent nodes to store messages received via relay
and ephemeral clients to retrieve them (e.g. mobile phone resuming connectivity).
The protocol implements pagination meaning that it may take several queries to retrieve all messages.

Query a waku store peer to check historical messages:

```ts
// Process messages once they are all retrieved
const messages = await waku.store.queryHistory(['/my-cool-app/1/my-use-case/proto']);
messages.forEach((msg) => {
  console.log('Message retrieved:', msg.payloadAsUtf8);
});

// Or, pass a callback function to be executed as pages are received:
waku.store.queryHistory(['/my-cool-app/1/my-use-case/proto'], {
  callback: (messages) => {
    messages.forEach((msg) => {
      console.log('Message retrieved:', msg.payloadAsUtf8);
    });
  }
});
```

### Encryption & Signature

With js-waku, you can:

- Encrypt messages over the wire using public/private key pair (asymmetric encryption),
- Encrypt messages over the wire using a unique key to both encrypt and decrypt (symmetric encryption),
- Sign and verify your waku messages (must use encryption, compatible with both symmetric and asymmetric).

#### Cryptographic Libraries

A quick note on the cryptographic libraries used as it is a not a straightforward affair:
- Asymmetric encryption:
  Uses [ecies-geth](https://github.com/cyrildever/ecies-geth/)
  which in turns uses [SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) Web API (browser),
  [secp256k1](https://www.npmjs.com/package/secp256k1) (native binding for node)
  or [elliptic](https://www.npmjs.com/package/elliptic) (pure JS if none of the other libraries are available).
- Symmetric encryption:
  Uses [SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) Web API (browser)
  or [NodeJS' crypto](https://nodejs.org/api/crypto.html) module.

### Create new keys

Asymmetric private keys and symmetric keys are expected to be 32 bytes arrays.

```ts
import { generatePrivateKey, generateSymmetricKey, getPublicKey } from 'js-waku';

// Asymmetric
const privateKey = generatePrivateKey();
const publicKey = getPublicKey(privateKey);

// Symmetric
const symKey = generateSymmetricKey();
```

#### Encrypt Waku Messages

To encrypt your waku messages, simply pass the encryption key when creating it:

```ts
import { WakuMessage } from "js-waku";

// Asymmetric
const message1 = await WakuMessage.fromBytes(payload, myAppContentTopic, {
  encPublicKey: publicKey,
});

// Symmetric
const message2 = await WakuMessage.fromBytes(payload, myAppContentTopic, {
  symKey: symKey,
});

```

#### Decrypt Waku Messages

##### Waku Relay

If you expect to receive encrypted messages then simply add private decryption key(s) to `WakuRelay`.
Waku Relay will attempt to decrypt incoming messages with each keys, both for symmetric and asymmetric encryption.
Messages that are successfully decrypted (or received in clear) will be passed to the observers, other messages will be omitted.

```ts
// Asymmetric
waku.relay.addDecryptionKey(privateKey);

// Symmetric
waku.relay.addDecryptionKey(symKey);

// Then add the observer
waku.relay.addObserver(callback, [contentTopic]);
```

Keys can be removed using `WakuMessage.deleteDecryptionKey`.

##### Waku Store

```ts
const messages = await waku.store.queryHistory([], {
  decryptionKeys: [privateKey, symKey]
});
```

Similarly to relay, only decrypted or clear messages will be returned.

#### Sign Waku Messages

As per version 1`s [specs](https://rfc.vac.dev/spec/26/), signatures are only included in encrypted messages.
In the case where your app does not need encryption then you could use symmetric encryption with a trivial key, I intend to dig [more on the subject](https://github.com/status-im/js-waku/issues/74#issuecomment-880440186) and come back with recommendation and examples.

Signature keys can be generated the same way asymmetric keys for encryption are:

```ts
import { generatePrivateKey, getPublicKey, WakuMessage } from 'js-waku';

const signPrivateKey = generatePrivateKey();

// Asymmetric Encryption
const message1 = await WakuMessage.fromBytes(payload, myAppContentTopic, {
  encPublicKey: recipientPublicKey,
  sigPrivKey: signPrivateKey
});

// Symmetric Encryption
const message2 = await WakuMessage.fromBytes(payload, myAppContentTopic, {
  encPublicKey: symKey,
  sigPrivKey: signPrivateKey
});

```

#### Verify Waku Message signatures

Two fields are available on `WakuMessage` regarding signatures:

- `signaturePublicKey`: If the message is signed, it holds the public key of the signature,
- `signature`: If the message is signed, it holds the actual signature.

Thus, if you expect messages to be signed by Alice,
you can simply compare `WakuMessage.signaturePublicKey` with Alice's public key.
As comparing hex string can lead to issues (is the `0x` prefix present?),
simply use helper function `equalByteArrays`.

```ts
import { equalByteArrays } from 'js-waku/lib/utils';

const sigPubKey = wakuMessage.signaturePublicKey;

const isSignedByAlice = sigPubKey && equalByteArrays(sigPubKey, alicePublicKey);
```

## Changelog

Release changelog can be found [here](https://github.com/status-im/js-waku/blob/main/CHANGELOG.md).

## Bugs, Questions & Features

If you encounter any bug or would like to propose new features, feel free to [open an issue](https://github.com/status-im/js-waku/issues/new/).

To get help, join #dappconnect-support on [Vac Discord](https://discord.gg/j5pGbn7MHZ) or [Telegram](https://t.me/dappconnectsupport).

For more general discussion and latest news, join #dappconnect on [Vac Discord](https://discord.gg/9DgykdmpZ6) or [Telegram](https://t.me/dappconnect).

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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License
Licensed and distributed under either of

* MIT license: [LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT

or

* Apache License, Version 2.0, ([LICENSE-APACHE-v2](LICENSE-APACHE-v2) or http://www.apache.org/licenses/LICENSE-2.0)

at your option. These files may not be copied, modified, or distributed except according to those terms.
