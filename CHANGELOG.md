# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `getStatusFleetNodes` to connect to Status' nim-waku nodes.

### Changed
- Clarify content topic format in README.md.

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

[Unreleased]: https://github.com/status-im/js-waku/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/status-im/js-waku/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/status-im/js-waku/compare/f46ce77f57c08866873b5c80acd052e0ddba8bc9...v0.1.0
