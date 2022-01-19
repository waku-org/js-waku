# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.15.0] - 2022-01-17

### Added

- Implement DNS Discovery as per [EIP-1459](https://eips.ethereum.org/EIPS/eip-1459),
  with ENR records as defined in [31/WAKU2-ENR](https://rfc.vac.dev/spec/31/);
  Available by passing `{ bootstrap: { enrUrl: enrtree://... } }` to `Waku.create`.
- When using `addDecryptionKey`,
  it is now possible to specify the decryption method and the content topics of the messages to decrypt;
  this is to reduce the number of decryption attempt done and improve performance.

### Changed

- Test: Upgrade nim-waku node to v0.6.
- **Breaking**: Renamed `getBootstrapNodes` to `getNodesFromHostedJson`.
- Minimum node version changed to 16.
- **Breaking**: Changed `Waku.create` bootstrap option from `{ bootstrap: boolean }` to `{ bootstrap: BootstrapOptions }`.
  Replace `{ boostrap: true }` with `{ boostrap: { default: true } }` to retain same behaviour.
- **Breaking**: `WakuMessage.decode` and `WakuMessage.decodeProto` now accepts method and content topics for the decryption key.
  `WakuMessage.decode(bytes, [key])` becomes `WakuMessage.decode(bytes, [{key: key}])`.

### Fixed

- Doc: Some broken links.

## [0.14.2] - 2021-11-30

### Changed

- Examples: JS examples uses local ESM folder to replicate behaviour of js-waku publish package.

### Fixed

- `TypeError` issue related to constructors using js-waku in a JS project
  ([#323](https://github.com/status-im/js-waku/issues/323)).

## [0.14.1] - 2021-10-22

### Fixed
- Issue when importing the `utils` module.

## [0.14.0] - 2021-10-13

### Added
- If the `callback` function passed to`WakuStore.queryHistory` returns `true`, then no further pages are retrieved from the store.
- Use webpack to build UMD bundle of the library, see [README](./README.md) for usage.

### Changed
- **Breaking**: Renamed `WakuStore.QueryOptions`'s `direction` to `pageDirection` (and its type) as it only affects the page ordering,
  not the ordering of messages with the page.

### Fixed
- Docs: Ensure that `WakuStore`'s `QueryOptions` documentation is available [online](https://status-im.github.io/js-waku/docs/).

## [0.13.1] - 2021-09-21

### Fixed

- `Error: Bootstrap requires a list of peer addresses` error when using `bootstrap: true` in `Waku.create`.

## [0.13.0] - 2021-09-16

### Changed
- Upgrade libp2p libraries: @chainsafe/libp2p-noise@4.1.1, libp2p@0.32.4, libp2p-gossipsub@0.11.1.
- Connects to a limited number of bootstrap nodes, defaults to 1. 

## [0.12.2] - 2021-09-21

### Fixed

- **hot fix**: `Error: Bootstrap requires a list of peer addresses` error when using `bootstrap: true` in `Waku.create`.

## [0.12.1] - 2021-09-16

### Changed
- **hot fix**: Connects to a limited number of bootstrap nodes, defaults to 1.

## [0.12.0] - 2021-09-2

### Added
- Examples (eth-pm): Encrypt Public Key Messages using symmetric encryption. 
- Guides: Encrypt messages using Waku Message Version 1.
- Allow passing decryption keys in hex string format.
- Allow passing decryption keys to `WakuStore` instance to avoid having to pass them at every `queryHistory` call.
- Allow passing decryption keys to `Waku` instance to avoid having to pass them to both `WakuRelay` and `WakuStore`.
- `Waku.waitForConnectedPeer` helper to ensure that we are connected to Waku peers when using the bootstrap option.

### Changed
- **Breaking**: Moved `startTime` and `endTime` for history queries to a `timeFilter` property as both or neither must be passed; passing only one parameter is not supported.
- Renamed and promote the usage of `generateSymmetricKey()` to generate random symmetric keys.
- Improved errors thrown by `WakuStore.queryHistory`.

### Fixed
- Buffer concat error when using symmetric encryption in the browser.

## [0.11.0] - 2021-08-20

### Added
- Examples: New [Ethereum Private Message Using Wallet Encryption Web App](./examples/eth-pm-wallet-encryption/README.md)
  example that demonstrates the usage of `eth_encrypt` API (available on Metamask) and EIP-712 for typed structured data signing.
- New `bootstrap` option for `Waku.create` to easily connect to Waku nodes upon start up.
- Support for `startTime` and `endTime` in Store queries to filter by time window as per [21/WAKU2-FTSTORE](https://rfc.vac.dev/spec/21/).

### Changed
- Renamed `discover.getStatusFleetNodes` to `discovery.getBootstrapNodes`; 
  Changed the API to allow retrieval of bootstrap nodes from other sources.
- Examples: Renamed `eth-dm` to `eth-pm`; "Direct Message" can lead to confusion with "Direct Connection" that
  refers to low latency network connections.
- Examples (eth-pm): Use sign typed data EIP-712 instead of personal sign. 
- Upgraded dependencies to remove warning at installation.
- **Breaking**: Moved `DefaultPubSubTopic` to `waku.ts` and fixed the casing.
- **Breaking**: Rename all `pubsubTopic` occurrences to `pubSubTopic`, across all interfaces.

### Removed
- Examples (cli-chat): The focus of this library is Web environment;
  Several examples now cover usage of Waku Relay and Waku Store making cli-chat example obsolete;
  web-chat POC should be preferred to use the [TOY-CHAT](https://rfc.vac.dev/spec/22/) protocol.
- `ChatMessage` has been moved from js-waku to web-chat example;
  it is a type used for the [TOY-CHAT](https://rfc.vac.dev/spec/22/) protocol;
  js-waku users should not build on top if this toy protocol and instead design message data structures appropriate to their use case.
- Unused dependencies & scripts.

## [0.10.0] - 2021-08-06

### Added
- Relay and ReactJS guides and examples
  ([#56](https://github.com/status-im/js-waku/issues/56)).

### Changed
- **Breaking**: The `WakuMessage` APIs have been changed to move `contentTopic` out of the optional parameters.
- **Breaking**: Move `contentTopics` out the `WakuStore.queryHistory`'s optional parameters.
- **Breaking**: `WakuStore.queryHistory` throws when encountering an error instead of returning a `null` value.

### Removed
- Examples (web-chat): Remove broken `/fleet` command.
- **Breaking**: Removed `DefaultContentTopic` as developers must choose a content topic for their app;
  recommendations for content topic can be found at https://rfc.vac.dev/spec/23/.

### Fixed
- `WakuMessage.payloadAsUtf8` returning garbage on utf-8 non-ascii characters.
- `ChatMessage.payloadAsUtf8` returning garbage on utf-8 non-ascii characters.

## [0.9.0] - 2021-07-26

### Changed
- **Breaking**: Store Response Protobuf changed to align with nim-waku v0.5
  ([nim-waku#676](https://github.com/status-im/nim-waku/pull/676)).

## [0.8.1] - 2021-07-16

### Added
- Examples (web-chat): New `/fleet` command to switch connection between Status prod and test fleets.
- Export `generatePrivateKey` and `getPublicKey` directly from the root.
- Usage of the encryption and signature APIs to the readme.
- Support multiple protocol ids for Waku Relay, allowing interoperability with nim-waku v0.4 and latest master
  ([#238](https://github.com/status-im/js-waku/issues/238)).

### Changed
- **Breaking**: Renamed `WakuRelay.(add|delete)PrivateDecryptionKey` to `WakuRelay.(add|delete)DecryptionKey` to make it clearer that it accepts both symmetric keys and asymmetric private keys.
- Upgrade libp2p to 0.32.0.
- **Breaking**: Rename `keepAlive` option to `pingKeepAlive`.
- Introduced new `relayKeepAlive` option on `Waku` with a default to 59s to send ping messages over relay to ensure the relay stream stays open.
  This is a workaround until [js-libp2p#744](https://github.com/libp2p/js-libp2p/issues/744) is done as there are issues when TCP(?) timeouts and the stream gets closed
  ([#185](https://github.com/status-im/js-waku/issues/185), [js-libp2p#939](https://github.com/libp2p/js-libp2p/issues/939))

### Fixed
- Align `WakuMessage` readme example with actual code behaviour.
- Remove infinite loop when an error with Waku Store is encountered.

## [0.8.0] - 2021-07-15

### Added
- `WakuRelay.deleteObserver` to allow removal of observers, useful when a React component add observers when mounting and needs to delete it when unmounting. 
- Keep alive feature that pings host regularly, reducing the chance of connections being dropped due to idle.
  Can be disabled or default frequency (10s) can be changed when calling `Waku.create`.
- New `lib/utils` module for easy, dependency-less hex/bytes conversions.
- New `peers` and `randomPeer` methods on `WakuStore` and `WakuLightPush` to have a better idea of available peers;
  Note that it does not check whether Waku node is currently connected to said peers.
- Enable passing decryption private keys to `WakuStore.queryHistory`.
- Test: Introduce testing in browser environment (Chrome) using Karma.
- Add support for Waku Message version 1: Asymmetric encryption, symmetric encryption, and signature of the data.

### Changed
- **Breaking**: Auto select peer if none provided for store and light push protocols.
- Upgrade to `libp2p@0.31.7` and `libp2p-gossipsub@0.10.0` to avoid `TextEncoder` errors in ReactJS tests.
- Disable keep alive by default as latest nim-waku release does not support ping protocol.
- **Breaking**: Optional parameters for `WakuMessage.fromBytes` and `WakuMessage.fromUtf8String` are now passed in a single `Options` object.
- **Breaking**: `WakuMessage` static functions are now async to allow for encryption and decryption.
- **Breaking**: `WakuMessage` constructor is now private, `from*` and `decode*` function should be used.
- `WakuMessage` version 1 is partially supported, enabling asymmetrical encryption and signature of messages;
  this can be done by passing keys to `WakuMessage.from*` and `WakuMessage.decode*` methods.
- Examples (eth-dm): Use Waku Message version 1 encryption scheme instead of `eth-crypto`.
- Examples (eth-dm): Use Protobuf for direct messages instead of JSON ([#214](https://github.com/status-im/js-waku/issues/214)).

### Fixed
- Disable `keepAlive` if set to `0`.

## [0.7.0] - 2021-06-15

### Changed
- Test: Upgrade nim-waku node to v0.4.
- Waku Light Push upgraded to `2.0.0-beta1`.
- Examples (web chat): Catch error if chat message decoding fails.
- Examples (web chat): Do not send message if shift/alt/ctrl is pressed, enabling multiline messages.

## [0.6.0] - 2021-06-09

### Changed
- **Breaking**: Websocket protocol is not automatically added anymore if the user specifies a protocol in `libp2p.modules`
  when using `Waku.create`.
- **Breaking**: Options passed to `Waku.create` used to be passed to `Libp2p.create`;
  Now, only the `libp2p` property is passed to `Libp2p.create`, allowing for a cleaner interface.
- Examples (cli chat): Use tcp protocol instead of websocket.  

### Added
- Enable access to `WakuMessage.timestamp`.
- Examples (web chat): Use `WakuMessage.timestamp` as unique key for list items.
- Doc: Link to new [topic guidelines](https://rfc.vac.dev/spec/23/) in README.
- Doc: Link to [Waku v2 Toy Chat specs](https://rfc.vac.dev/spec/22/) in README.
- Examples (web chat): Persist nick.
- Support for custom PubSub Topics to `Waku`, `WakuRelay`, `WakuStore` and `WakuLightPush`;
  Passing a PubSub Topic is optional and still defaults to `/waku/2/default-waku/proto`;
  JS-Waku currently supports one, and only, PubSub topic per instance.  

## [0.5.0] - 2021-05-21

### Added
- Implement [Waku v2 Light Push protocol](https://rfc.vac.dev/spec/19/).
- Expose `Direction` enum from js-waku root (it was only accessible via the proto module).
- Examples (cli chat): Use light push to send messages if `--lightPush` is passed.
- Examples (cli chat): Print usage if `--help` is passed.

## [0.4.0] - 2021-05-18

### Added
- `callback` argument to `WakuStore.queryHistory()`, called as messages are retrieved
  ; Messages are retrieved using pagination, and it may take some time to retrieve all messages,
  with the `callback` function, messages are processed as soon as they are received. 

### Changed
- Testing: Upgrade nim-waku node to v0.3.
- **Breaking**: Modify `WakuStore.queryHistory()` to accept one `Object` instead of multiple individual arguments.
- `getStatusFleetNodes` return prod nodes by default, instead of test nodes.
- Examples (web chat): Connect to prod fleet by default, test fleet for local development.
- Examples (cli chat): Connect to test fleet by default, use `--prod` to connect to prod fleet.

### Fixed
- Expose `Enviroment` and `Protocol` enums to pass to `getStatusFleetNodes`.

## [0.3.0] - 2021-05-15

### Added
- `getStatusFleetNodes` to connect to Status' nim-waku nodes.

### Changed
- Clarify content topic format in README.md.

## Removed
- Unused dependencies.

## [0.2.0] - 2021-05-14

### Added
- `WakuRelay.getPeers` method.
- Use `WakuRelay.getPeers` in web chat app example to disable send button.

### Changed
- Enable passing `string`s to `addPeerToAddressBook`.
- Use `addPeerToAddressBook` in examples and usage doc.
- Settle on `js-waku` name across the board.
- **Breaking**: `RelayDefaultTopic` renamed to `DefaultPubsubTopic`.

## [0.1.0] - 2021-05-12

### Added
- Add usage section to the README.
- Support of [Waku v2 Relay](https://rfc.vac.dev/spec/11/).
- Support of [Waku v2 Store](https://rfc.vac.dev/spec/13/).
- [Node Chat App example](./examples/cli-chat).
- [ReactJS Chat App example](./examples/web-chat).
- [Typedoc Documentation](https://status-im.github.io/js-waku/docs).

[Unreleased]: https://github.com/status-im/js-waku/compare/v0.15.0...HEAD
[0.15.0]: https://github.com/status-im/js-waku/compare/v0.14.2...v0.15.0
[0.14.2]: https://github.com/status-im/js-waku/compare/v0.14.1...v0.14.2
[0.14.1]: https://github.com/status-im/js-waku/compare/v0.14.0...v0.14.1
[0.14.0]: https://github.com/status-im/js-waku/compare/v0.13.1...v0.14.0
[0.13.1]: https://github.com/status-im/js-waku/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/status-im/js-waku/compare/v0.12.0...v0.13.0
[0.12.2]: https://github.com/status-im/js-waku/compare/v0.12.1...v0.12.2
[0.12.1]: https://github.com/status-im/js-waku/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/status-im/js-waku/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/status-im/js-waku/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/status-im/js-waku/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/status-im/js-waku/compare/v0.8.1...v0.9.0
[0.8.1]: https://github.com/status-im/js-waku/compare/v0.8.0...v0.8.1
[0.8.1]: https://github.com/status-im/js-waku/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/status-im/js-waku/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/status-im/js-waku/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/status-im/js-waku/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/status-im/js-waku/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/status-im/js-waku/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/status-im/js-waku/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/status-im/js-waku/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/status-im/js-waku/compare/f46ce77f57c08866873b5c80acd052e0ddba8bc9...v0.1.0
