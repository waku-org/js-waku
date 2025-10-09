# @waku/run

> **Spin up a local Waku network for development without relying on external infrastructure**

Perfect for hackathons, offline development, or when you need a controlled testing environment for your js-waku application.

## What's Included

- **2 nwaku nodes** connected to each other with all protocols enabled:
  - ✅ Relay (gossipsub)
  - ✅ Filter (light client subscriptions)
  - ✅ LightPush (light client publishing)
  - ✅ Store (message history)
  - ✅ Peer Exchange (peer discovery)
- **PostgreSQL database** for message persistence
- **Isolated network** - nodes only connect to each other

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine with Compose plugin
- Node.js 18+ (only for npx/npm usage)

## Installation

**Option 1: Use npx (no installation required)**
```bash
npx waku-run start
```

**Option 2: Install globally**
```bash
npm install -g @waku/run
waku-run start
```

**Option 3: Clone and run locally**
```bash
git clone https://github.com/waku-org/js-waku.git
cd js-waku/packages/run
npm install
npm run start
```

## Quick Start

### 1. Start the Network

**Option A: Using npx (recommended for quick setup)**
```bash
npx waku-run start
```

**Option B: Local development**
```bash
cd packages/run
npm run start
```

This will:
- Start 2 nwaku nodes and a PostgreSQL database
- Run in the background (detached mode)
- Display connection information you need for your app

**Example output:**
```json
{
  "bootstrapPeers": [
    "/ip4/127.0.0.1/tcp/60000/ws/p2p/16Uiu2HAm...",
    "/ip4/127.0.0.1/tcp/60001/ws/p2p/16Uiu2HAm..."
  ],
  "networkConfig": {
    "clusterId": 1,
    "numShardsInCluster": 8
  }
}
```

### 2. Connect Your js-waku App

Copy the output from above and use it in your application:

```javascript
import { createLightNode } from "@waku/sdk";

const waku = await createLightNode({
  defaultBootstrap: false,
  bootstrapPeers: [
    "/ip4/127.0.0.1/tcp/60000/ws/p2p/16Uiu2HAm...",
    "/ip4/127.0.0.1/tcp/60001/ws/p2p/16Uiu2HAm..."
  ],
  networkConfig: {
    clusterId: 1,
    numShardsInCluster: 8
  }
});

await waku.start();

// Your app is now connected to your local Waku network!
```

### 3. Stop When Done

```bash
npm run stop
```

## Available Commands

### Using npx (published package)

| Command | Description |
|---------|-------------|
| `npx waku-run start` | Start the network (detached) and show connection info |
| `npx waku-run info` | Show connection info for running network |
| `docker compose down` | Stop the network and clean up |

### Local development

| Command | Description |
|---------|-------------|
| `npm run start` | Start the network (detached) and show connection info |
| `npm run stop` | Stop the network and clean up |
| `npm run restart` | Restart the network |
| `npm run logs` | View and follow logs from all nodes |
| `npm run info` | Show connection info for running network |
| `npm test` | Run integration tests |
| `npm run build` | Build TypeScript to JavaScript |

### Direct Docker Compose Commands

You can also use standard Docker Compose commands:

```bash
# Start and see all logs
docker compose up

# Start in background
docker compose up -d

# View logs
docker compose logs -f

# Check status
docker compose ps

# Stop and clean up
docker compose down

# Stop and remove volumes (fresh start)
docker compose down -v
```

## Configuration

### Port Configuration

If the default ports are in use, create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` to change ports:

```bash
NODE1_WS_PORT=60000
NODE1_REST_PORT=8646
NODE2_WS_PORT=60001
NODE2_REST_PORT=8647
```

### Cluster Configuration

The default configuration uses:
- Cluster ID: 1
- Number of shards: 8

To test with different network configurations, create a `.env` file:

```bash
# .env file
CLUSTER_ID=16  # Change to a different cluster
```

Your js-waku app will automatically use the correct configuration from `npm run info`:

```javascript
const waku = await createLightNode({
  defaultBootstrap: false,
  bootstrapPeers: [...],
  networkConfig: {
    clusterId: 1,  // Match your CLUSTER_ID
    numShardsInCluster: 8
  }
});
```

### Changing nwaku Version

```bash
# .env file
NWAKU_IMAGE=wakuorg/nwaku:v0.35.0
```

## Debugging

### View Node Logs

```bash
npm run logs

# Or for a specific node
docker compose logs -f nwaku-1
docker compose logs -f nwaku-2
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

### View Database

Connect to PostgreSQL to inspect stored messages:

```bash
docker compose exec postgres psql -U postgres

# In psql:
\dt  # List tables
SELECT * FROM messages LIMIT 10;
```

## Troubleshooting

### Nodes won't start

**Check if Docker is running:**
```bash
docker ps
```

**Check logs for errors:**
```bash
docker compose logs
```

**Try a fresh start:**
```bash
docker compose down -v
npm run start
```

### Port conflicts

If you see "port already in use":

1. Change ports in `.env`:
```bash
NODE1_WS_PORT=50000
NODE2_WS_PORT=50001
```

2. Or find and stop conflicting processes:
```bash
# macOS/Linux
lsof -i :60000
kill <PID>

# Or use different ports
```

### Nodes won't discover each other

This is expected on first start. The nodes use peer exchange and discovery protocols to find each other, which can take 10-30 seconds.

**Check connection status:**
```bash
# Wait a moment after starting
sleep 15
npm run info
```

### Can't connect from js-waku

**Verify nodes are running:**
```bash
docker compose ps
```

**Check your firewall** - ensure localhost connections are allowed

**Verify ports match** - the ports in your js-waku config must match the `.env` configuration

## Advanced Usage

### Customize Docker Compose

Need more nodes, different configurations, or additional services?

```bash
# Copy and customize
cp docker-compose.yml my-custom-compose.yml

# Edit my-custom-compose.yml to add:
# - More nwaku nodes
# - Custom protocol configurations
# - Additional services (monitoring, etc.)

# Run with your custom config
docker compose -f my-custom-compose.yml up
```

### Add More Nodes

Add to `docker-compose.yml`:

```yaml
nwaku-3:
  <<: *nwaku-base
  container_name: waku-local-node-3
  ports:
    - "60002:60002/tcp"
    - "8648:8648/tcp"
  depends_on:
    - postgres
    - nwaku-1
  command:
    - --relay=true
    - --filter=true
    # ... same config as other nodes
    - --websocket-port=60002
    - --rest-port=8648
```

### Enable Debug Logging

```bash
# .env file
LOG_LEVEL=DEBUG
```

Or directly in docker-compose:
```yaml
- --log-level=DEBUG
- --log-format=json  # Structured logs
```

## Use Cases

- ✅ **Hackathon development** - Work without internet or unreliable connections
- ✅ **Local testing** - Test your app against real nwaku nodes
- ✅ **CI/CD integration tests** - Automated testing in isolated environments
- ✅ **Protocol experimentation** - Try different configurations safely
- ✅ **Offline demos** - Show your app working without external dependencies

## Architecture

```
┌─────────────────────────────────────────────┐
│           Your js-waku Application          │
│                                             │
│  createLightNode({                          │
│    bootstrapPeers: [node1, node2]           │
│  })                                         │
└──────────────┬──────────────────────────────┘
               │ WebSocket connections
               │ (127.0.0.1:60000, 60001)
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────┐           ┌────▼───┐
│ nwaku-1│◄─────────►│nwaku-2 │
│        │  relay    │        │
│ :60000 │  gossip   │ :60001 │
└───┬────┘           └────┬───┘
    │                     │
    └──────────┬──────────┘
               │
         ┌─────▼─────┐
         │ PostgreSQL│
         │  :5432    │
         └───────────┘
```

Both nodes:
- Run all Waku protocols (relay, filter, lightpush, store)
- Share a PostgreSQL database for message persistence
- Connected to each other via relay protocol
- Discover each other via peer exchange
- Expose WebSocket for js-waku connections
- Expose REST API for debugging

## FAQ

**Q: Do I need to wait for nodes to connect before starting my app?**
A: No, you can start your app immediately. js-waku will wait for peers to be available.

**Q: Can I use this for production?**
A: No, this is for development only. For production, use The Waku Network or run your own fleet.

**Q: Why PostgreSQL?**
A: The nwaku store protocol requires a database to persist messages. This allows your app to query message history.

**Q: Can I connect from a different machine?**
A: Yes, but you'll need to change `127.0.0.1` to your machine's IP address in the multiaddrs and ensure your firewall allows the connections.

**Q: How much disk space does this use?**
A: Minimal - the PostgreSQL database only stores messages from your local testing. Use `docker compose down -v` to remove all data.

## Resources

- [js-waku Documentation](https://docs.waku.org/guides/js-waku/)
- [nwaku GitHub](https://github.com/waku-org/nwaku)
- [Waku Protocol Specifications](https://rfc.vac.dev/)
- [Example Applications](https://github.com/waku-org/js-waku-examples)

## License

MIT OR Apache-2.0
