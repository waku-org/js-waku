# Changelog

## [0.0.12](https://github.com/waku-org/js-waku/compare/proto-v0.0.11...proto-v0.0.12) (2025-07-18)


### Features

* **proto:** Add light push v3 definition ([14085de](https://github.com/waku-org/js-waku/commit/14085de3c4079c5d5c45e36a93168e0d67306c76))
* **proto:** Add light push v3 definition ([94788d0](https://github.com/waku-org/js-waku/commit/94788d0dfc616a4321ec6ec73121ead8cc1808b7))

## [0.0.11](https://github.com/waku-org/js-waku/compare/proto-v0.0.10...proto-v0.0.11) (2025-06-23)


### ⚠ BREAKING CHANGES

* upgrade libp2p, nodejs and typescript ([#2401](https://github.com/waku-org/js-waku/issues/2401))

### Miscellaneous Chores

* Upgrade libp2p, nodejs and typescript ([#2401](https://github.com/waku-org/js-waku/issues/2401)) ([fcc6496](https://github.com/waku-org/js-waku/commit/fcc6496fef914c56f6a4d2d17c494c8b94caea3c))

## [0.0.10](https://github.com/waku-org/js-waku/compare/proto-v0.0.9...proto-v0.0.10) (2025-04-23)


### Features

* **sds:** Add retrieval hint to causal history ([4da382d](https://github.com/waku-org/js-waku/commit/4da382d59489645802d9efeb68e8eb05cdc95ec1))
* **sds:** Add retrieval hint to causal history ([408be95](https://github.com/waku-org/js-waku/commit/408be95a1317210e43a2caff3ecff40d457d17c4))

## [0.0.9](https://github.com/waku-org/js-waku/compare/proto-v0.0.8...proto-v0.0.9) (2025-03-24)


### Features

* **sds:** Add message channel with buffers and send/receive logic ([4cd1eea](https://github.com/waku-org/js-waku/commit/4cd1eea05a470a23cde8a6457addd3ac76289045))
* **sds:** Add message channel with buffers and send/receive logic ([389ca40](https://github.com/waku-org/js-waku/commit/389ca4062eebda91eac6d8e212ca4d063e7ac103))
* **sds:** Create package for sds and add protobuf def ([6abd2d1](https://github.com/waku-org/js-waku/commit/6abd2d18a13f4a960c1d34404afd5972956035b4))
* **sds:** Create package for sds and add protobuf def ([468512f](https://github.com/waku-org/js-waku/commit/468512fa85a5e6c1618803338e0e9d17e1a9c4b7))

## [0.0.8](https://github.com/waku-org/js-waku/compare/proto-v0.0.7...proto-v0.0.8) (2024-08-29)


### ⚠ BREAKING CHANGES

* store v3 ([#2036](https://github.com/waku-org/js-waku/issues/2036))

### Features

* Store v3 ([#2036](https://github.com/waku-org/js-waku/issues/2036)) ([86f730f](https://github.com/waku-org/js-waku/commit/86f730f9587e3688b79c8e846e5c005bb4d5fae4))

## [0.0.7](https://github.com/waku-org/js-waku/compare/proto-v0.0.6...proto-v0.0.7) (2024-04-30)


### Bug Fixes

* Use correct error message for store rate limit ([6990e6f](https://github.com/waku-org/js-waku/commit/6990e6f4e04d57ac06ef370c8c3642a17911cdf3))

## [0.0.6](https://github.com/waku-org/js-waku/compare/proto-v0.0.5...proto-v0.0.6) (2024-01-10)


### Features

* Metadata protocol ([#1732](https://github.com/waku-org/js-waku/issues/1732)) ([9ac2a3f](https://github.com/waku-org/js-waku/commit/9ac2a3f36352523b79fcd8f8a94bd6e0e109fc30))

## [0.0.5](https://github.com/waku-org/js-waku/compare/proto-v0.0.4...proto-v0.0.5) (2023-05-26)


### ⚠ BREAKING CHANGES

* filter v2 ([#1332](https://github.com/waku-org/js-waku/issues/1332))

### Features

* Filter v2 ([#1332](https://github.com/waku-org/js-waku/issues/1332)) ([8d0e647](https://github.com/waku-org/js-waku/commit/8d0e64796695fbafad0a033552eb4412bdff3d78))

## [0.0.4](https://github.com/waku-org/js-waku/compare/proto-v0.0.3...proto-v0.0.4) (2023-03-24)


### Bug Fixes

* **utils:** Include all ts files ([#1267](https://github.com/waku-org/js-waku/issues/1267)) ([c284159](https://github.com/waku-org/js-waku/commit/c284159ac8eab5bed2313fa5bc7fbea0e83d390f))

## [0.0.3](https://github.com/waku-org/js-waku/compare/proto-v0.0.2...proto-v0.0.3) (2023-03-16)


### ⚠ BREAKING CHANGES

* enable encoding of `meta` field
* update store.proto
* update message.proto: payload and content topic are always defined
* bump protons from 5.1.0 to 7.0.2
* bump typescript
* bump all prod dependencies

### Features

* Enable encoding of `meta` field ([bd983ea](https://github.com/waku-org/js-waku/commit/bd983ea48ee73fda5a7137d5ef681965aeabb4a5))


### Bug Fixes

* Prettier and cspell ignore CHANGELOG ([#1235](https://github.com/waku-org/js-waku/issues/1235)) ([4d7b3e3](https://github.com/waku-org/js-waku/commit/4d7b3e39e6761afaf5d05a13cc4b3c23e15f9bd5))


### Miscellaneous Chores

* Bump all prod dependencies ([88cc76d](https://github.com/waku-org/js-waku/commit/88cc76d2b811e1fa4460207f38704ecfe18fb260))
* Bump protons from 5.1.0 to 7.0.2 ([2f2d266](https://github.com/waku-org/js-waku/commit/2f2d266e8180cd1e7b89a7e261a33f87acce6ed2))
* Bump typescript ([12d86e6](https://github.com/waku-org/js-waku/commit/12d86e6abcc68e27c39ca86b4f0dc2b68cdd6000))
* Update message.proto: payload and content topic are always defined ([5cf8ed2](https://github.com/waku-org/js-waku/commit/5cf8ed2030c9efbc4c4b66aa801827482c1e4249))
* Update store.proto ([967e6ff](https://github.com/waku-org/js-waku/commit/967e6ffc7ec6f780094e29599c47b723fa222dcc))

## Changelog

All notable changes to this project will be documented in this file.

The file is maintained by [Release Please](https://github.com/googleapis/release-please) based on [Conventional Commits](https://www.conventionalcommits.org) specification,
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
