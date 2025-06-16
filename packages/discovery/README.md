# @waku/discovery

Enterprise-grade peer discovery implementations for Waku nodes, providing resilient, high-performance mechanisms to find and connect to peers in the Waku network.

## Overview

The discovery package delivers production-ready peer discovery with dual implementation strategies: battle-tested libp2p-compatible interfaces for immediate adoption, and next-generation Effect.js-powered implementations for enhanced type safety, error recovery, and resource management. Choose the approach that best fits your application's reliability and performance requirements.

## Architecture

The package follows a layered architecture with clear separation of concerns:

### High-Level Components

#### 1. **Discovery Mechanisms**
Three complementary peer discovery strategies optimized for different network conditions:

- **DNS Discovery** - Bootstrap and discover peers via DNS-over-HTTPS using ENR (Ethereum Node Records). Ideal for initial network entry and discovering well-connected bootstrap nodes.
- **Peer Exchange** - Protocol-native peer discovery with automatic retry and exponential backoff. Optimized for discovering topic-specific peers with built-in load balancing.
- **Local Peer Cache** - Persistent peer storage with TTL management and intelligent cache invalidation. Reduces cold-start latency and network overhead.

#### 2. **Implementation Layers**

##### Service Layer (`src/effect/services/`)
Core business logic with built-in resilience patterns and type-safe error handling:

- **DNS Services** (`dns/`) - DNS-over-HTTPS resolution with connection pooling, ENR parsing with validation, and coordinated discovery with timeout management
- **Peer Exchange Services** (`peer-exchange/`) - Protocol implementation with exponential backoff, concurrent request management, and automatic peer quality scoring
- **Cache Services** (`cache/`) - Multi-backend storage (localStorage/memory) with configurable TTL, LRU eviction, and atomic cache operations
- **Common Services** (`common/`) - Shared type system, structured error hierarchy, observability framework, and utility functions

##### Wrapper Layer (`src/effect/wrappers/`)
Production-ready libp2p integration with seamless Effect service bridging:

- **DNS Discovery Wrapper** - Full `PeerDiscovery` compliance with automatic resource cleanup and graceful error recovery
- **Peer Exchange Wrapper** - Event-driven peer discovery with intelligent retry policies and connection state management  
- **Cache Discovery Wrapper** - `PeerDiscovery` + `Startable` implementation with atomic cache operations and cross-session persistence

##### Legacy Layer (`src/dns/`, `src/peer-exchange/`, `src/local-peer-cache/`)
Original implementations maintained for backward compatibility.

#### 3. **Core Abstractions**

##### Discovery Service Interface
```typescript
interface DiscoveryService {
  readonly discover: () => Stream.Stream<DiscoveredPeer, DiscoveryError>;
  readonly stop: () => Effect.Effect<void>;
}
```

##### Discovered Peer Model
```typescript
interface DiscoveredPeer {
  readonly peerInfo: PeerInfo;
  readonly enr?: IEnr;
  readonly shardInfo?: ShardInfo;
  readonly discoveredAt: Date;
  readonly source: DiscoverySource;
}
```

##### Discovery Sources
- `dns` - Peer discovered via DNS resolution
- `peer-exchange` - Peer discovered through peer exchange protocol
- `cache` - Peer loaded from local cache

#### 4. **Error Management**
Typed error hierarchy for precise error handling:

- `DnsResolutionError` - DNS lookup failures
- `EnrParsingError` - ENR record parsing issues
- `PeerExchangeError` - Peer exchange protocol errors
- `NetworkTimeoutError` - Network operation timeouts
- `InvalidPeerError` - Invalid peer data
- `CacheError` - Local storage operations
- `ProtocolError` - Protocol-level errors

#### 5. **Logging Integration**
Dual logging system supporting both Waku's debug-based logger and Effect's console:

- **Environment-based configuration** via `DEBUG` and `WAKU_ENABLE_EFFECT_LOGS`
- **Namespace compatibility** with existing Waku logging patterns
- **Structured logging** for Effect console output
- **Conditional output** based on environment settings

## Installation

```bash
npm install @waku/discovery
```

## Quick Start

### Zero-Configuration Setup
Get started immediately with sensible defaults optimized for most applications:

```typescript
import { wakuDnsDiscovery, wakuPeerExchangeDiscovery } from "@waku/discovery";
import { createLightNode } from "@waku/sdk";
import { enrTree } from "@waku/discovery";

// Production-ready configuration with automatic fallbacks
const waku = await createLightNode({
  libp2p: {
    peerDiscovery: [
      // Bootstrap via DNS with built-in redundancy
      wakuDnsDiscovery([enrTree["SANDBOX"]], {
        store: 3,        // Discover 3 store-capable peers
        filter: 3,       // Discover 3 filter-capable peers  
        lightPush: 3     // Discover 3 light-push-capable peers
      }),
      // Protocol-native peer exchange for topic-specific discovery
      wakuPeerExchangeDiscovery(["/waku/2/rs/0/0"])
    ]
  }
});

// Discovery happens automatically - peers available immediately
await waku.waitForRemotePeer();
console.log(`Connected to ${waku.libp2p.getConnections().length} peers`);
```

### Production Configuration
Optimize for high-availability applications with advanced resilience patterns:

```typescript
import { 
  wakuDnsDiscovery, 
  wakuPeerExchangeDiscovery, 
  wakuLocalPeerCacheDiscovery 
} from "@waku/discovery";

const waku = await createLightNode({
  libp2p: {
    peerDiscovery: [
      // High-availability DNS with custom peer scoring
      wakuDnsDiscovery([enrTree["SANDBOX"]], {
        store: 5,           // Higher redundancy for critical services
        filter: 5,
        lightPush: 3,
        tagName: "bootstrap", // Custom peer tagging for priority routing
        tagValue: 100,       // High priority score for bootstrap peers
        tagTTL: 120000       // 2-minute TTL for dynamic environments
      }),
      
      // Multi-shard peer exchange for scalability
      wakuPeerExchangeDiscovery([
        "/waku/2/rs/0/0",   // Primary shard
        "/waku/2/rs/0/1"    // Secondary shard for load distribution
      ]),
      
      // Persistent caching for reduced cold-start latency
      wakuLocalPeerCacheDiscovery({
        tagName: "cached",   // Separate tagging for cached peers
        tagValue: 75,        // Medium priority for cached peers
        tagTTL: 300000       // 5-minute TTL for cache entries
      })
    ]
  }
});

// Monitor discovery performance
waku.addEventListener('peer', (event) => {
  console.log(`Discovered peer: ${event.detail.id} via ${event.type}`);
});
```

### Error Handling & Recovery
Handle network failures gracefully with typed error management:

```typescript
import { DnsResolutionError, PeerExchangeError, NetworkTimeoutError } from "@waku/discovery";

try {
  const waku = await createLightNode({ /* config */ });
  await waku.waitForRemotePeer();
} catch (error) {
  if (error instanceof DnsResolutionError) {
    console.log(`DNS discovery failed for ${error.domain}: ${error.reason}`);
    // Fallback to peer exchange only
  } else if (error instanceof PeerExchangeError) {
    console.log(`Peer exchange failed: ${error.reason}`);
    // Retry with exponential backoff
  } else if (error instanceof NetworkTimeoutError) {
    console.log(`Network timeout after ${error.timeoutMs}ms`);
    // Increase timeout for poor network conditions
  }
}
```

## Configuration & Observability

### Environment-Based Configuration
Control discovery behavior through environment variables for different deployment contexts:

```bash
# Production: Minimal logging, Effect implementations
WAKU_USE_EFFECT_DISCOVERY=true npm start

# Development: Full debugging, both logging systems
DEBUG=waku:discovery:* WAKU_ENABLE_EFFECT_LOGS=true npm start

# Staging: Structured logging only  
WAKU_ENABLE_EFFECT_LOGS=true npm start
```

**Available Environment Variables:**
- `DEBUG` - Standard debug namespaces (`waku:*`, `waku:discovery:dns`, `waku:discovery:peer-exchange`)
- `WAKU_ENABLE_EFFECT_LOGS` - Structured JSON logging via Effect console (default: false)
- `WAKU_USE_EFFECT_DISCOVERY` - Prefer Effect implementations for new features (default: true)

### Observability & Monitoring

#### Structured Logging
Monitor discovery performance with rich, queryable logs:

```typescript
// Automatic performance metrics in Effect implementations
DEBUG=waku:discovery:* node app.js

// Sample output:
// waku:discovery:dns Discovery started for 3 ENR URLs +0ms
// waku:discovery:dns Resolved 15 peers from bootstrap.sandbox.waku +245ms  
// waku:discovery:peer-exchange Started peer exchange on /waku/2/rs/0/0 +1ms
// waku:discovery:cache Loaded 8 cached peers, 2 still valid +5ms
```

#### Performance Monitoring
Track key metrics for production deployments:

```typescript
import { logDiscoveryOperation } from "@waku/discovery";

// Built-in performance tracking
const discoveryStats = {
  peersDiscovered: 0,
  averageLatency: 0,
  errorRate: 0
};

waku.addEventListener('peer', (event) => {
  discoveryStats.peersDiscovered++;
  // Track discovery source effectiveness
});
```

## API Reference

### DNS Discovery Factory
Bootstrap peer discovery via DNS with automatic ENR resolution and capability filtering:

```typescript
wakuDnsDiscovery(
  enrUrls: string[],                           // ENR tree URLs for bootstrap
  wantedNodeCapabilityCount?: Partial<NodeCapabilityCount> // Capability requirements
): (components: DnsDiscoveryComponents) => PeerDiscovery

// Example with capability targeting
wakuDnsDiscovery([enrTree["MAINNET"]], {
  store: 5,      // Minimum 5 peers supporting store protocol
  filter: 3,     // Minimum 3 peers supporting filter protocol  
  lightPush: 2   // Minimum 2 peers supporting light push
})
```

### Peer Exchange Discovery Factory  
Protocol-native peer discovery with automatic topic-based peer filtering:

```typescript
wakuPeerExchangeDiscovery(
  pubsubTopics: PubsubTopic[]                  // Topics for peer filtering
): (components: Libp2pComponents) => PeerDiscovery

// Example with multi-shard configuration
wakuPeerExchangeDiscovery([
  "/waku/2/rs/16/42",  // Specific shard for application
  "/waku/2/rs/16/43"   // Additional shard for redundancy
])
```

### Local Cache Discovery Factory
Persistent peer caching with configurable storage backend and TTL management:

```typescript
wakuLocalPeerCacheDiscovery(
  options?: LocalPeerCacheDiscoveryOptions
): (components: Libp2pComponents) => LocalPeerCacheDiscoveryEffect

// Configuration options
interface LocalPeerCacheDiscoveryOptions {
  tagName?: string;    // Custom tag for cached peers (default: "cached")
  tagValue?: number;   // Priority score for cached peers (default: 50)  
  tagTTL?: number;     // TTL for peer cache entries (default: 5 minutes)
}
```

### Type-Safe Error Management

Comprehensive error types for robust production applications:

```typescript
import { 
  DnsResolutionError, 
  PeerExchangeError, 
  NetworkTimeoutError,
  CacheError 
} from "@waku/discovery";

// Error handling with full context
try {
  await discovery.start();
} catch (error) {
  switch (error.constructor) {
    case DnsResolutionError:
      // DNS-specific recovery logic
      logger.warn(`DNS resolution failed for ${error.domain}: ${error.reason}`, {
        domain: error.domain,
        cause: error.cause
      });
      break;
      
    case PeerExchangeError:
      // Peer exchange recovery with backoff
      logger.error(`Peer exchange failed: ${error.reason}`, {
        peerId: error.peerId,
        retryAfter: calculateBackoff(error.attempts)
      });
      break;
      
    case NetworkTimeoutError:
      // Network timeout handling
      logger.warn(`Operation timed out after ${error.timeoutMs}ms`, {
        operation: error.operation,
        suggestedTimeout: error.timeoutMs * 2
      });
      break;
  }
}
```

## Package Integration Points

The discovery package serves as a critical interface layer between peer discovery mechanisms and the broader Waku ecosystem. Understanding these integration points is essential for developers working across the monorepo.

### Integration with Core Packages

#### **@waku/core** - Protocol Infrastructure
- **BaseProtocol** - All discovery implementations extend `BaseProtocol` for protocol lifecycle management
- **Connection Management** - Discovery integrates with core's connection manager for peer lifecycle
- **Protocol Registration** - Discovery protocols register with core's protocol handler system

```typescript
// From peer-exchange implementation
import { BaseProtocol } from "@waku/core/lib/base_protocol";

export class WakuPeerExchange extends BaseProtocol implements IPeerExchange {
  // Inherits protocol lifecycle, stream management, and error handling
}
```

#### **@waku/interfaces** - Type System & Contracts
- **Core Types** - `PeerInfo`, `Libp2pComponents`, `PubsubTopic`, `ShardInfo`, `NodeCapabilityCount`
- **Discovery Interfaces** - `IPeerExchange`, `PeerExchangeQueryParams`, `PeerExchangeQueryResult`
- **Configuration Types** - `CreateNodeOptions`, `DnsDiscOptions`
- **Protocol Definitions** - `ProtocolError`, `Tags`, `DNS_DISCOVERY_TAG`

```typescript
// Key interface dependencies
import type { 
  Libp2pComponents,     // libp2p service container
  PubsubTopic,          // Waku topic definitions
  ShardInfo,            // Network sharding metadata
  NodeCapabilityCount   // Peer capability requirements
} from "@waku/interfaces";
```

#### **@waku/enr** - Ethereum Node Records
- **ENR Decoding** - `EnrDecoder` for parsing DNS discovery records
- **ENR Validation** - Type validation and multiaddr extraction
- **Peer Metadata** - Converting ENR data to `PeerInfo` objects

```typescript
import { EnrDecoder } from "@waku/enr";

// DNS discovery uses ENR for peer information extraction
const enrDecoder = new EnrDecoder();
const peerInfo = enrDecoder.fromString(enrRecord);
```

#### **@waku/utils** - Common Utilities
- **Logging System** - `Logger` class with namespace-based debug logging
- **Utility Functions** - `isDefined`, `getWsMultiaddrFromMultiaddrs`, `decodeRelayShard`
- **Type Guards** - Runtime type checking and validation helpers

```typescript
import { Logger, isDefined, getWsMultiaddrFromMultiaddrs } from "@waku/utils";

const log = new Logger("discovery:dns");
const wsAddr = getWsMultiaddrFromMultiaddrs(peer.addresses);
```

#### **@waku/proto** - Protocol Buffer Definitions
- **Peer Exchange Messages** - `proto_peer_exchange` for wire protocol format
- **Message Serialization** - Converting between TypeScript objects and protobuf
- **Network Compatibility** - Ensuring interoperability with other Waku implementations

### Integration with SDK Package

#### **@waku/sdk** - High-Level API
The SDK package (`packages/sdk/src/create/discovery.ts`) provides the primary integration point:

```typescript
import { 
  wakuDnsDiscovery, 
  wakuPeerExchangeDiscovery, 
  wakuLocalPeerCacheDiscovery 
} from "@waku/discovery";

// SDK automatically configures discovery based on options
export function getPeerDiscoveries(
  pubsubTopics: PubsubTopic[],
  enabled?: CreateNodeOptions["discovery"]
): ((components: Libp2pComponents) => PeerDiscovery)[] {
  // Returns configured discovery instances
}
```

#### **Environment-Based Selection**
The SDK supports both original and Effect-based implementations:

```typescript
// Environment variable controls implementation choice
const useEffect = process.env.WAKU_USE_EFFECT_DISCOVERY === "true";

const discovery = useEffect 
  ? wakuDnsDiscoveryEffect(enrTrees)    // Effect implementation
  : wakuDnsDiscovery(enrTrees);         // Original implementation
```

### libp2p Integration Points

#### **PeerDiscovery Interface Compliance**
All discovery implementations satisfy libp2p's `PeerDiscovery` interface:

```typescript
interface PeerDiscovery extends EventEmitter<PeerDiscoveryEvents> {
  readonly [Symbol.toStringTag]: string;
  readonly [peerDiscoverySymbol]: true;
}
```

#### **Event System Integration**
- **'peer' events** - Emitted when new peers are discovered
- **Component integration** - Uses libp2p's `PeerStore` for persistence
- **Connection lifecycle** - Integrates with libp2p's connection manager

#### **Lifecycle Management**
- **Startable interface** - Some discoveries implement `Startable` for explicit lifecycle control
- **Resource cleanup** - Proper disposal of streams, timers, and network resources
- **Error propagation** - libp2p-compatible error handling and event emission

### Data Flow Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   @waku/sdk         │    │  @waku/discovery    │    │   @waku/core        │
│                     │    │                     │    │                     │
│ createLightNode()   │───▶│ PeerDiscovery       │───▶│ BaseProtocol        │
│ ├─ DNS Discovery    │    │ Implementations     │    │ ├─ Stream Mgmt      │
│ ├─ Peer Exchange    │    │ ├─ Effect Services  │    │ ├─ Connection Mgmt  │
│ └─ Local Cache      │    │ ├─ libp2p Wrappers  │    │ └─ Protocol Reg.    │
└─────────────────────┘    │ └─ Legacy Impls     │    └─────────────────────┘
                           └─────────────────────┘
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │  @waku/interfaces   │
                           │                     │
                           │ ├─ Type Definitions │
                           │ ├─ Interface Specs  │
                           │ └─ Error Types      │
                           └─────────────────────┘
```

### Configuration Integration

#### **Shared Configuration Schema**
Discovery configuration integrates with the broader Waku configuration system:

```typescript
// SDK configuration enables/disables discovery mechanisms
interface CreateNodeOptions {
  discovery?: {
    dns?: boolean;           // Enable DNS discovery
    peerExchange?: boolean;  // Enable peer exchange
    localPeerCache?: boolean; // Enable local caching
  };
}
```

#### **Runtime Environment Integration**
- **DEBUG namespaces** - `waku:discovery:*` for debug logging
- **Environment flags** - `WAKU_USE_EFFECT_DISCOVERY`, `WAKU_ENABLE_EFFECT_LOGS`
- **Network configuration** - Automatic ENR tree selection based on network

### Testing Integration Points

#### **Test Infrastructure Sharing**
- **Mock implementations** - Shared test doubles for libp2p components
- **Test utilities** - Common helpers for peer creation and network simulation
- **Integration test patterns** - Consistent testing approaches across packages

#### **Cross-Package Test Dependencies**
- Discovery tests often depend on `@waku/core` for protocol infrastructure
- Integration tests require `@waku/sdk` for full node creation
- Performance tests utilize shared utilities from `@waku/tests`

## FURPS+ Analysis

The discovery package components are analyzed using the FURPS+ model to provide comprehensive architectural insights for developers and system architects.

### **Functionality Requirements**

#### **Core Discovery Mechanisms**
- **DNS Discovery** - ENR-based peer resolution via DNS-over-HTTPS with automatic ENR tree traversal
- **Peer Exchange** - Protocol-native peer discovery with configurable query parameters and retry logic
- **Local Peer Cache** - Persistent peer storage with TTL management and cross-session continuity

#### **Protocol Integration**
- **libp2p Compliance** - Full `PeerDiscovery` interface implementation with event emission
- **Waku Protocol Support** - Native integration with Waku sharding, metadata exchange, and topic filtering
- **Multi-Network Support** - Configurable ENR trees for different network environments (mainnet, testnet, sandbox)

#### **Configuration Management**
```typescript
// Flexible configuration with sensible defaults
interface DnsDiscoveryConfig {
  enrUrls: string[];                          // Multiple ENR sources
  wantedNodeCapabilityCount: NodeCapabilityCount; // Capability filtering
  tagName?: string;                           // Custom peer tagging
  tagValue?: number;                          // Tag priority scoring
  tagTTL?: number;                            // Tag expiration management
}
```

### **Usability Requirements**

#### **Developer Experience**
- **Unified API** - Single import point with consistent factory function patterns
- **Type Safety** - Complete TypeScript definitions with generic constraints
- **Environment-Based Selection** - Automatic fallback between implementation strategies

```typescript
// Simple, intuitive API design
import { wakuDnsDiscovery, wakuPeerExchangeDiscovery } from "@waku/discovery";

const discoveries = [
  wakuDnsDiscovery([enrTree["SANDBOX"]]),
  wakuPeerExchangeDiscovery(["/waku/2/rs/0/0"])
];
```

#### **Configuration Simplicity**
- **Zero-Config Defaults** - Works out-of-the-box with sensible network settings
- **Progressive Enhancement** - Advanced configuration available when needed
- **Environment Integration** - Automatic debug namespace and logging configuration

#### **Error Transparency**
- **Typed Error Hierarchy** - Specific error types for precise handling
- **Contextual Error Information** - Rich error metadata for debugging
- **Graceful Degradation** - Non-fatal errors don't break discovery flow

### **Reliability Requirements**

#### **Fault Tolerance**
- **Multi-Source Redundancy** - DNS discovery supports multiple ENR URL sources
- **Automatic Retry Logic** - Exponential backoff with jitter for network failures
- **Graceful Degradation** - Individual discovery mechanism failures don't affect others

```typescript
// Built-in retry and timeout handling
Schedule.exponential(config.queryInterval, 2).pipe(
  Schedule.jittered,           // Avoid thundering herd
  Schedule.upTo(maxRetryTime)  // Bounded retry attempts
)
```

#### **Resource Management**
- **Effect-Based Cleanup** - Automatic resource disposal using Effect's resource management
- **Stream Lifecycle** - Proper stream termination and memory cleanup
- **Connection Pooling** - Efficient reuse of network connections

#### **Error Recovery**
- **Typed Error Handling** - Compile-time error handling guarantees with Effect.js
- **Isolation** - Discovery failures don't propagate to other system components
- **Self-Healing** - Automatic recovery from transient network issues

### **Performance Requirements**

#### **Concurrency Optimization**
- **Parallel Discovery** - Multiple discovery mechanisms run concurrently
- **Bounded Concurrency** - Configurable limits to prevent resource exhaustion
- **Stream Processing** - Non-blocking peer processing with backpressure handling

```typescript
// Optimized concurrent processing
yield* Effect.forEach(peers, handlePeer, { 
  concurrency: 3           // DNS: Limited concurrency
});

yield* Effect.forEach(peers, handlePeer, { 
  concurrency: "unbounded" // Peer processing: Unlimited
});
```

#### **Network Efficiency**
- **Connection Reuse** - HTTP/2 connection pooling for DNS-over-HTTPS
- **Request Batching** - Multiple peer requests in single protocol exchanges
- **Caching Strategy** - Local peer cache reduces network round trips

#### **Memory Management**
- **Streaming Architecture** - Process peers as they arrive, not in batches
- **Weak References** - Avoid memory leaks in long-running discovery processes
- **TTL-Based Cleanup** - Automatic removal of stale peer information

#### **Performance Metrics**
- **Discovery Latency** - Time from start to first peer discovered
- **Throughput** - Peers discovered per second under load
- **Resource Usage** - Memory and CPU consumption patterns

### **Supportability Requirements**

#### **Observability**
- **Dual Logging System** - Waku debug logging + Effect console logging
- **Namespace-Based Filtering** - `DEBUG=waku:discovery:*` for focused debugging
- **Structured Logging** - JSON-formatted logs with contextual metadata

```typescript
// Rich observability built-in
export const logDiscoveryOperation = <A, E>(
  operation: string,
  effect: Effect.Effect<A, E>
): Effect.Effect<A, E> =>
  Effect.gen(function* () {
    const start = Date.now();
    yield* Effect.logInfo(`Starting ${operation}`);
    const result = yield* effect;
    const duration = Date.now() - start;
    yield* Effect.logInfo(`Completed ${operation} in ${duration}ms`);
    return result;
  });
```

#### **Testing Support**
- **Mock Implementations** - Complete test doubles for all discovery mechanisms
- **Test Utilities** - Shared helpers for creating test environments
- **Integration Test Support** - Cross-package testing infrastructure

#### **Documentation Integration**
- **API Documentation** - Complete TypeScript definitions with JSDoc
- **Usage Examples** - Real-world integration patterns
- **Migration Guides** - Clear paths for adopting new implementations

#### **Debugging Capabilities**
- **Development Mode** - Enhanced logging and validation in development
- **Error Context** - Rich stack traces and error causation chains
- **Performance Profiling** - Built-in metrics for performance analysis

### **Plus (+) Requirements**

#### **Design Constraints**
- **libp2p Compatibility** - Must implement standard `PeerDiscovery` interface
- **Backward Compatibility** - Legacy implementations maintained alongside Effect versions
- **Effect.js Integration** - Leverage Effect's type system and error handling
- **Bundle Size** - Minimal impact on final application bundle size

#### **Implementation Constraints**
- **Browser Compatibility** - Must work in both Node.js and browser environments
- **Network Protocols** - DNS-over-HTTPS, WebSocket, and direct TCP support
- **Memory Limits** - Efficient operation in resource-constrained environments

#### **Interface Constraints**
- **Type System** - Full TypeScript coverage with strict type checking
- **API Stability** - Semantic versioning with clear deprecation policies
- **Configuration Schema** - JSON-serializable configuration objects

#### **Physical Constraints**
- **Network Latency** - Graceful handling of high-latency network conditions
- **Bandwidth Limits** - Efficient protocol usage in low-bandwidth scenarios
- **Platform Limitations** - Work within browser security and Node.js capability boundaries

## Development

For implementation details and development notes, see [DEVELOPMENT.md](./DEVELOPMENT.md).

For logging configuration and integration details, see [docs/LOGGING.md](./docs/LOGGING.md).

## License

MIT OR Apache-2.0