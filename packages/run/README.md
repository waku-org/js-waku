# @waku/run

> **Spin up a local Waku network for development without relying on external infrastructure**

Perfect for hackathons, offline development, or when you need a controlled testing environment for your js-waku application.

## What's Included

- **2 nwaku nodes** connected to each other with all protocols enabled:
- **PostgreSQL database** for message persistence
- **Isolated network** - nodes only connect to each other

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine with Compose plugin

## Quick Start

### 1. Start the Network

```bash
npx @waku/run start
```

This will:
- Start 2 nwaku nodes and a PostgreSQL database
- Run in the background (detached mode)
- Display connection information you need for your app

**Example output:**
```typescript
import { createLightNode } from "@waku/sdk";

const waku = await createLightNode({
  defaultBootstrap: false,
  bootstrapPeers: [
    "/ip4/127.0.0.1/tcp/60000/ws/p2p/16Uiu2HAmF6oAsd23RMAnZb3NJgxXrExxBTPMdEoih232iAZkviU2",
    "/ip4/127.0.0.1/tcp/60001/ws/p2p/16Uiu2HAm5aZU47YkiUoARqivbCXwuFPzFFXXiURAorySqAQbL6EQ"
  ],
  numPeersToUse: 2,
  libp2p: {
    filterMultiaddrs: false
  },
  networkConfig: {
    clusterId: 0,
    numShardsInCluster: 8
  }
});
```

### 2. Connect Your js-waku App

Copy the configuration from the output above and paste it into your application. Then start your node:

```typescript
await waku.start();

// Your app is now connected to your local Waku network!
```

### 3. Stop When Done

```bash
npx @waku/run stop
```

## Available Commands

### Using npx (published package)

| Command | Description |
|---------|-------------|
| `npx @waku/run start` | Start the network (detached) and show connection info |
| `npx @waku/run stop` | Stop the network and clean up |
| `npx @waku/run info` | Show connection info for running network |
| `npx @waku/run logs` | View and follow logs from all nodes |
| `npx @waku/run test` | Test the network by sending a message |

## Configuration

All configuration is done via environment variables passed to the command.

### Custom Ports

If the default ports are in use, specify custom ports:

```bash
NODE1_WS_PORT=50000 NODE2_WS_PORT=50001 npx @waku/run start
```

Available port configuration:
- `NODE1_WS_PORT` (default: 60000)
- `NODE2_WS_PORT` (default: 60001)
- `NODE1_REST_PORT` (default: 8646)
- `NODE2_REST_PORT` (default: 8647)

### Cluster Configuration

The default configuration uses:
- Cluster ID: 0
- Number of shards: 8

To test with a different cluster:

```bash
CLUSTER_ID=16 npx @waku/run start
```

### Custom nwaku Version

To use a different nwaku image version:

```bash
NWAKU_IMAGE=wakuorg/nwaku:v0.35.0 npx @waku/run start
```

## Debugging

### View Node Logs

```bash
npx @waku/run logs
```

### Check Node Health

```bash
# Node 1
curl http://127.0.0.1:8646/health

# Node 2
curl http://127.0.0.1:8647/health
```

### Check Peer Connections

```bash
# Node 1 debug info
curl http://127.0.0.1:8646/debug/v1/info

# Node 2 debug info
curl http://127.0.0.1:8647/debug/v1/info
```


## License

MIT OR Apache-2.0
