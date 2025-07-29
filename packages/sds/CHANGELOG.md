# Changelog

## [0.0.5](https://github.com/waku-org/js-waku/compare/sds-v0.0.4...sds-v0.0.5) (2025-07-18)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/proto bumped from ^0.0.11 to ^0.0.12
    * @waku/utils bumped from ^0.0.24 to ^0.0.25

## [0.0.4](https://github.com/waku-org/js-waku/compare/sds-v0.0.3...sds-v0.0.4) (2025-06-23)


### ⚠ BREAKING CHANGES

* upgrade libp2p, nodejs and typescript ([#2401](https://github.com/waku-org/js-waku/issues/2401))
* re-work messaging parts and sharding  ([#2399](https://github.com/waku-org/js-waku/issues/2399))

### Features

* Add command queue architecture and improve message handling ([a0fc9e0](https://github.com/waku-org/js-waku/commit/a0fc9e05d4ef103b58c8ef0574bdaaaa421bf4da))
* Re-work messaging parts and sharding  ([#2399](https://github.com/waku-org/js-waku/issues/2399)) ([1905558](https://github.com/waku-org/js-waku/commit/1905558753a7bf61c3dd27d6892d0f561d4c57c6))


### Bug Fixes

* Reorder methods by visibility ([8444bc9](https://github.com/waku-org/js-waku/commit/8444bc940fd26b52a0b1662f6923b49a22f9325d))


### Miscellaneous Chores

* Upgrade libp2p, nodejs and typescript ([#2401](https://github.com/waku-org/js-waku/issues/2401)) ([fcc6496](https://github.com/waku-org/js-waku/commit/fcc6496fef914c56f6a4d2d17c494c8b94caea3c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/proto bumped from ^0.0.10 to ^0.0.11
    * @waku/utils bumped from ^0.0.23 to ^0.0.24

## [0.0.3](https://github.com/waku-org/js-waku/compare/sds-v0.0.2...sds-v0.0.3) (2025-04-23)


### Features

* **sds:** Add retrieval hint to causal history ([4da382d](https://github.com/waku-org/js-waku/commit/4da382d59489645802d9efeb68e8eb05cdc95ec1))
* **sds:** Add retrieval hint to causal history ([408be95](https://github.com/waku-org/js-waku/commit/408be95a1317210e43a2caff3ecff40d457d17c4))
* **sds:** Adds ephemeral messages, delivered message callback and event ([18e08f9](https://github.com/waku-org/js-waku/commit/18e08f94dfb20538ebf6575acb7e7e395a08d2c1))
* **sds:** Adds ephemeral messages, delivered message callback and event ([6b4848c](https://github.com/waku-org/js-waku/commit/6b4848c8536d39914915dba011d4a075bfed0e4a))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/message-hash bumped from ^0.1.18 to ^0.1.19
    * @waku/proto bumped from ^0.0.9 to ^0.0.10
    * @waku/utils bumped from ^0.0.22 to ^0.0.23

## [0.0.2](https://github.com/waku-org/js-waku/compare/sds-v0.0.1...sds-v0.0.2) (2025-03-24)


### Features

* **sds:** Add message channel with buffers and send/receive logic ([4cd1eea](https://github.com/waku-org/js-waku/commit/4cd1eea05a470a23cde8a6457addd3ac76289045))
* **sds:** Add message channel with buffers and send/receive logic ([389ca40](https://github.com/waku-org/js-waku/commit/389ca4062eebda91eac6d8e212ca4d063e7ac103))
* **sds:** Adds logic to sweep incoming and outgoing buffers ([5b3a256](https://github.com/waku-org/js-waku/commit/5b3a256b4cbba27a0640061ce90f9101bc56431e))
* **sds:** Adds logic to sweep incoming and outgoing buffers ([f7666a6](https://github.com/waku-org/js-waku/commit/f7666a658853726f732f39d7551227e5146114c9))
* **sds:** Create package for sds and add protobuf def ([6abd2d1](https://github.com/waku-org/js-waku/commit/6abd2d18a13f4a960c1d34404afd5972956035b4))
* **sds:** Create package for sds and add protobuf def ([468512f](https://github.com/waku-org/js-waku/commit/468512fa85a5e6c1618803338e0e9d17e1a9c4b7))
* **sds:** Migrate bloomfilter to bigint and import hashn function from nim ([053e490](https://github.com/waku-org/js-waku/commit/053e4901e7a523c47e5c3b73804ed6144a7ca563))
* **sds:** Migrate bloomfilter to bigint and import hashn function from nim ([be93e4b](https://github.com/waku-org/js-waku/commit/be93e4b71f1ecc2c6e3447cd7c5f46af24f70941))
* **sds:** Send and receive sync messages ([8db7690](https://github.com/waku-org/js-waku/commit/8db7690233ee34884d7d8d9174cf3b9a4bcb1e79))
* **sds:** Send and receive sync messages ([13ae5d4](https://github.com/waku-org/js-waku/commit/13ae5d4f73ef4828249a766a6a579c0aa281252e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/message-hash bumped from ^0.1.17 to ^0.1.18
    * @waku/proto bumped from ^0.0.8 to ^0.0.9
    * @waku/utils bumped from ^0.0.21 to ^0.0.22
