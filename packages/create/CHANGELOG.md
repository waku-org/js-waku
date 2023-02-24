# Changelog

All notable changes to this project will be documented in this file.

The file is maintained by [Release Please](https://github.com/googleapis/release-please) based on [Conventional Commits](https://www.conventionalcommits.org) specification,
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.7](https://github.com/waku-org/js-waku/compare/create-v0.0.6...create-v0.0.7) (2023-02-24)


### ⚠ BREAKING CHANGES

* bump typescript
* bump libp2p dependencies

### Features

* DNS discovery as default bootstrap discovery ([#1114](https://github.com/waku-org/js-waku/issues/1114)) ([11819fc](https://github.com/waku-org/js-waku/commit/11819fc7b14e18385d421facaf2af0832cad1da8))


### Bug Fixes

* Remove initialising peer-exchange while creating a node ([#1158](https://github.com/waku-org/js-waku/issues/1158)) ([1b41569](https://github.com/waku-org/js-waku/commit/1b4156902387ea35b24b3d6f5d22e4635ea8cf18))


### Miscellaneous Chores

* Bump libp2p dependencies ([803ae7b](https://github.com/waku-org/js-waku/commit/803ae7bd8ed3de665026446c23cde90e7eba9d36))
* Bump typescript ([12d86e6](https://github.com/waku-org/js-waku/commit/12d86e6abcc68e27c39ca86b4f0dc2b68cdd6000))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from * to 0.0.11
    * @waku/dns-discovery bumped from * to 0.0.6
    * @waku/peer-exchange bumped from * to 0.0.4
  * devDependencies
    * @waku/interfaces bumped from * to 0.0.8

## [Unreleased]

### Fixed

- Documentation links.

## [0.0.6] - 2022-12-19

### Fixed

- Missing dependency declarations.

## [0.0.5] - 2022-12-15

### Changed

- Renamed `createPrivacyNode` to `createRelayNode`.

## [0.0.4] - 2022-11-18

### Added

- Alpha version of `@waku/create`.

[unreleased]: https://github.com/waku-org/js-waku/compare/@waku/create@0.0.6...HEAD
[0.0.6]: https://github.com/waku-org/js-waku/compare/@waku/create@0.0.5...@waku/create@0.0.6
[0.0.5]: https://github.com/waku-org/js-waku/compare/@waku/create@0.0.4...@waku/create@0.0.5
[0.0.4]: https://github.com/waku-org/js-waku/compare/@waku/create@0.0.3...@waku/create@0.0.4
[0.0.3]: https://github.com/waku-org/js-waku/compare/@waku/create@0.0.2...%40waku/create@0.0.3
[0.0.2]: https://github.com/waku-org/js-waku/compare/@waku/create@0.0.1...%40waku/create@0.0.2
[0.0.1]: https://github.com/status-im/js-waku/compare/a20b7809d61ff9a9732aba82b99bbe99f229b935...%40waku/create%400.0.2
