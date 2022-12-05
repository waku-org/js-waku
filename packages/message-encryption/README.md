# `@waku/message-encryption`

Provide Waku Message Version 1 payload encryption as defined in [26/WAKU2-PAYLOAD](https://rfc.vac.dev/spec/26/).

## Symmetric Encryption

Symmetric encryption uses a unique key to encrypt and decrypt messages.

```typescript
import {
  createDecoder,
  createEncoder,
  generateSymmetricKey,
} from "@waku/message-encryption/symmetric";

// Generate a random key
const key = generateSymmetricKey();

// To send messages, create an encoder
const encoder = createEncoder(contentTopic, key);

// For example
waku.lightPush.push(encoder, { payload });

// To receive messages, create a decoder
const decoder = createDecoder(contentTopic, key);

// For example
await waku.store.queryOrderedCallback([decoder], (msg) => {
  // ...
});
```

## ECIES Encryption

ECIES encryption enables encryption for a public key and decryption using a private key.

```typescript
import {
  createDecoder,
  createEncoder,
  generatePrivateKey,
  getPublicKey,
} from "@waku/message-encryption/ecies";

// Generate a random private key
const privateKey = generatePrivateKey();

// Keep the private key secure, provide the public key to the sender
const publicKey = getPublicKey(privateKey);

// To send messages, create an encoder
const encoder = createEncoder(contentTopic, publicKey);

// For example
waku.lightPush.push(encoder, { payload });

// To receive messages, create a decoder
const decoder = createDecoder(contentTopic, privateKey);

// For example
await waku.store.queryOrderedCallback([decoder], (msg) => {
  // ...
});
```
