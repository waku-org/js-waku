# Changelog

All notable changes to this project will be documented in this file.

The file is maintained by [Release Please](https://github.com/googleapis/release-please) based on [Conventional Commits](https://www.conventionalcommits.org) specification,
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.8](https://github.com/waku-org/js-waku/compare/interfaces-v0.0.7...interfaces-v0.0.8) (2023-03-01)


### ⚠ BREAKING CHANGES

* update store.proto
* update message.proto: payload and content topic are always defined
* ConnectionManager and KeepAliveManager ([#1135](https://github.com/waku-org/js-waku/issues/1135))
* bump typescript
* bump libp2p dependencies

### Features

* Codec as a property of the protocol implementations ([a5ff788](https://github.com/waku-org/js-waku/commit/a5ff788eed419556e11319f22ca9e3109c81df92))
* ConnectionManager and KeepAliveManager ([#1135](https://github.com/waku-org/js-waku/issues/1135)) ([24c24cc](https://github.com/waku-org/js-waku/commit/24c24cc27d83ec12de45ef3cf3d00f6eb817e4ca))


### Bug Fixes

* Remove initialising peer-exchange while creating a node ([#1158](https://github.com/waku-org/js-waku/issues/1158)) ([1b41569](https://github.com/waku-org/js-waku/commit/1b4156902387ea35b24b3d6f5d22e4635ea8cf18))


### Miscellaneous Chores

* Bump libp2p dependencies ([803ae7b](https://github.com/waku-org/js-waku/commit/803ae7bd8ed3de665026446c23cde90e7eba9d36))
* Bump typescript ([12d86e6](https://github.com/waku-org/js-waku/commit/12d86e6abcc68e27c39ca86b4f0dc2b68cdd6000))
* Update message.proto: payload and content topic are always defined ([5cf8ed2](https://github.com/waku-org/js-waku/commit/5cf8ed2030c9efbc4c4b66aa801827482c1e4249))
* Update store.proto ([967e6ff](https://github.com/waku-org/js-waku/commit/967e6ffc7ec6f780094e29599c47b723fa222dcc))

## [Unreleased]

### Added

- `multicodec` property on protocol interfaces.

## [0.0.7] - 2023-01-18

### Added

- `IPeerExchange` interface.
- `IEnr` interface.

## [0.0.6] - 2022-12-15

### Changed

- Add `I` prefix to protocol and messages interfaces.
- Renamed node interfaces to include `Node`.
- Renamed `WakuPrivacy` to `RelayNode`.

## [0.0.5] - 2022-11-18

### Added

- Alpha version of `@waku/interfaces`.

[unreleased]: https://github.com/waku-org/js-waku/compare/@waku/interfaces@0.0.7...HEAD
[0.0.7]: https://github.com/waku-org/js-waku/compare/@waku/interfaces@0.0.6...@waku/interfaces@0.0.7
[0.0.6]: https://github.com/waku-org/js-waku/compare/@waku/interfaces@0.0.5...@waku/interfaces@0.0.6
[0.0.5]: https://github.com/waku-org/js-waku/compare/@waku/interfaces@0.0.4...@waku/interfaces@0.0.5
[0.0.4]: https://github.com/waku-org/js-waku/compare/@waku/interfaces@0.0.3...@waku/interfaces@0.0.4
[0.0.3]: https://github.com/waku-org/js-waku/compare/@waku/interfaces@0.0.2...%40waku/create@0.0.3
[0.0.2]: https://github.com/waku-org/js-waku/compare/@waku/interfaces@0.0.1...%40waku/create@0.0.2
[0.0.1]: https://github.com/status-im/js-waku/compare/a20b7809d61ff9a9732aba82b99bbe99f229b935...%40waku/create%400.0.2
