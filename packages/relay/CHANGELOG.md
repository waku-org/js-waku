# Changelog

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.18 to 0.0.19
    * @waku/interfaces bumped from 0.0.13 to 0.0.14
    * @waku/proto bumped from * to 0.0.5
    * @waku/utils bumped from 0.0.6 to 0.0.7

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.19 to 0.0.20
    * @waku/interfaces bumped from 0.0.14 to 0.0.15
    * @waku/utils bumped from 0.0.7 to 0.0.8

### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.21 to 0.0.22
    * @waku/interfaces bumped from 0.0.16 to 0.0.17
    * @waku/utils bumped from 0.0.9 to 0.0.10

## [0.0.20](https://github.com/waku-org/js-waku/compare/relay-v0.0.19...relay-v0.0.20) (2025-07-18)


### ⚠ BREAKING CHANGES

* remove node level pubsub topic concept
* re-architect connection manager ([#2445](https://github.com/waku-org/js-waku/issues/2445))
* remove deprecated filter implementation ([#2433](https://github.com/waku-org/js-waku/issues/2433))

### Features

* Re-architect connection manager ([#2445](https://github.com/waku-org/js-waku/issues/2445)) ([c7682ea](https://github.com/waku-org/js-waku/commit/c7682ea67c54d2c26a68ce96208003fb1ffc915c))


### Bug Fixes

* Remove node level pubsub topic concept ([6d55af9](https://github.com/waku-org/js-waku/commit/6d55af947e8e57bf0d33fc6a5a67f61594e83ff1))


### Miscellaneous Chores

* Remove deprecated filter implementation ([#2433](https://github.com/waku-org/js-waku/issues/2433)) ([981248e](https://github.com/waku-org/js-waku/commit/981248eedd2192e0a160939e5ff0d7133b12db59))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.36 to 0.0.37
    * @waku/sdk bumped from 0.0.32 to 0.0.33
    * @waku/interfaces bumped from 0.0.31 to 0.0.32
    * @waku/proto bumped from 0.0.11 to 0.0.12
    * @waku/utils bumped from 0.0.24 to 0.0.25

## [0.0.19](https://github.com/waku-org/js-waku/compare/relay-v0.0.18...relay-v0.0.19) (2025-06-23)


### ⚠ BREAKING CHANGES

* upgrade libp2p, nodejs and typescript ([#2401](https://github.com/waku-org/js-waku/issues/2401))
* re-work messaging parts and sharding  ([#2399](https://github.com/waku-org/js-waku/issues/2399))

### Features

* Re-work messaging parts and sharding  ([#2399](https://github.com/waku-org/js-waku/issues/2399)) ([1905558](https://github.com/waku-org/js-waku/commit/1905558753a7bf61c3dd27d6892d0f561d4c57c6))


### Miscellaneous Chores

* Upgrade libp2p, nodejs and typescript ([#2401](https://github.com/waku-org/js-waku/issues/2401)) ([fcc6496](https://github.com/waku-org/js-waku/commit/fcc6496fef914c56f6a4d2d17c494c8b94caea3c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.35 to 0.0.36
    * @waku/sdk bumped from 0.0.31 to 0.0.32
    * @waku/interfaces bumped from 0.0.30 to 0.0.31
    * @waku/proto bumped from 0.0.10 to 0.0.11
    * @waku/utils bumped from 0.0.23 to 0.0.24

## [0.0.18](https://github.com/waku-org/js-waku/compare/relay-v0.0.17...relay-v0.0.18) (2025-04-23)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.34 to 0.0.35
    * @waku/sdk bumped from 0.0.30 to 0.0.31
    * @waku/interfaces bumped from 0.0.29 to 0.0.30
    * @waku/proto bumped from 0.0.9 to 0.0.10
    * @waku/utils bumped from 0.0.22 to 0.0.23

## [0.0.17](https://github.com/waku-org/js-waku/compare/relay-v0.0.16...relay-v0.0.17) (2025-03-24)


### Features

* Improve peer manager and re-integrate to light push  ([#2191](https://github.com/waku-org/js-waku/issues/2191)) ([62f93dc](https://github.com/waku-org/js-waku/commit/62f93dc8428132161dba8881c6adc162040ae758))
* Migrate to latest LightPush version ([#2281](https://github.com/waku-org/js-waku/issues/2281)) ([f199d92](https://github.com/waku-org/js-waku/commit/f199d92d60af948da8a684666c8a4b1f5bc6c9ad))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.33 to 0.0.34
    * @waku/sdk bumped from 0.0.29 to 0.0.30
    * @waku/interfaces bumped from 0.0.28 to 0.0.29
    * @waku/proto bumped from 0.0.8 to 0.0.9
    * @waku/utils bumped from 0.0.21 to 0.0.22

## [0.0.16](https://github.com/waku-org/js-waku/compare/relay-v0.0.15...relay-v0.0.16) (2024-10-16)


### Features

* Replace `waitForRemotePeers()` with `waku.waitForPeer()` method ([#2161](https://github.com/waku-org/js-waku/issues/2161)) ([75fcca4](https://github.com/waku-org/js-waku/commit/75fcca4cd99d6aabcbb14afab9332c98ddc6b74f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.32 to 0.0.33
    * @waku/sdk bumped from 0.0.28 to 0.0.29
    * @waku/interfaces bumped from 0.0.27 to 0.0.28
    * @waku/utils bumped from 0.0.20 to 0.0.21

## [0.0.15](https://github.com/waku-org/js-waku/compare/relay-v0.0.14...relay-v0.0.15) (2024-09-05)


### Bug Fixes

* Temporarily remove peer cross dependencies ([#2123](https://github.com/waku-org/js-waku/issues/2123)) ([f4b6bb0](https://github.com/waku-org/js-waku/commit/f4b6bb04b38842745c946b427bb3518680df09dc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.31 to 0.0.32
    * @waku/sdk bumped from 0.0.27 to 0.0.28
    * @waku/interfaces bumped from 0.0.26 to 0.0.27
    * @waku/utils bumped from 0.0.19 to 0.0.20

## [0.0.14](https://github.com/waku-org/js-waku/compare/relay-v0.0.13...relay-v0.0.14) (2024-08-29)


### ⚠ BREAKING CHANGES

* **filter:** new simpler filter API  ([#2092](https://github.com/waku-org/js-waku/issues/2092))

### Features

* **filter:** New simpler filter API  ([#2092](https://github.com/waku-org/js-waku/issues/2092)) ([fdd9dc4](https://github.com/waku-org/js-waku/commit/fdd9dc44a44c6680024fb51e9bbb5fe17190dcbd))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.30 to 0.0.31
    * @waku/interfaces bumped from 0.0.25 to 0.0.26
    * @waku/proto bumped from 0.0.7 to 0.0.8
    * @waku/utils bumped from 0.0.18 to 0.0.19

## [0.0.13](https://github.com/waku-org/js-waku/compare/relay-v0.0.12...relay-v0.0.13) (2024-07-10)


### ⚠ BREAKING CHANGES

* **filter:** return error codes instead of throwing errors ([#1971](https://github.com/waku-org/js-waku/issues/1971))

### Features

* **filter:** Return error codes instead of throwing errors ([#1971](https://github.com/waku-org/js-waku/issues/1971)) ([4eb06c6](https://github.com/waku-org/js-waku/commit/4eb06c64eb05c015e2f51e3f45a9d7143a934385))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.29 to 0.0.30
    * @waku/interfaces bumped from 0.0.24 to 0.0.25
    * @waku/utils bumped from 0.0.17 to 0.0.18

## [0.0.12](https://github.com/waku-org/js-waku/compare/relay-v0.0.11...relay-v0.0.12) (2024-04-30)


### ⚠ BREAKING CHANGES

* use ShardingParams on subscriptions, make Decoder/Encoder auto sharding friendly by default ([#1958](https://github.com/waku-org/js-waku/issues/1958))

### Features

* Use ShardingParams on subscriptions, make Decoder/Encoder auto sharding friendly by default ([#1958](https://github.com/waku-org/js-waku/issues/1958)) ([f3627c4](https://github.com/waku-org/js-waku/commit/f3627c46a4c231013c5ffa4aa6f1ecbe3c06c5e3))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.28 to 0.0.29
    * @waku/interfaces bumped from 0.0.23 to 0.0.24
    * @waku/proto bumped from 0.0.6 to 0.0.7
    * @waku/utils bumped from 0.0.16 to 0.0.17

## [0.0.11](https://github.com/waku-org/js-waku/compare/relay-v0.0.10...relay-v0.0.11) (2024-04-09)


### ⚠ BREAKING CHANGES

* **lightpush:** move protocol implementation opinions to `@waku/sdk` ([#1887](https://github.com/waku-org/js-waku/issues/1887))

### Features

* Add cross peer dependency for [@waku](https://github.com/waku) packages ([#1889](https://github.com/waku-org/js-waku/issues/1889)) ([8f86740](https://github.com/waku-org/js-waku/commit/8f867404e3e950b6e491c8831068962c6968ed4e))
* **metadata:** Use error codes ([#1904](https://github.com/waku-org/js-waku/issues/1904)) ([1882023](https://github.com/waku-org/js-waku/commit/1882023c58c830fc31921fe786bce734536ac1da))


### Miscellaneous Chores

* **lightpush:** Move protocol implementation opinions to `@waku/sdk` ([#1887](https://github.com/waku-org/js-waku/issues/1887)) ([8deab11](https://github.com/waku-org/js-waku/commit/8deab11890160b40a22e7d11926a2307afb93af4))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.27 to 0.0.28
    * @waku/interfaces bumped from 0.0.22 to 0.0.23
    * @waku/utils bumped from 0.0.15 to 0.0.16

## [0.0.10](https://github.com/waku-org/js-waku/compare/relay-v0.0.9...relay-v0.0.10) (2024-03-04)


### Features

* Decouple sharding params out of core ([e138b4f](https://github.com/waku-org/js-waku/commit/e138b4f5c49a35a37830e31e8be87d824f53249f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.26 to 0.0.27
    * @waku/interfaces bumped from 0.0.21 to 0.0.22
    * @waku/utils bumped from 0.0.14 to 0.0.15

## [0.0.9](https://github.com/waku-org/js-waku/compare/relay-v0.0.8...relay-v0.0.9) (2024-01-10)


### ⚠ BREAKING CHANGES

* add support for sharded pubsub topics & remove support for named pubsub topics ([#1697](https://github.com/waku-org/js-waku/issues/1697))
* change all instances of `PubSubTopic` to `PubsubTopic` ([#1703](https://github.com/waku-org/js-waku/issues/1703))

### Features

* Add support for autosharded pubsub topics ([2bc3735](https://github.com/waku-org/js-waku/commit/2bc3735e4dcf85f06b3dee542024d7f20a40fac2))
* Add support for sharded pubsub topics & remove support for named pubsub topics ([#1697](https://github.com/waku-org/js-waku/issues/1697)) ([4cf2ffe](https://github.com/waku-org/js-waku/commit/4cf2ffefa75e0571805036b71644d2cdd4fe3192))


### Miscellaneous Chores

* Change all instances of `PubSubTopic` to `PubsubTopic` ([#1703](https://github.com/waku-org/js-waku/issues/1703)) ([3166a51](https://github.com/waku-org/js-waku/commit/3166a5135e77583da4fa722ee2aa47c785854a38))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.25 to 0.0.26
    * @waku/interfaces bumped from 0.0.20 to 0.0.21
    * @waku/proto bumped from 0.0.5 to 0.0.6
    * @waku/utils bumped from 0.0.13 to 0.0.14

## [0.0.8](https://github.com/waku-org/js-waku/compare/relay-v0.0.7...relay-v0.0.8) (2023-11-01)


### Features

* Fail early when trying to send empty payload ([#1642](https://github.com/waku-org/js-waku/issues/1642)) ([6bad4ea](https://github.com/waku-org/js-waku/commit/6bad4ea7d1dee79c296c550390da57ffa824e2cf))
* Logger with log levels ([#1672](https://github.com/waku-org/js-waku/issues/1672)) ([0f7d63e](https://github.com/waku-org/js-waku/commit/0f7d63ef93716223dc8fea7e8cb09e12e267b386))


### Bug Fixes

* Measure total message size ([#1643](https://github.com/waku-org/js-waku/issues/1643)) ([b7dc3d7](https://github.com/waku-org/js-waku/commit/b7dc3d7576e9444a5acbb036812c05cfccb25815))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.24 to 0.0.25
    * @waku/interfaces bumped from 0.0.19 to 0.0.20
    * @waku/utils bumped from 0.0.12 to 0.0.13

## [0.0.7](https://github.com/waku-org/js-waku/compare/relay-v0.0.6...relay-v0.0.7) (2023-10-16)


### ⚠ BREAKING CHANGES

* **static-sharding:** allow multiple pubSubTopics ([#1586](https://github.com/waku-org/js-waku/issues/1586))

### Features

* **static-sharding:** Allow multiple pubSubTopics ([#1586](https://github.com/waku-org/js-waku/issues/1586)) ([a3c45b6](https://github.com/waku-org/js-waku/commit/a3c45b6e1a9beae488cae3c71c48949fa47bcaf6))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.23 to 0.0.24
    * @waku/interfaces bumped from 0.0.18 to 0.0.19
    * @waku/utils bumped from 0.0.11 to 0.0.12

## [0.0.6](https://github.com/waku-org/js-waku/compare/relay-v0.0.5...relay-v0.0.6) (2023-09-11)


### ⚠ BREAKING CHANGES

* set peer-exchange with default bootstrap ([#1469](https://github.com/waku-org/js-waku/issues/1469))

### Features

* Set peer-exchange with default bootstrap ([#1469](https://github.com/waku-org/js-waku/issues/1469)) ([81a52a8](https://github.com/waku-org/js-waku/commit/81a52a8097ba948783c9d798ba362af0f27e1c10))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.22 to 0.0.23
    * @waku/interfaces bumped from 0.0.17 to 0.0.18
    * @waku/utils bumped from 0.0.10 to 0.0.11

## [0.0.4](https://github.com/waku-org/js-waku/compare/relay-v0.0.3...relay-v0.0.4) (2023-07-26)


### ⚠ BREAKING CHANGES

* upgrade to libp2p@0.45 ([#1400](https://github.com/waku-org/js-waku/issues/1400))

### Features

* Upgrade to libp2p@0.45 ([#1400](https://github.com/waku-org/js-waku/issues/1400)) ([420e6c6](https://github.com/waku-org/js-waku/commit/420e6c698dd8f44d40d34e47d876da5d2e1ce85e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from 0.0.20 to 0.0.21
    * @waku/interfaces bumped from 0.0.15 to 0.0.16
    * @waku/utils bumped from 0.0.8 to 0.0.9

## 0.0.1 (2023-05-18)


### ⚠ BREAKING CHANGES

* @waku/relay ([#1316](https://github.com/waku-org/js-waku/issues/1316))

### Features

* @waku/relay ([#1316](https://github.com/waku-org/js-waku/issues/1316)) ([50c2c25](https://github.com/waku-org/js-waku/commit/50c2c2540f3c5ff78d93f3fea646da0eee246e17))
* Add 1MB restriction to LightPush and Relay ([#1351](https://github.com/waku-org/js-waku/issues/1351)) ([72f97d4](https://github.com/waku-org/js-waku/commit/72f97d4545512f92936b1a9b50fa0b53f8603f9d))


### Bug Fixes

* Remove typesVersions ([#1359](https://github.com/waku-org/js-waku/issues/1359)) ([0ad1954](https://github.com/waku-org/js-waku/commit/0ad19540d527309e0174afa7e9fff2924570d361))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from * to 0.0.18
    * @waku/interfaces bumped from * to 0.0.13
    * @waku/utils bumped from * to 0.0.6
