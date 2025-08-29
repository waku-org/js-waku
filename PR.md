### Problem / Description
- Duplicate browser testing packages increased maintenance and broke CI (referenced removed `@waku/headless-tests`).
- Dockerized tests failed in CI runners without Docker access.

### Solution
- Consolidated all browser/headless tests into a single package: `@waku/browser-tests` (removed `packages/headless-tests`).
- Introduced lightweight bootstrap (`src/assets/bootstrap.js`) and `shared/` module; simplified routes and server.
- Replaced root-level Dockerfile with a package-local Dockerfile under `packages/browser-tests`.
  - Build image: `cd packages/browser-tests && npm run docker:build`
  - Run dockerized tests: `HEADLESS_USE_CDN_IN_DOCKER=0 npx playwright test tests/docker-server.spec.ts`
- Fixed Playwright CI to build/test `@waku/browser-tests`; skip Docker-based tests on CI via Playwright `testIgnore`.

### Notes
- Docker tests require a Docker-enabled environment and local image build; they are intentionally skipped in CI.
- Resolves: CI failures from removed workspace and duplicated setup.
- Related to: test infra consolidation and stability.

---

#### Checklist
- [ ] Code changes are **covered by unit tests**.
- [ ] Code changes are **covered by e2e tests**, if applicable.
- [ ] **Dogfooding has been performed**, if feasible.
- [ ] A **test version has been published**, if required.
- [ ] All **CI checks** pass successfully.


