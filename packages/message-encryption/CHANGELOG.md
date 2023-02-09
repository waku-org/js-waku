# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from * to 0.0.11
    * @waku/interfaces bumped from * to 0.0.8

## [Unreleased]

## [0.0.9] - 2023-01-25

### Fixed

- Moved `@chai` and `@fast-check` to `devDependencies` list.

## [0.0.8] - 2023-01-18

### Changed

- Export `Encoder` and `Decoder` types.
- Moved `@chai` and `@fast-check` to `dependencies` list.
- Added missing `@js-sha3` and `@debug` to `dependencies` list.

## [0.0.7] - 2022-12-19

### Fixed

- Incorrect `proto` import.

## [0.0.6] - 2022-12-16

### Fixed

- Type resolution when using `moduleResolution: node`.

## [0.0.5] - 2022-12-15

### Added

- Add `@multiformats/multiaddr` as peer dependency.
- New `createEncoder` and `createDecoder` functions so that the consumer does not deal with Encoder/Decoder classes.
-

### Changed

- `Asymmetric` renamed to `ECIES` to follow RFC terminology.
- Split `ECIES` and `symmetric` packages, all items are now export from two different paths: `@waku/message-encryption/ecies` and `@waku/message-encryption/symmetric`.
- remove `asym` and `sym` prefix from exported items as they are now differentiated from their export path: `createEncoder`, `createDecoder`, `DecodedMessage`.
- Remove usage for `Partial` with `Message` as `Message`'s field are all optional.

## [0.0.4] - 2022-11-18

### Added

- Alpha version of `@waku/message-encryption`.

[unreleased]: https://github.com/waku-org/js-waku/compare/@waku/message-encryption@0.0.9...HEAD
[0.0.9]: https://github.com/waku-org/js-waku/compare/@waku/message-encryption@0.0.8...@waku/message-encryption@0.0.9
[0.0.8]: https://github.com/waku-org/js-waku/compare/@waku/message-encryption@0.0.7...@waku/message-encryption@0.0.8
[0.0.7]: https://github.com/waku-org/js-waku/compare/@waku/message-encryption@0.0.6...@waku/message-encryption@0.0.7
[0.0.6]: https://github.com/waku-org/js-waku/compare/@waku/message-encryption@0.0.5...@waku/message-encryption@0.0.6
[0.0.5]: https://github.com/waku-org/js-waku/compare/@waku/message-encryption@0.0.4...@waku/message-encryption@0.0.5
[0.0.4]: https://github.com/waku-org/js-waku/compare/@waku/message-encryption@0.0.3...@waku/message-encryption@0.0.4
[0.0.3]: https://github.com/waku-org/js-waku/compare/@waku/message-encryption@0.0.2...%40waku/message-encryption@0.0.3
[0.0.2]: https://github.com/waku-org/js-waku/compare/@waku/message-encryption@0.0.1...%40waku/message-encryption@0.0.2
[0.0.1]: https://github.com/status-im/js-waku/compare/a20b7809d61ff9a9732aba82b99bbe99f229b935...%40waku/message-encryption%400.0.2
