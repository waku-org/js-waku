# Migration Guide: Waku Discovery to Effect

## Overview

This guide helps you migrate from the original Waku Discovery implementation to the Effect-based version. The migration can be done incrementally without breaking existing code.

## Migration Strategies

### Option 1: Drop-in Replacement (Recommended)

The easiest migration path uses the wrapper classes that maintain the same API:

```typescript
// Before
import { DnsNodeDiscovery } from "@waku/discovery"

const discovery = new DnsNodeDiscovery(enrUrls, components)

// After
import { DnsDiscoveryEffect } from "@waku/discovery/effect"

const discovery = new DnsDiscoveryEffect(enrUrls, components)
```

That's it! The wrapper maintains the same API, so no other code changes are needed.

### Option 2: Gradual Migration to Effect Services

For teams wanting to leverage Effect's benefits, migrate incrementally:

#### Step 1: Replace Discovery Classes

```typescript
// Original
import { 
  DnsNodeDiscovery,
  PeerExchangeDiscovery,
  LocalPeerCacheDiscovery 
} from "@waku/discovery"

// Effect wrappers (same API)
import { 
  DnsDiscoveryEffect,
  PeerExchangeDiscoveryEffect,
  LocalPeerCacheDiscoveryEffect 
} from "@waku/discovery/effect"
```

#### Step 2: Start Using Effect Patterns

Once comfortable with Effect, start using the services directly:

```typescript
import { Effect, Stream } from "effect"
import { 
  DnsDiscoveryService,
  createDnsDiscoveryLayer 
} from "@waku/discovery/effect"

// Create the service layer
const discoveryLayer = createDnsDiscoveryLayer(config)

// Use in your application
const discoverPeers = Effect.gen(function* () {
  const dns = yield* DnsDiscoveryService
  
  // Discover 10 peers
  const peers = yield* dns.discover().pipe(
    Stream.take(10),
    Stream.runCollect
  )
  
  return peers
})

// Run the effect
const peers = await Effect.runPromise(
  discoverPeers.pipe(Effect.provide(discoveryLayer))
)
```

#### Step 3: Integrate with Your Effect App

If you're already using Effect in your application:

```typescript
// Your app's main layer
const AppLayerLive = Layer.mergeAll(
  DatabaseLive,
  HttpClientLive,
  // Add discovery layers
  createDnsDiscoveryLayer(dnsConfig),
  createPeerExchangeLayer(pxConfig),
  createCacheLayer(cacheConfig)
)

// Use discovery in your services
const MyServiceLive = Layer.effect(
  MyService,
  Effect.gen(function* () {
    const dns = yield* DnsDiscoveryService
    const cache = yield* CacheService
    
    return {
      discoverAndCache: () => Effect.gen(function* () {
        const peers = yield* dns.discover().pipe(
          Stream.tap(peer => cache.add(peer)),
          Stream.take(20),
          Stream.runCollect
        )
        return peers
      })
    }
  })
)
```

## Common Migration Patterns

### Error Handling

#### Before:
```typescript
try {
  const peers = await discovery.findPeers()
} catch (error) {
  if (error.message.includes("timeout")) {
    console.error("Discovery timed out")
  } else {
    console.error("Discovery failed:", error)
  }
}
```

#### After (with Effect):
```typescript
const peers = await Effect.runPromise(
  dnsService.discover().pipe(
    Stream.take(10),
    Stream.runCollect,
    Effect.catchTag("NetworkTimeoutError", () => {
      Effect.logError("Discovery timed out")
      return Effect.succeed([])
    }),
    Effect.catchAll((error) => {
      Effect.logError("Discovery failed", error)
      return Effect.succeed([])
    })
  )
)
```

### Event Handling

#### Before:
```typescript
discovery.addEventListener("peer:discovery", (event) => {
  const peer = event.detail
  console.log("Found peer:", peer.id)
})
```

#### After (with Effect streams):
```typescript
await Effect.runPromise(
  dnsService.discover().pipe(
    Stream.tap(peer => 
      Effect.log(`Found peer: ${peer.peerInfo.id}`)
    ),
    Stream.runDrain
  )
)
```

### Resource Management

#### Before:
```typescript
const discovery = new DnsNodeDiscovery(urls, components)
try {
  await discovery.start()
  // Use discovery
} finally {
  await discovery.stop()
}
```

#### After (with Effect):
```typescript
await Effect.runPromise(
  Effect.acquireUseRelease(
    Effect.succeed(new DnsDiscoveryEffect(urls, components)),
    (discovery) => Effect.promise(() => discovery.start()),
    (discovery) => Effect.promise(() => discovery.stop())
  )
)
```

### Testing

#### Before:
```typescript
// Mock discovery
const mockDiscovery = {
  start: jest.fn(),
  stop: jest.fn(),
  addEventListener: jest.fn()
}
```

#### After (with Effect):
```typescript
// Create test layer
const TestDiscoveryLayer = Layer.succeed(DnsDiscoveryService, {
  discover: () => Stream.fromIterable(mockPeers),
  discoverFromUrl: () => Effect.succeed(mockPeers),
  stop: () => Effect.succeed(void 0)
})

// Run tests with mock
const result = await Effect.runPromise(
  myProgram.pipe(Effect.provide(TestDiscoveryLayer))
)
```

## Configuration Migration

### DNS Discovery

```typescript
// Before
const discovery = new DnsNodeDiscovery(
  enrUrls,
  components,
  {
    tagName: "dns",
    tagValue: 50,
    tagTTL: 120000
  }
)

// After (wrapper - same API)
const discovery = new DnsDiscoveryEffect(
  enrUrls,
  components,
  {
    tagName: "dns",
    tagValue: 50,
    tagTTL: 120000
  }
)

// After (Effect service)
const config: DnsDiscoveryConfig = {
  enrUrls,
  wantedNodeCapabilityCount: {},
  tagName: "dns",
  tagValue: 50,
  tagTTL: 120000
}

const layer = createDnsDiscoveryLayer(config, components)
```

### Peer Exchange

```typescript
// Before
const discovery = new PeerExchangeDiscovery(
  components,
  pubsubTopics,
  {
    tagName: "peer-exchange",
    tagValue: 50,
    maxRetries: 3
  }
)

// After (Effect service)
const config: PeerExchangeConfig = {
  numPeersToRequest: 10,
  queryInterval: 60000,
  maxRetries: 3,
  tagName: "peer-exchange",
  tagValue: 50,
  tagTTL: 120000
}

const layer = createPeerExchangeLayer(pubsubTopics, config)
```

## Troubleshooting

### Common Issues

1. **"Service not found" errors**
   - Ensure you're providing all required layers
   - Check that service dependencies are satisfied

2. **Type errors with Effect.runPromise**
   - Make sure to handle all errors or use `Effect.catchAll`
   - The Effect must have error type `never` to use `runPromise`

3. **Performance concerns**
   - Effect adds minimal overhead for I/O operations
   - Use the benchmarks to verify performance in your use case

### Getting Help

1. Check the [API documentation](./API.md)
2. Look at the [examples](./examples/)
3. Review the [Effect documentation](https://effect.website)

## Benefits After Migration

1. **Better error handling**: All errors are typed and tracked
2. **Improved testing**: Easy to mock services and test in isolation
3. **Resource safety**: Automatic cleanup with Effect's resource management
4. **Composability**: Combine discovery methods easily
5. **Observability**: Built-in logging and tracing support

## Next Steps

1. Start with the wrapper classes for immediate compatibility
2. Gradually adopt Effect patterns in new code
3. Refactor critical paths to use Effect services directly
4. Leverage Effect's ecosystem for logging, metrics, and tracing

Remember: The migration can be done incrementally. Start small and expand as your team becomes comfortable with Effect patterns.