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
