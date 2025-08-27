# Waku Browser Tests

Browser-simulated js-waku node running inside headless Chromium, controlled by an Express server. Useful for long-running simulations and realistic verification in CI/Docker.

## Architecture

- **Headless browser**: Playwright launches Chromium and loads an inline page that exposes `window.wakuAPI` and `window.waku`.
- **Server**: Express app provides REST endpoints and proxies calls into the browser via `page.evaluate(...)`.
- **Shared code**: `shared/` contains utilities used by tests and for typing.

The inline page can optionally load `@waku/sdk` from a CDN when `HEADLESS_USE_CDN=1` is set. Without it, a minimal stub API is provided for smoke testing.

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

Docker-based tests (optional) use Testcontainers and require Docker running.

## Extending

- To add new REST endpoints: update `src/server.ts` and route handlers.
- To add new browser-executed functions: extend the inline `window.wakuAPI` definition in `src/server.ts` (CDN block) and/or add helpers under `shared/` for reuse in browser tests.

