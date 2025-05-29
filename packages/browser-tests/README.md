# Waku Browser Tests

This project provides a system for testing the Waku SDK in a browser environment.

## Architecture

The system consists of:

1. **Headless Web App**: A simple web application (in the `@waku/headless-tests` package) that loads the Waku SDK and exposes shared API functions.
2. **Express Server**: A server that communicates with the headless app using Playwright.
3. **Shared API**: TypeScript functions shared between the server and web app.

## Setup

1. Install dependencies:

```bash
# Install main dependencies
npm install

# Install headless app dependencies
cd ../headless-tests
npm install
cd ../browser-tests
```

2. Build the application:

```bash
npm run build
```

This will:
- Build the headless web app using webpack
- Compile the TypeScript server code

## Running

Start the server with:

```bash
npm run start:server
```

This will:
1. Serve the headless app on port 8080
2. Start a headless browser to load the app
3. Expose API endpoints to interact with Waku

## API Endpoints

- `GET /info`: Get information about the Waku node
- `GET /debug/v1/info`: Get debug information from the Waku node
- `POST /push`: Push a message to the Waku network (legacy)
- `POST /lightpush/v1/message`: Push a message to the Waku network (Waku REST API compatible)
- `POST /admin/v1/create-node`: Create a new Waku node (requires networkConfig)
- `POST /admin/v1/start-node`: Start the Waku node
- `POST /admin/v1/stop-node`: Stop the Waku node
- `POST /admin/v1/peers`: Dial to specified peers (Waku REST API compatible)
- `GET /filter/v2/messages/:contentTopic`: Subscribe to messages on a specific content topic using Server-Sent Events (Waku REST API compatible)
- `GET /filter/v1/messages/:contentTopic`: Retrieve stored messages from a content topic (Waku REST API compatible)

### Example: Pushing a message with the legacy endpoint

```bash
curl -X POST http://localhost:3000/push \
  -H "Content-Type: application/json" \
  -d '{"contentTopic": "/toy-chat/2/huilong/proto", "payload": [1, 2, 3]}'
```

### Example: Pushing a message with the Waku REST API compatible endpoint

```bash
curl -X POST http://localhost:3000/lightpush/v1/message \
  -H "Content-Type: application/json" \
  -d '{
    "pubsubTopic": "/waku/2/rs/0/0",
    "message": {
      "payload": "SGVsbG8sIFdha3Uh",
      "contentTopic": "/toy-chat/2/huilong/proto",
      "timestamp": 1712135330213797632
    }
  }'
```

### Example: Executing a function

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{"functionName": "getPeerInfo", "params": []}'
```

### Example: Creating a Waku node

```bash
curl -X POST http://localhost:3000/admin/v1/create-node \
  -H "Content-Type: application/json" \
  -d '{
    "defaultBootstrap": true,
    "networkConfig": {
      "clusterId": 1,
      "shards": [0, 1]
    }
  }'
```

### Example: Starting and stopping a Waku node

```bash
# Start the node
curl -X POST http://localhost:3000/admin/v1/start-node

# Stop the node
curl -X POST http://localhost:3000/admin/v1/stop-node
```

### Example: Dialing to specific peers with the Waku REST API compatible endpoint

```bash
curl -X POST http://localhost:3000/admin/v1/peers \
  -H "Content-Type: application/json" \
  -d '{
    "peerMultiaddrs": [
      "/ip4/127.0.0.1/tcp/8000/p2p/16Uiu2HAm4v8KuHUH6Cwz3upPeQbkyxQJsFGPdt7kHtkN8F79QiE6"]
    ]
  }'
```

### Example: Dialing to specific peers with the execute endpoint

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "functionName": "dialPeers", 
    "params": [
      ["/ip4/127.0.0.1/tcp/8000/p2p/16Uiu2HAm4v8KuHUH6Cwz3upPeQbkyxQJsFGPdt7kHtkN8F79QiE6"]
    ]
  }'
```

### Example: Subscribing to a content topic with the filter endpoint

```bash
# Open a persistent connection to receive messages as Server-Sent Events
curl -N http://localhost:3000/filter/v2/messages/%2Ftoy-chat%2F2%2Fhuilong%2Fproto

# You can also specify clustering options
curl -N "http://localhost:3000/filter/v2/messages/%2Ftoy-chat%2F2%2Fhuilong%2Fproto?clusterId=0&shard=0"
```

### Example: Retrieving stored messages from a content topic

```bash
# Get the most recent 20 messages
curl http://localhost:3000/filter/v1/messages/%2Ftoy-chat%2F2%2Fhuilong%2Fproto

# Get messages with pagination and time filtering
curl "http://localhost:3000/filter/v1/messages/%2Ftoy-chat%2F2%2Fhuilong%2Fproto?pageSize=10&startTime=1712000000000&endTime=1713000000000&ascending=true"
```

## Extending

To add new functionality:

1. Add your function to `src/api/shared.ts`
2. Add your function to the `API` object in `src/api/shared.ts`
3. Use it via the server endpoints 

### Example: Dialing to specific peers

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "functionName": "dialPeers", 
    "params": [
      ["/ip4/127.0.0.1/tcp/8000/p2p/16Uiu2HAm4v8KuHUH6Cwz3upPeQbkyxQJsFGPdt7kHtkN8F79QiE6"]
    ]
  }'
```
