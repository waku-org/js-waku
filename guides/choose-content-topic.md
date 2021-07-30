# How to Choose a Content Topic

A content topic is used for content based filtering.

It allows you to filter out the messages that your dApp processes,
both when receiving live messages (Relay) or retrieving historical messages (Store).

The format for content topics is as follows:

`/{dapp-name}/{version}/{content-topic-name}/{encoding}`

- `dapp-name`: The name of your dApp, it must be unique to avoid conflict with other dApps.
- `version`: We usually start at `1`, useful when introducing breaking changes in your messages.
- `content-topic-name`: The actual content topic name to use for filtering.
  If your dApp uses DappConnect for several features,
  you should use a content topic per feature.
- `encoding`: The encoding format of the message, we recommend using Protobuf: `proto`.

For example: Your dApp's name is SuperCrypto,
it enables users to receive notifications and send private messages.
You may want to use the following content topics:

- `/supercrypto/1/notification/proto`
- `/supercrypto/1/private-message/proto`

You can learn more about Waku topics in the [23/WAKU2-TOPICS](https://rfc.vac.dev/spec/23/) specs.
