# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Enable access to `WakuMessage.timestamp`.
- Examples (web chat): Use `WakuMessage.timestamp` as unique key for list items.
- Doc: Link to new [topic guidelines](https://rfc.vac.dev/spec/23/) in README.

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

[Unreleased]: https://github.com/status-im/js-waku/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/status-im/js-waku/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/status-im/js-waku/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/status-im/js-waku/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/status-im/js-waku/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/status-im/js-waku/compare/f46ce77f57c08866873b5c80acd052e0ddba8bc9...v0.1.0
