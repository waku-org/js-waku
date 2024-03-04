# Changelog

All notable changes to this project will be documented in this file.

The file is maintained by [Release Please](https://github.com/googleapis/release-please) based on [Conventional Commits](https://www.conventionalcommits.org) specification,
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/dns-discovery bumped from 0.0.8 to 0.0.9

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.14 to 0.0.15

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.16 to 0.0.17
    * @waku/dns-discovery bumped from 0.0.10 to 0.0.11
  * devDependencies
    * @waku/interfaces bumped from 0.0.11 to 0.0.12

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/utils bumped from 0.0.9 to 0.0.10
    * @waku/relay bumped from 0.0.4 to 0.0.5
    * @waku/core bumped from 0.0.21 to 0.0.22
    * @waku/interfaces bumped from 0.0.16 to 0.0.17
    * @waku/dns-discovery bumped from 0.0.15 to 0.0.16

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/utils bumped from 0.0.12 to 0.0.13
    * @waku/relay bumped from 0.0.7 to 0.0.8
    * @waku/core bumped from 0.0.24 to 0.0.25
    * @waku/dns-discovery bumped from 0.0.18 to 0.0.19
    * @waku/interfaces bumped from 0.0.19 to 0.0.20
    * @waku/peer-exchange bumped from ^0.0.17 to ^0.0.18

## [0.0.23](https://github.com/waku-org/js-waku/compare/sdk-v0.0.22...sdk-v0.0.23) (2024-03-04)


### ⚠ BREAKING CHANGES

* rename local-discovery to local-peer-cache-discovery ([#1867](https://github.com/waku-org/js-waku/issues/1867))
* discourage the use of relay in browsers ([#1778](https://github.com/waku-org/js-waku/issues/1778))

### Features

* Add bootstrapPeers option and refactor sdk ([#1871](https://github.com/waku-org/js-waku/issues/1871)) ([9f198dd](https://github.com/waku-org/js-waku/commit/9f198dd149ef299e3edce69b93cc2942c6f24846))
* Create node and subscription by content topic ([ee2d417](https://github.com/waku-org/js-waku/commit/ee2d4176f8cca45a51b7dac0009f0eb01952f540))
* Decouple sharding params out of core ([e138b4f](https://github.com/waku-org/js-waku/commit/e138b4f5c49a35a37830e31e8be87d824f53249f))
* Local discovery ([#1811](https://github.com/waku-org/js-waku/issues/1811)) ([199f6ab](https://github.com/waku-org/js-waku/commit/199f6ab2ff83694b93e94e935e2925537e01e281))
* Make ShardingParams optional in sdk, required internally ([68d3229](https://github.com/waku-org/js-waku/commit/68d3229644f395bd84b2e2a7067c7b51e9da3dd0))


### Miscellaneous Chores

* Discourage the use of relay in browsers ([#1778](https://github.com/waku-org/js-waku/issues/1778)) ([906c933](https://github.com/waku-org/js-waku/commit/906c93329e4094c79e3f7f5c56e1b78afd778e1a))
* Rename local-discovery to local-peer-cache-discovery ([#1867](https://github.com/waku-org/js-waku/issues/1867)) ([f3cb10d](https://github.com/waku-org/js-waku/commit/f3cb10d484bac134377b8cfd77e077ffc33bd319))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.26 to 0.0.27
    * @waku/dns-discovery bumped from 0.0.20 to 0.0.21
    * @waku/interfaces bumped from 0.0.21 to 0.0.22
    * @waku/local-peer-cache-discovery bumped from ^0.0.1 to ^1.0.0
    * @waku/peer-exchange bumped from ^0.0.19 to ^0.0.20
    * @waku/relay bumped from 0.0.9 to 0.0.10
    * @waku/utils bumped from 0.0.14 to 0.0.15

## [0.0.22](https://github.com/waku-org/js-waku/compare/sdk-v0.0.21...sdk-v0.0.22) (2024-01-10)


### ⚠ BREAKING CHANGES

* add support for sharded pubsub topics & remove support for named pubsub topics ([#1697](https://github.com/waku-org/js-waku/issues/1697))
* change all instances of `PubSubTopic` to `PubsubTopic` ([#1703](https://github.com/waku-org/js-waku/issues/1703))

### Features

* Add support for autosharded pubsub topics ([2bc3735](https://github.com/waku-org/js-waku/commit/2bc3735e4dcf85f06b3dee542024d7f20a40fac2))
* Add support for sharded pubsub topics & remove support for named pubsub topics ([#1697](https://github.com/waku-org/js-waku/issues/1697)) ([4cf2ffe](https://github.com/waku-org/js-waku/commit/4cf2ffefa75e0571805036b71644d2cdd4fe3192))
* Metadata protocol ([#1732](https://github.com/waku-org/js-waku/issues/1732)) ([9ac2a3f](https://github.com/waku-org/js-waku/commit/9ac2a3f36352523b79fcd8f8a94bd6e0e109fc30))


### Miscellaneous Chores

* Change all instances of `PubSubTopic` to `PubsubTopic` ([#1703](https://github.com/waku-org/js-waku/issues/1703)) ([3166a51](https://github.com/waku-org/js-waku/commit/3166a5135e77583da4fa722ee2aa47c785854a38))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/utils bumped from 0.0.13 to 0.0.14
    * @waku/relay bumped from 0.0.8 to 0.0.9
    * @waku/core bumped from 0.0.25 to 0.0.26
    * @waku/dns-discovery bumped from 0.0.19 to 0.0.20
    * @waku/interfaces bumped from 0.0.20 to 0.0.21
    * @waku/peer-exchange bumped from ^0.0.18 to ^0.0.19

## [0.0.20](https://github.com/waku-org/js-waku/compare/sdk-v0.0.19...sdk-v0.0.20) (2023-10-16)


### Features

* **static-sharding:** Filter peer connections per shards ([#1626](https://github.com/waku-org/js-waku/issues/1626)) ([124a29e](https://github.com/waku-org/js-waku/commit/124a29ebba59c05fbbf199d969e6ba3f9e57d45b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/utils bumped from 0.0.11 to 0.0.12
    * @waku/relay bumped from 0.0.6 to 0.0.7
    * @waku/core bumped from 0.0.23 to 0.0.24
    * @waku/dns-discovery bumped from 0.0.17 to 0.0.18
    * @waku/interfaces bumped from 0.0.18 to 0.0.19
    * @waku/peer-exchange bumped from ^0.0.16 to ^0.0.17

## [0.0.19](https://github.com/waku-org/js-waku/compare/sdk-v0.0.18...sdk-v0.0.19) (2023-09-11)


### ⚠ BREAKING CHANGES

* set peer-exchange with default bootstrap ([#1469](https://github.com/waku-org/js-waku/issues/1469))

### Features

* Set peer-exchange with default bootstrap ([#1469](https://github.com/waku-org/js-waku/issues/1469)) ([81a52a8](https://github.com/waku-org/js-waku/commit/81a52a8097ba948783c9d798ba362af0f27e1c10))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/utils bumped from 0.0.10 to 0.0.11
    * @waku/relay bumped from 0.0.5 to 0.0.6
    * @waku/core bumped from 0.0.22 to 0.0.23
    * @waku/dns-discovery bumped from 0.0.16 to 0.0.17
    * @waku/interfaces bumped from 0.0.17 to 0.0.18
    * @waku/peer-exchange bumped from ^0.0.15 to ^0.0.16

## [0.0.17](https://github.com/waku-org/js-waku/compare/sdk-v0.0.16...sdk-v0.0.17) (2023-07-26)


### ⚠ BREAKING CHANGES

* remove filter v1 ([#1433](https://github.com/waku-org/js-waku/issues/1433))
* upgrade to libp2p@0.45 ([#1400](https://github.com/waku-org/js-waku/issues/1400))

### Features

* Export interfaces and relay from sdk ([#1409](https://github.com/waku-org/js-waku/issues/1409)) ([0d9265a](https://github.com/waku-org/js-waku/commit/0d9265aaf15260be5974c551e84ca6290273dbf0))
* Upgrade to libp2p@0.45 ([#1400](https://github.com/waku-org/js-waku/issues/1400)) ([420e6c6](https://github.com/waku-org/js-waku/commit/420e6c698dd8f44d40d34e47d876da5d2e1ce85e))


### Miscellaneous Chores

* Remove filter v1 ([#1433](https://github.com/waku-org/js-waku/issues/1433)) ([d483644](https://github.com/waku-org/js-waku/commit/d483644a4bb4350df380719b9bcfbdd0b1439482))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/utils bumped from 0.0.8 to 0.0.9
    * @waku/relay bumped from 0.0.3 to 0.0.4
    * @waku/core bumped from 0.0.20 to 0.0.21
    * @waku/interfaces bumped from 0.0.15 to 0.0.16
    * @waku/dns-discovery bumped from 0.0.14 to 0.0.15

## 0.0.16 (2023-06-08)


### ⚠ BREAKING CHANGES

* rename package from @waku/create to @waku/sdk ([#1386](https://github.com/waku-org/js-waku/issues/1386))

### Features

* Allow passing of multiple ENR URLs to DNS Discovery & dial multiple peers in parallel ([#1379](https://github.com/waku-org/js-waku/issues/1379)) ([f32d7d9](https://github.com/waku-org/js-waku/commit/f32d7d9fe0b930b4fa9c46b8644e6d21be45d5c1))
* Rename package from @waku/create to @waku/sdk ([#1386](https://github.com/waku-org/js-waku/issues/1386)) ([951ebda](https://github.com/waku-org/js-waku/commit/951ebdac9d5b594583acf5e4a21f6471fa81ff74))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/utils bumped from * to 0.0.8
    * @waku/relay bumped from 0.0.2 to 0.0.3
    * @waku/core bumped from 0.0.19 to 0.0.20
    * @waku/dns-discovery bumped from 0.0.13 to 0.0.14
  * devDependencies
    * @waku/interfaces bumped from 0.0.14 to 0.0.15

## [0.0.15](https://github.com/waku-org/js-waku/compare/create-v0.0.14...create-v0.0.15) (2023-05-26)


### ⚠ BREAKING CHANGES

* filter v2 ([#1332](https://github.com/waku-org/js-waku/issues/1332))

### Features

* Filter v2 ([#1332](https://github.com/waku-org/js-waku/issues/1332)) ([8d0e647](https://github.com/waku-org/js-waku/commit/8d0e64796695fbafad0a033552eb4412bdff3d78))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/relay bumped from 0.0.1 to 0.0.2
    * @waku/core bumped from 0.0.18 to 0.0.19
    * @waku/dns-discovery bumped from 0.0.12 to 0.0.13
  * devDependencies
    * @waku/interfaces bumped from 0.0.13 to 0.0.14

## [0.0.14](https://github.com/waku-org/js-waku/compare/create-v0.0.13...create-v0.0.14) (2023-05-18)


### ⚠ BREAKING CHANGES

* @waku/relay ([#1316](https://github.com/waku-org/js-waku/issues/1316))

### Features

* @waku/relay ([#1316](https://github.com/waku-org/js-waku/issues/1316)) ([50c2c25](https://github.com/waku-org/js-waku/commit/50c2c2540f3c5ff78d93f3fea646da0eee246e17))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/relay bumped from * to 0.0.1
    * @waku/core bumped from * to 0.0.18
    * @waku/dns-discovery bumped from * to 0.0.12
  * devDependencies
    * @waku/interfaces bumped from * to 0.0.13

## [0.0.12](https://github.com/waku-org/js-waku/compare/create-v0.0.11...create-v0.0.12) (2023-04-03)


### ⚠ BREAKING CHANGES

* add and implement IReceiver ([#1219](https://github.com/waku-org/js-waku/issues/1219))

### Features

* Add and implement IReceiver ([#1219](https://github.com/waku-org/js-waku/issues/1219)) ([e11e5b4](https://github.com/waku-org/js-waku/commit/e11e5b4870aede7813b3ee4b60f5e625f6eac5a2))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.15 to 0.0.16
    * @waku/dns-discovery bumped from 0.0.9 to 0.0.10
  * devDependencies
    * @waku/interfaces bumped from 0.0.10 to 0.0.11

## [0.0.9](https://github.com/waku-org/js-waku/compare/create-v0.0.8...create-v0.0.9) (2023-03-24)


### Bug Fixes

* **utils:** Include all ts files ([#1267](https://github.com/waku-org/js-waku/issues/1267)) ([c284159](https://github.com/waku-org/js-waku/commit/c284159ac8eab5bed2313fa5bc7fbea0e83d390f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.12 to 0.0.13
    * @waku/dns-discovery bumped from 0.0.7 to 0.0.8
  * devDependencies
    * @waku/interfaces bumped from 0.0.9 to 0.0.10

## [0.0.8](https://github.com/waku-org/js-waku/compare/create-v0.0.7...create-v0.0.8) (2023-03-23)


### Bug Fixes

* @waku/create should not depend on @waku/peer-exchange ([f0ac886](https://github.com/waku-org/js-waku/commit/f0ac886593a96a7d63f75b481d0c2419c1084cda))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.11 to 0.0.12
    * @waku/dns-discovery bumped from 0.0.6 to 0.0.7
  * devDependencies
    * @waku/interfaces bumped from 0.0.8 to 0.0.9

## [0.0.7](https://github.com/waku-org/js-waku/compare/create-v0.0.6...create-v0.0.7) (2023-03-16)


### ⚠ BREAKING CHANGES

* bump typescript
* bump libp2p dependencies

### Features

* DNS discovery as default bootstrap discovery ([#1114](https://github.com/waku-org/js-waku/issues/1114)) ([11819fc](https://github.com/waku-org/js-waku/commit/11819fc7b14e18385d421facaf2af0832cad1da8))


### Bug Fixes

* Prettier and cspell ignore CHANGELOG ([#1235](https://github.com/waku-org/js-waku/issues/1235)) ([4d7b3e3](https://github.com/waku-org/js-waku/commit/4d7b3e39e6761afaf5d05a13cc4b3c23e15f9bd5))
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
