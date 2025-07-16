# Waku Protocol Stack Architecture Documentation

## Overview

The Waku protocol stack is built on top of libp2p's networking foundation, providing a layered architecture where application-layer Waku protocols utilize libp2p's transport and connection management capabilities. This document provides an in-depth analysis of how these protocols interact, negotiate, and register with the underlying libp2p infrastructure.

## Protocol Stack Layers

```
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐  │
│  │    Relay    │ │    Store    │ │   Filter    │ │LightPush│  │
│  │  (Gossip)   │ │  (History)  │ │(Bandwidth)  │ │ (Relay) │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  Protocol Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐  │
│  │  Metadata   │ │ Peer Exchange│ │   Identity  │ │   Ping  │  │
│  │ (Handshake) │ │ (Discovery) │ │ (Protocol)  │ │ (Health)│  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  Libp2p Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐  │
│  │ Multistream │ │ Connection  │ │    Stream Management    │  │
│  │   Select    │ │ Management  │ │   (Multiplexing)        │  │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  Transport Layer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐  │
│  │ WebSockets  │ │   Noise     │ │        Mplex           │  │
│  │(Transport)  │ │(Encryption) │ │   (Multiplexing)        │  │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Multicodec Identifiers

Waku protocols use specific multicodec identifiers to enable protocol negotiation through libp2p's multistream-select mechanism:

### Core Waku Protocols

| Protocol | Multicodec | Purpose | Implementation |
|----------|------------|---------|---------------|
| **Relay** | `/vac/waku/relay/2.0.0` | Gossip-based message routing | GossipSub protocol |
| **Store** | `/vac/waku/store-query/3.0.0` | Historical message retrieval | Request-response pattern |
| **Filter** | `/vac/waku/filter-subscribe/2.0.0-beta1` | Bandwidth-efficient message filtering | Subscription-based |
| **Filter Push** | `/vac/waku/filter-push/2.0.0-beta1` | Filter message delivery | Push-based delivery |
| **LightPush** | `/vac/waku/lightpush/2.0.0-beta1` | Lightweight message publishing | Request-response pattern |
| **Metadata** | `/vac/waku/metadata/1.0.0` | Shard information exchange | Handshake protocol |

### Legacy Protocol Identifiers

Note: The task mentions Store as `/vac/waku/store/2.0.0-beta4`, but the current implementation uses `/vac/waku/store-query/3.0.0` for Store v3. This represents the evolution of the protocol specifications.

## Protocol Negotiation Through Multistream-Select

### Protocol Registration Process

1. **Service Registration**: Each protocol registers its multicodec with libp2p during initialization
2. **Stream Handler Setup**: Protocols define handlers for incoming streams
3. **Protocol Advertising**: Libp2p advertises supported protocols to peers

### Example: Filter Protocol Registration

```typescript
// packages/core/src/lib/filter/filter.ts
export const FilterCodecs = {
  SUBSCRIBE: "/vac/waku/filter-subscribe/2.0.0-beta1",
  PUSH: "/vac/waku/filter-push/2.0.0-beta1"
};

export class FilterCore {
  public constructor(
    private handleIncomingMessage: IncomingMessageHandler,
    libp2p: Libp2p
  ) {
    // Register protocol handler with libp2p
    libp2p
      .handle(FilterCodecs.PUSH, this.onRequest.bind(this), {
        maxInboundStreams: 100
      })
      .catch((e) => {
        log.error("Failed to register ", FilterCodecs.PUSH, e);
      });
  }
}
```

### Multistream-Select Negotiation Flow

```
Initiator                           Responder
    │                                  │
    │ ── /multistream/1.0.0 ──────────→ │
    │ ←─────── /multistream/1.0.0 ───── │
    │                                  │
    │ ── /vac/waku/store-query/3.0.0 ─→ │
    │ ←─ /vac/waku/store-query/3.0.0 ── │
    │                                  │
    │ ── <protocol-specific data> ───→ │
    │ ←─ <protocol-specific data> ──── │
```

## Abstraction Layers

### Transport/Connection Layer (libp2p)

**Responsibilities:**
- Connection establishment and management
- Stream multiplexing (Mplex)
- Encryption (Noise protocol)
- Transport protocols (WebSockets)
- Peer discovery and routing

**Key Components:**
```typescript
// Connection establishment
const connection = await libp2p.dial(peerId);
const stream = await connection.newStream(multicodec);

// Stream management
const streamManager = new StreamManager(multicodec, libp2p.components);
```

### Stream Management Layer

**Purpose:** Abstracts stream lifecycle management for Waku protocols

**Key Features:**
- Stream pooling and reuse
- Connection state management
- Automatic stream creation
- Stream locking mechanism

```typescript
// packages/core/src/lib/stream_manager/stream_manager.ts
export class StreamManager {
  public async getStream(peerId: PeerId): Promise<Stream> {
    // 1. Check for existing stream
    let stream = this.getOpenStreamForCodec(peerId);
    
    if (stream) {
      this.lockStream(peerIdStr, stream);
      return stream;
    }
    
    // 2. Create new stream if needed
    stream = await this.createStream(peerId);
    this.lockStream(peerIdStr, stream);
    
    return stream;
  }
}
```

### Protocol Layer (Waku Applications)

**Responsibilities:**
- Protocol-specific message handling
- Business logic implementation
- Message encoding/decoding
- Protocol state management

## Protocol Registration and Stream Handling

### Registration Patterns

#### 1. Outbound-Only Protocols (Store, LightPush)
```typescript
// Store protocol - client-side only
export class StoreCore {
  public constructor(libp2p: Libp2p) {
    this.streamManager = new StreamManager(StoreCodec, libp2p.components);
    // No incoming stream handler needed
  }
}
```

#### 2. Bidirectional Protocols (Filter, Metadata)
```typescript
// Filter protocol - handles both outbound and inbound streams
export class FilterCore {
  public constructor(libp2p: Libp2p) {
    // Setup outbound stream management
    this.streamManager = new StreamManager(FilterCodecs.SUBSCRIBE, libp2p.components);
    
    // Register inbound stream handler
    libp2p.handle(FilterCodecs.PUSH, this.onRequest.bind(this));
  }
}
```

#### 3. Gossip-Based Protocols (Relay)
```typescript
// Relay protocol - integrates with libp2p's GossipSub
export class Relay implements IRelay {
  public constructor(params: RelayConstructorParams) {
    this.gossipSub = params.libp2p.services.pubsub as GossipSub;
    this.gossipSub.multicodecs = RelayCodecs; // ["/vac/waku/relay/2.0.0"]
  }
}
```

### Stream Handler Implementation

#### Request-Response Pattern
```typescript
// Store protocol query implementation
public async *queryPerPage<T extends IDecodedMessage>(
  queryOpts: QueryRequestParams,
  decoders: Map<string, IDecoder<T>>,
  peerId: PeerId
): AsyncGenerator<Promise<T | undefined>[]> {
  const stream = await this.streamManager.getStream(peerId);
  
  const res = await pipe(
    [storeQueryRequest.encode()],
    lp.encode,        // Length-prefixed encoding
    stream,           // libp2p stream
    lp.decode,        // Length-prefixed decoding
    async (source) => await all(source)
  );
  
  const storeQueryResponse = StoreQueryResponse.decode(bytes);
  // Process response...
}
```

#### Push-Based Pattern
```typescript
// Filter protocol push handler
private onRequest(streamData: IncomingStreamData): void {
  const { connection, stream } = streamData;
  
  pipe(stream, lp.decode, async (source) => {
    for await (const bytes of source) {
      const response = FilterPushRpc.decode(bytes.slice());
      
      await this.handleIncomingMessage(
        response.pubsubTopic,
        response.wakuMessage,
        connection.remotePeer.toString()
      );
    }
  });
}
```

### Protocol Lifecycle Management

#### Node Initialization
```typescript
// Waku node creation with protocol configuration
export class WakuNode implements IWaku {
  public constructor(
    pubsubTopics: PubsubTopic[],
    options: CreateNodeOptions,
    libp2p: Libp2p,
    protocolsEnabled: ProtocolsEnabled
  ) {
    // Initialize protocols based on configuration
    if (protocolsEnabled.store) {
      this.store = new Store({ libp2p, ... });
    }
    
    if (protocolsEnabled.lightpush) {
      this.lightPush = new LightPush({ libp2p, ... });
    }
    
    if (protocolsEnabled.filter) {
      this.filter = new Filter({ libp2p, ... });
    }
  }
}
```

#### Service Registration with Libp2p
```typescript
// libp2p service configuration
const libp2p = await createLibp2p({
  services: {
    identify: identify({ agentVersion: userAgent }),
    ping: ping({ maxInboundStreams: 10 }),
    metadata: wakuMetadata(pubsubTopics), // Waku metadata service
    ...options?.services
  }
});
```

## Protocol-Specific Stream Management

### Store Protocol
- **Pattern:** Client-server request-response
- **Stream Usage:** One-time use per query
- **Multiplexing:** Single stream per peer, length-prefixed messages

### Filter Protocol
- **Pattern:** Subscription-based with bidirectional communication
- **Stream Usage:** Long-lived subscription streams
- **Multiplexing:** Separate streams for subscribe/unsubscribe and push

### LightPush Protocol
- **Pattern:** Client-server request-response
- **Stream Usage:** One-time use per message publish
- **Multiplexing:** Single stream per peer

### Relay Protocol
- **Pattern:** Gossip-based peer-to-peer
- **Stream Usage:** Managed by GossipSub
- **Multiplexing:** libp2p's GossipSub handles stream management

## Error Handling and Recovery

### Protocol Error Types
```typescript
export enum ProtocolError {
  NO_PEER_AVAILABLE = "No peer available",
  NO_STREAM_AVAILABLE = "No stream available",
  DECODE_FAILED = "Failed to decode",
  REMOTE_PEER_REJECTED = "Remote peer rejected",
  STREAM_ABORTED = "Stream aborted",
  // ... other errors
}
```

### Stream Recovery Mechanisms
- **Automatic retry:** Stream creation retries on failure
- **Peer rotation:** Fall back to alternative peers
- **Connection pooling:** Reuse existing connections
- **Stream locking:** Prevent concurrent stream usage

## Performance Optimizations

### Stream Pooling
```typescript
// Stream reuse mechanism
private getOpenStreamForCodec(peerId: PeerId): Stream | undefined {
  const connections = this.libp2p.connectionManager.getConnections(peerId);
  const connection = selectOpenConnection(connections);
  
  const stream = connection.streams.find(
    (s) => s.protocol === this.multicodec
  );
  
  if (stream && !this.isStreamLocked(stream)) {
    return stream;
  }
}
```

### Connection Management
- **Keep-alive mechanisms:** Ping-based connection health monitoring
- **Connection limits:** Configurable connection pool sizes
- **Priority-based peer selection:** Preferential treatment for bootstrap peers

## Security Considerations

### Protocol Authentication
- **Noise encryption:** All connections encrypted by default
- **Peer identity verification:** Public key-based peer identification
- **Message validation:** Protocol-specific message validation

### Stream Security
- **Stream isolation:** Each protocol uses isolated streams
- **Message size limits:** Prevent DoS attacks via large messages
- **Rate limiting:** Configurable limits on stream creation

## Conclusion

The Waku protocol stack demonstrates a well-architected layered approach where:

1. **Libp2p provides the foundation** with transport, connection management, and protocol negotiation
2. **Multistream-select enables protocol negotiation** through well-defined multicodec identifiers
3. **Stream management abstracts complexity** of connection lifecycle and reuse
4. **Protocol implementations focus on business logic** while leveraging libp2p's infrastructure

This architecture enables scalable, efficient, and secure communication while maintaining clear separation of concerns between transport, networking, and application layers.

## References

- [Waku Relay Protocol Specification](https://rfc.vac.dev/spec/11/)
- [Waku Store Protocol Specification](https://rfc.vac.dev/spec/13/)
- [Waku Filter Protocol Specification](https://rfc.vac.dev/spec/12/)
- [Waku LightPush Protocol Specification](https://rfc.vac.dev/spec/19/)
- [Libp2p Protocol Documentation](https://docs.libp2p.io/concepts/protocols/)
- [Multistream-Select Specification](https://github.com/multiformats/multistream-select)
