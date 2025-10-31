# Changelog

## [0.1.10](https://github.com/waku-org/js-waku/compare/rln-v0.1.9...rln-v0.1.10) (2025-10-31)


### ⚠ BREAKING CHANGES

* **rln:** use zerokit for credential generation ([#2632](https://github.com/waku-org/js-waku/issues/2632))

### Features

* **rln:** Use zerokit for credential generation ([#2632](https://github.com/waku-org/js-waku/issues/2632)) ([bbcfc94](https://github.com/waku-org/js-waku/commit/bbcfc9487937eb89c04502c12e50052f18fdac87))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from ^0.0.39 to ^0.0.40
  * devDependencies
    * @waku/message-encryption bumped from ^0.0.37 to ^0.0.38

## [0.1.9](https://github.com/waku-org/js-waku/compare/rln-v0.1.8...rln-v0.1.9) (2025-09-20)


### Features

* Expose message hash from IDecodedMessage ([#2578](https://github.com/waku-org/js-waku/issues/2578)) ([836d6b8](https://github.com/waku-org/js-waku/commit/836d6b8793a5124747684f6ea76b6dd47c73048b))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from ^0.0.38 to ^0.0.39
    * @waku/utils bumped from ^0.0.26 to ^0.0.27
  * devDependencies
    * @waku/interfaces bumped from 0.0.33 to 0.0.34
    * @waku/message-encryption bumped from ^0.0.36 to ^0.0.37

## [0.1.8](https://github.com/waku-org/js-waku/compare/rln-v0.1.7...rln-v0.1.8) (2025-08-14)


### ⚠ BREAKING CHANGES

* Introduce routing info concept

### Features

* Introduce routing info concept ([3842d84](https://github.com/waku-org/js-waku/commit/3842d84b55eb96728f6b05b9307ff823fac58a54))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from ^0.0.37 to ^0.0.38
    * @waku/utils bumped from ^0.0.25 to ^0.0.26
  * devDependencies
    * @waku/interfaces bumped from 0.0.32 to 0.0.33
    * @waku/message-encryption bumped from ^0.0.35 to ^0.0.36

## [0.1.7](https://github.com/waku-org/js-waku/compare/rln-v0.1.6...rln-v0.1.7) (2025-07-18)


### Features

* **rln:** Price calculator for rate limits ([#2480](https://github.com/waku-org/js-waku/issues/2480)) ([7f7f772](https://github.com/waku-org/js-waku/commit/7f7f772d9331075b57ad76eca6f803cd600c401e))


### Bug Fixes

* `idCommitmentBigInt` must always be less than the contract `Q` ([#2394](https://github.com/waku-org/js-waku/issues/2394)) ([9b0c5e8](https://github.com/waku-org/js-waku/commit/9b0c5e831140159c82a88ad9e9fe5e8ca306d909))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @waku/core bumped from ^0.0.36 to ^0.0.37
    * @waku/utils bumped from ^0.0.24 to ^0.0.25
  * devDependencies
    * @waku/interfaces bumped from 0.0.31 to 0.0.32
    * @waku/message-encryption bumped from ^0.0.34 to ^0.0.35

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
