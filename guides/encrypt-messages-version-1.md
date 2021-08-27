# Encrypt Messages Using Waku Message Version 1

The Waku Message format provides an easy way to encrypt messages using symmetric or asymmetric encryption.
The encryption comes with several handy [design requirements](https://rfc.vac.dev/spec/26/#design-requirements):
confidentiality, authenticity and integrity.

You can find more details about Waku Message Payload Encryption in [26/WAKU-PAYLOAD](https://rfc.vac.dev/spec/26/).

## What data is encrypted

With Waku Message Version 1, the entire payload is encrypted.

Which means that the only discriminating data available in clear text is the content topic and timestamp (if present).
Hence, if Alice expects to receive messages under a given content topic, she needs to try to decrypt all messages received on said content topic.

This needs to be kept in mind for scalability and forward secrecy concerns:

- If there is high traffic on a given content topic then all clients need to process and attempt decryption of all messages with said content topic;
- If a content topic is only used by a given (group of) user(s) then it is possible to deduce some information about said user(s) communications such as sent time and frequency of messages.

## Key management

By using Waku Message Version 1, you will need to provide a way to your users to generate and store keys in a secure manner.
Storing, backing up and recovering key is out of the scope of this guide.

If key recovery is important for your dApp, then check out
[SubtleCrypto.wrapKey()(https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/wrapKey) which can be used to securely store or export private keys.

An example to save and load a key pair in local storage, protected with a password, can be found in [Eth-PM](https://github.com/status-im/js-waku/blob/main/examples/eth-pm/src/key_pair_handling/key_pair_storage.ts).

## Which encryption method do I need?

Whether you should use symmetric or asymmetric encryption depends on your use case.

**Symmetric** encryption is done using a single key to encrypt and decrypt.

Which means that if Alice knows the symmetric key `K` and uses it to encrypt a message,
she can also use `K` to decrypt any message encrypted with `K`,
even if she is not the sender.

Group chats is a possible use case for symmetric encryption:
All participants can use an out-of-band method to agree on a `K`.
Participants can then use `K` to encrypt and decrypt messages within the group chat.
Participants MUST keep `K` secret to ensure that no external party can decrypt the group chat messages.

**Asymmetric** encryption is done using a key pair:
the public key is used to encrypt messages,
the matching private key is used to decrypt messages.

For Alice to encrypt a message for Bob, she needs to know Bob's Public Key `K`.
Bob can then use his private key `k` to decrypt the message.
As long as Bob keep his private key `k` secret, then he, and only he, can decrypt messages encrypted with `K`.

Private 1:1 messaging is a possible use case for asymmetric encryption:
When Alice sends an encrypted message for Bob, only Bob can decrypt it.

## Symmetric Encryption

### Generate Key

To use symmetric encryption, you first need to generate a key.
You can simply use `generatePrivateKey` for secure key generation:

```js
import { generatePrivateKey } from 'js-waku';

const key = generatePrivateKey();
```

### Encrypt Message

To encrypt a message with the previously generated key,
pass the key in the `symKey` property to `WakuMessage.fromBytes`.

Same as Waku Messages version 0 (unencrypted),
`payload` is your message payload and `contentTopic` is the content topic for your dApp.
See [Receive and Send Messages Using Waku Relay](relay-receive-send-messages.md) for details.

```js
import { WakuMessage } from 'js-waku';

const message = await WakuMessage.fromBytes(payload, contentTopic, {
  symKey: key
});
```

The Waku Message can then be sent to the Waku network using [Waku Relay](relay-receive-send-messages.md) or Waku Light Push:

```js
await waku.lightPush.push(message);
```

### Decrypt Messages

#### Waku Relay

To decrypt messages received over Waku Relay, add the key as a decryption key to your Waku Relay instance.

```js
waku.relay.addDecryptionKey(key);
```

`waku.relay` will attempt to decrypt any message it receives using the key, for both symmetric and asymmetric encryption.
If the message is successfully decrypted, then the decrypted messages will be passed to the observers you have registered.

You can call `addDecryptionKey` several times if you are using multiple keys,
symmetric key and asymmetric private keys can be used together.

Messages that are not successfully decrypted are dropped.

To learn more about Waku Relay, check out [Receive and Send Messages Using Waku Relay](relay-receive-send-messages.md).

#### Waku Store

To decrypt messages retrieved via a store query,
pass the `key` to the query in the `decryptionKeys` property.

`decryptionKeys` accepts an array, allowing you to pass several keys.

Symmetric keys or asymmetric private keys can be mixed, both decryption methods will be attempted.

```js
// Using await syntax
const messages = await waku.store.queryHistory([contentTopic], {
  decryptionKeys: [key]
});

// Using callback syntax
waku.store.queryHistory([contentTopic], {
  decryptionKeys: [key],
  callback: (messages) => {
    // Process decrypted messages
  }
});
```

Messages that are not successfully decrypted are excluded from the result array.

## Asymmetric Encryption

### Generate Key Pair

To use symmetric encryption, you first need to generate a private key and calculate the corresponding public key.
You can simply use `generatePrivateKey` for secure key generation:

```js
import { generatePrivateKey, getPublicKey } from 'js-waku';

const privateKey = generatePrivateKey();
const publicKey = getPublicKey(privateKey);
```

The private key must be securely stored and remain private.
If leaked then other parties may be able to decrypt the user's messages.

The public key is unique for a given private key and can always be recovered given the private key,
hence it is not needed to save it as long as as the private key can be recovered.

### Encrypt Message

The public key is used to encrypt messages;
to do so, pass it in the `encPublicKey` property to `WakuMessage.fromBytes`.

Same as clear Waku Messages,
`payload` is your message payload and `contentTopic` is the content topic for your dApp.
See [Receive and Send Messages Using Waku Relay](relay-receive-send-messages.md) for details.

```js
import { WakuMessage } from 'js-waku';

const message = await WakuMessage.fromBytes(payload, contentTopic, {
  encPublicKey: publicKey
});
```

The Waku Message can then be sent to the Waku network using [Waku Relay](relay-receive-send-messages.md) or Waku Light Push:

```js
await waku.lightPush.push(message);
```

### Decrypt Messages

#### Waku Relay

The private key is needed to decrypt messages.

For messages received over Waku Relay, add the private key as a decryption key to your Waku Relay instance.

```js
waku.relay.addDecryptionKey(privateKey);
```

`waku.relay` will attempt to decrypt any message it receives using the key, for both symmetric and asymmetric encryption.
If the message is successfully decrypted, then the decrypted messages will be passed to the observers you have registered.

You can call `addDecryptionKey` several times if you are using multiple keys,
symmetric key and asymmetric private keys can be used together.

Messages that are not successfully decrypted are dropped.

To learn more about Waku Relay, check out [Receive and Send Messages Using Waku Relay](relay-receive-send-messages.md).

#### Waku Store

To decrypt messages retrieved via a store query,
pass the `key` to the query in the `decryptionKeys` property.

`decryptionKeys` accepts an array, allowing you to pass several keys.

Symmetric keys or asymmetric private keys can be mixed, both decryption methods will be attempted.

```js
// Using await syntax
const messages = await waku.store.queryHistory([contentTopic], {
  decryptionKeys: [privateKey],
});

// Using callback syntax
waku.store.queryHistory([contentTopic], {
  decryptionKeys: [privateKey],
  callback: (messages) => {
    // Process decrypted messages
  },
});
```

Messages that are not successfully decrypted are excluded from the result array.

## Handling `WakuMessage` instances

When creating a Waku Message using `WakuMessage.fromBytes` with an encryption key (symmetric or asymmetric),
the payload gets encrypted.
Which means that `wakuMessage.payload` returns an encrypted payload:

```js
import { WakuMessage } from 'js-waku';

const message = await WakuMessage.fromBytes(payload, contentTopic, {
  encPublicKey: publicKey
});

console.log(message.payload); // This is encrypted
```

However, `WakuMessage` instances returned by `WakuRelay` or `WakuStore` are always decrypted.

`WakuRelay` and `WakuStore` never return messages that are encrypted.
If a message was not successfully decrypted, then it will be dropped from the results.

Which means that `WakuMessage` instances returned by `WakuRelay` and `WakuStore` always have a clear payload (in regard to Waku Message version 1):

```js
const messages = await waku.store.queryHistory([contentTopic], {
  decryptionKeys: [privateKey]
});

if (messages && messages[0]) {
  console.log(messages[0].payload); // This payload is decrypted
}

waku.relay.addDecryptionKey(privateKey);

waku.relay.addObserver((message) => {
  console.log(message.payload); // This payload is decrypted
}, [contentTopic]);
```


## Code Example

The [Eth-PM](https://github.com/status-im/js-waku/tree/main/examples/eth-pm) Web App example demonstrates both the use of symmetric and asymmetric encryption.

Asymmetric encryption is used for private messages so that only the intended recipient can read said messages.

Symmetric encryption is used for the public key messages.
In this instance, the same key is used for all users: the Keccak-256 hash of the content topic (which results in 32 bytes array).
While this does not add functional value, it does demonstrate the usage of symmetric encryption in a web app.

A live version of Eth-PM can be found at https://status-im.github.io/js-waku/eth-pm/.

The specifications of the protocol it implements can be found at [20/TOY-ETH-PM](https://rfc.vac.dev/spec/20/).
