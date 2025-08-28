# Waku Browser Tests

Browser-simulated js-waku node running inside headless Chromium, controlled by an Express server. Useful for long-running simulations and realistic verification in CI/Docker.

## Architecture

- **Headless browser**: Playwright launches Chromium and loads an inline page that exposes `window.wakuAPI` and `window.waku`.
- **Server**: Express app provides REST endpoints and proxies calls into the browser via `page.evaluate(...)`.
- **Bootstrap module**: Small browser-side module at `src/assets/bootstrap.js` initializes a stub API immediately and, if enabled, loads `@waku/sdk` via CDN and defines the real API.
- **Shared code**: `shared/` contains utilities used by tests and for typing.

## Prerequisites

- Node.js 18+
- Playwright (installed via dev dependency)
- Docker (optional, for Testcontainers-based tests)

## Install & Build

```bash
npm install
npm run build
```

The build compiles the TypeScript server to `dist/`.

## Run

```bash
# Default PORT is 8080
npm run start:server

# Optionally load real @waku/sdk in the browser via CDN
HEADLESS_USE_CDN=1 npm run start:server
```

This starts the API server and a headless browser.

## Environment variables

- `PORT`: API server port (default: 3000; Playwright sets this for tests)
- `HEADLESS_USE_CDN`: when `1`, the browser imports `@waku/sdk` via CDN and exposes the real API
- `HEADLESS_WAKU_CDN_BASE`: CDN base for `@waku/sdk` (default: `https://esm.sh`)
- `HEADLESS_WAKU_SDK_VERSION`: overrides the `@waku/sdk` version used in the browser; by default it’s resolved from `package.json`
- `HEADLESS_DEFAULT_CLUSTER_ID`: default cluster id used by push/subscribe (default: 42)
- `HEADLESS_DEFAULT_SHARD`: default shard used by push/subscribe (default: 0)
- `HEADLESS_STUB_PEER_ID`: peer id used by the stub implementation before the CDN module loads (default: `mock-peer-id`)

## API Endpoints

- `GET /` – health/status
- `GET /info` – peer info from the node
- `GET /debug/v1/info` – debug info/protocols
- `POST /lightpush/v1/message` – push a message (Waku REST-compatible shape)
- `POST /admin/v1/create-node` – create a node with `networkConfig`
- `POST /admin/v1/start-node` – start the node
- `POST /admin/v1/stop-node` – stop the node
- `POST /admin/v1/peers` – dial to peers
- `GET /filter/v2/messages/:contentTopic` – SSE subscription to messages
- `GET /filter/v1/messages/:contentTopic` – retrieve queued messages
- `POST /execute` – helper to execute functions in the browser context (testing/support)

### Examples

Push (REST-compatible):

```bash
curl -X POST http://localhost:3000/lightpush/v1/message \
  -H "Content-Type: application/json" \
  -d '{
    "pubsubTopic": "/waku/2/rs/42/0",
    "message": {
      "payload": [1,2,3],
      "contentTopic": "/test/1/message/proto"
    }
  }'
```

Create/Start/Stop:

```bash
curl -X POST http://localhost:3000/admin/v1/create-node \
  -H "Content-Type: application/json" \
  -d '{
    "defaultBootstrap": true,
    "networkConfig": { "clusterId": 42, "shards": [0] }
  }'

curl -X POST http://localhost:3000/admin/v1/start-node
curl -X POST http://localhost:3000/admin/v1/stop-node
```

Dial peers:

```bash
curl -X POST http://localhost:3000/admin/v1/peers \
  -H "Content-Type: application/json" \
  -d '{
    "peerMultiaddrs": ["/dns4/example/tcp/8000/wss/p2p/16U..."]
  }'
```

SSE subscribe:

```bash
curl -N "http://localhost:3000/filter/v2/messages/test-topic?clusterId=42&shard=0"
```

Query queued messages:

```bash
curl "http://localhost:3000/filter/v1/messages/test-topic?pageSize=10&ascending=true"
```

## Testing

```bash
npm run build
npm test
```

Playwright will start the server (uses `npm run start:server`). Ensure the build artifacts exist before running tests.

### Dockerized tests

`tests/docker-server.spec.ts` uses Testcontainers. Ensure Docker is running. It builds/starts a local container image and verifies the HTTP API.

## Extending

- To add new REST endpoints: update `src/server.ts` and route handlers.
- To add new browser-executed functions: prefer updating `src/assets/bootstrap.js` (minimize inline JS in `src/server.ts`).
- For shared logic usable in tests, add helpers under `shared/`.

