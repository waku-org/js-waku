# Changelog

## [0.1.6](https://github.com/waku-org/js-waku/compare/rln-v0.1.5...rln-v0.1.6) (2025-06-23)


### ⚠ BREAKING CHANGES

* upgrade libp2p, nodejs and typescript ([#2401](https://github.com/waku-org/js-waku/issues/2401))
* re-work messaging parts and sharding  ([#2399](https://github.com/waku-org/js-waku/issues/2399))

### Features

* Re-work messaging parts and sharding  ([#2399](https://github.com/waku-org/js-waku/issues/2399)) ([1905558](https://github.com/waku-org/js-waku/commit/1905558753a7bf61c3dd27d6892d0f561d4c57c6))
* Refine work with membership info and other meta information ([#2341](https://github.com/waku-org/js-waku/issues/2341)) ([3b23bce](https://github.com/waku-org/js-waku/commit/3b23bceb9de5a0c250788ffb824367eabafe3728))


### Miscellaneous Chores

* Upgrade libp2p, nodejs and typescript ([#2401](https://github.com/waku-org/js-waku/issues/2401)) ([fcc6496](https://github.com/waku-org/js-waku/commit/fcc6496fef914c56f6a4d2d17c494c8b94caea3c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from ^0.0.35 to ^0.0.36
    * @waku/utils bumped from ^0.0.23 to ^0.0.24
  * devDependencies
    * @waku/interfaces bumped from 0.0.30 to 0.0.31
    * @waku/message-encryption bumped from ^0.0.33 to ^0.0.34

## [0.1.5](https://github.com/waku-org/js-waku/compare/rln-v0.1.4...rln-v0.1.5) (2025-04-23)


### Features

* **rln:** Create `CredentialsManager` without Zerokit ([#2295](https://github.com/waku-org/js-waku/issues/2295)) ([4adf870](https://github.com/waku-org/js-waku/commit/4adf8706c3befd99ace8f02dc2a1350428d4a163))


### Bug Fixes

* **rln:** Update types to match nwaku ([#2339](https://github.com/waku-org/js-waku/issues/2339)) ([28f28d0](https://github.com/waku-org/js-waku/commit/28f28d0d3627d7fdd06c5970c6028ea73031786e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from ^0.0.34 to ^0.0.35
    * @waku/utils bumped from ^0.0.22 to ^0.0.23
  * devDependencies
    * @waku/message-encryption bumped from ^0.0.32 to ^0.0.33

## [0.1.4](https://github.com/waku-org/js-waku/compare/rln-v0.1.3...rln-v0.1.4) (2025-03-24)


### Features

* @waku/rln ([#2244](https://github.com/waku-org/js-waku/issues/2244)) ([0a0a92b](https://github.com/waku-org/js-waku/commit/0a0a92bccb02fdf9b927bee928b040ff5d624b67))
* **rln:** Migrate from v1 to v2, rate limiting, memberships, test coverage ([#2262](https://github.com/waku-org/js-waku/issues/2262)) ([6fc6bf3](https://github.com/waku-org/js-waku/commit/6fc6bf3916d6dad3d516a5769331245f1b6d55e8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from ^0.0.33 to ^0.0.34
    * @waku/utils bumped from ^0.0.21 to ^0.0.22
  * devDependencies
    * @waku/message-encryption bumped from ^0.0.31 to ^0.0.32
