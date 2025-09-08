# Waku Browser Tests

This package provides a containerized Waku light node simulation server for testing and development. The server runs a headless browser using Playwright and exposes a REST API similar to the nwaku REST API. A Dockerfile is provided to allow programmatic simulation and "deployment" of js-waku nodes in any Waku orchestration environment that uses Docker (e.g. [10ksim](https://github.com/vacp2p/10ksim) ).

## Quick Start

### Build and Run

```bash
# Build the application
npm run build

# Start the server (port 8080)
npm run start:server

# Build and run Docker container
npm run docker:build
docker run -p 8080:8080 waku-browser-tests:local
```

## Configuration

Configure the Waku node using environment variables:

### Network Configuration
- `WAKU_CLUSTER_ID`: Cluster ID (default: 1)
- `WAKU_SHARD`: Specific shard number - enables static sharding mode (optional)

**Sharding Behavior:**
- **Auto-sharding** (default): Uses `numShardsInCluster: 8` across cluster 1
- **Static sharding**: When `WAKU_SHARD` is set, uses only that specific shard

### Bootstrap Configuration
- `WAKU_ENR_BOOTSTRAP`: Enable ENR bootstrap mode with custom bootstrap peers (comma-separated)
- `WAKU_LIGHTPUSH_NODE`: Preferred lightpush node multiaddr (Docker only)

### ENR Bootstrap Mode

When `WAKU_ENR_BOOTSTRAP` is set:
- Disables default bootstrap (`defaultBootstrap: false`)
- Enables DNS discovery using production ENR trees
- Enables peer exchange and peer cache
- Uses the specified ENR for additional bootstrap peers

```bash
# Example: ENR bootstrap mode
WAKU_ENR_BOOTSTRAP="enr:-QEnuEBEAyErHEfhiQxAVQoWowGTCuEF9fKZtXSd7H_PymHFhGJA3rGAYDVSHKCyJDGRLBGsloNbS8AZF33IVuefjOO6BIJpZIJ2NIJpcIQS39tkim11bHRpYWRkcnO4lgAvNihub2RlLTAxLmRvLWFtczMud2FrdXYyLnRlc3Quc3RhdHVzaW0ubmV0BgG73gMAODcxbm9kZS0wMS5hYy1jbi1ob25na29uZy1jLndha3V2Mi50ZXN0LnN0YXR1c2ltLm5ldAYBu94DACm9A62t7AQL4Ef5ZYZosRpQTzFVAB8jGjf1TER2wH-0zBOe1-MDBNLeA4lzZWNwMjU2azGhAzfsxbxyCkgCqq8WwYsVWH7YkpMLnU2Bw5xJSimxKav-g3VkcIIjKA" npm run start:server
```

## API Endpoints

The server exposes the following HTTP endpoints:

### Node Management
- `GET /`: Health check - returns server status
- `GET /waku/v1/peer-info`: Get node peer information
- `POST /waku/v1/wait-for-peers`: Wait for peers with specific protocols

### Messaging
- `POST /lightpush/v3/message`: Send message via lightpush

### Static Files
- `GET /app/index.html`: Web application entry point
- `GET /app/*`: Static web application files

### Examples

#### Send a Message (Auto-sharding)
```bash
curl -X POST http://localhost:8080/lightpush/v3/message \
  -H "Content-Type: application/json" \
  -d '{
    "pubsubTopic": "",
    "message": {
      "contentTopic": "/test/1/example/proto",
      "payload": "SGVsbG8gV2FrdQ==",
      "version": 1
    }
  }'
```

#### Send a Message (Explicit pubsub topic)
```bash
curl -X POST http://localhost:8080/lightpush/v3/message \
  -H "Content-Type: application/json" \
  -d '{
    "pubsubTopic": "/waku/2/rs/1/4",
    "message": {
      "contentTopic": "/test/1/example/proto",
      "payload": "SGVsbG8gV2FrdQ==",
      "version": 1
    }
  }'
```

#### Wait for Peers
```bash
curl -X POST http://localhost:8080/waku/v1/wait-for-peers \
  -H "Content-Type: application/json" \
  -d '{
    "timeoutMs": 30000,
    "protocols": ["lightpush", "filter"]
  }'
```

#### Get Peer Info
```bash
curl -X GET http://localhost:8080/waku/v1/peer-info
```

## CLI Usage

Run with CLI arguments:

```bash
# Custom cluster and shard
npm run start:cluster2-shard0

# Or manually
node dist/src/server.js --cluster-id=2 --shard=0
```

## Testing

The package includes several test suites:

```bash
# Basic server functionality tests (default)
npm test

# All tests (may fail if workspace dependencies unavailable)
npm run test:all

# Individual test suites:
npm run test:server      # Server-only tests (no external dependencies)
npm run test:integration # Docker integration tests (requires Docker)
npm run test:e2e        # End-to-end tests (requires @waku/tests workspace dependency)

# Docker testing workflow
npm run docker:build    # Build Docker image
npm run docker:test     # Run Docker-compatible tests
```

**Test Types:**
- `server.spec.ts` - Tests basic server functionality and static file serving
- `integration.spec.ts` - Tests Docker container integration with external services  
- `e2e.spec.ts` - Full end-to-end tests using nwaku nodes (workspace development only)

## Docker Usage

The package includes Docker support for containerized testing:

```bash
# Build image
docker build -t waku-browser-tests:local .

# Run with ENR bootstrap
docker run -p 8080:8080 \
  -e WAKU_ENR_BOOTSTRAP="enr:-QEnuE..." \
  -e WAKU_CLUSTER_ID="1" \
  waku-browser-tests:local

# Run with specific configuration
docker run -p 8080:8080 \
  -e WAKU_CLUSTER_ID="2" \
  -e WAKU_SHARD="0" \
  waku-browser-tests:local
```

## Development

The server automatically:
- Creates a Waku light node on startup
- Configures network settings from environment variables
- Enables appropriate protocols (lightpush, filter)
- Handles peer discovery and connection management

All endpoints are CORS-enabled for cross-origin requests.
