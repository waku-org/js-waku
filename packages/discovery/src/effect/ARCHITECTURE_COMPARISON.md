# Architecture Comparison: Original vs Effect

## High-Level Architecture

### Original Architecture
```
┌─────────────────────────────────────────────┐
│              Application Code               │
├─────────────────────────────────────────────┤
│          Discovery Classes                  │
│  ┌─────────────┬──────────────┬──────────┐ │
│  │ DnsDiscovery│ PeerExchange │  Cache   │ │
│  └─────────────┴──────────────┴──────────┘ │
├─────────────────────────────────────────────┤
│           Direct Dependencies               │
│  ┌──────────┬────────────┬──────────────┐  │
│  │ HTTP API │ localStorage│ libp2p APIs │  │
│  └──────────┴────────────┴──────────────┘  │
└─────────────────────────────────────────────┘

Issues:
- Tight coupling to implementations
- Hard to test (need to mock HTTP, localStorage)
- Manual error handling everywhere
- No unified approach to retries/timeouts
```

### Effect Architecture
```
┌─────────────────────────────────────────────┐
│              Application Code               │
├─────────────────────────────────────────────┤
│          Wrapper Layer (Compat)             │
│  ┌─────────────┬──────────────┬──────────┐ │
│  │ DnsEffect   │ PxEffect     │CacheEffect│ │
│  └─────────────┴──────────────┴──────────┘ │
├─────────────────────────────────────────────┤
│            Service Layer                    │
│  ┌─────────────┬──────────────┬──────────┐ │
│  │ DnsService  │ PxService    │CacheService│ │
│  └─────────────┴──────────────┴──────────┘ │
├─────────────────────────────────────────────┤
│         Infrastructure Layer                │
│  ┌──────────┬────────────┬──────────────┐  │
│  │DnsClient │StorageBackend│ Protocol   │  │
│  └──────────┴────────────┴──────────────┘  │
└─────────────────────────────────────────────┘

Benefits:
- Clean separation of concerns
- Easy to test (provide mock layers)
- Automatic error propagation
- Unified retry/timeout strategies
```

## Error Handling Comparison

### Original Pattern
```typescript
// Errors are handled ad-hoc
async function discover() {
  try {
    const result = await fetch(url)
    if (!result.ok) {
      log.error("Failed to fetch")
      return [] // Silent failure
    }
    return result.json()
  } catch (error) {
    log.error("Network error", error)
    return [] // Another silent failure
  }
}

// Caller has no idea what went wrong
const peers = await discover() // Could be empty for many reasons
```

### Effect Pattern
```typescript
// Errors are part of the type signature
function discover(): Effect<Peer[], DnsError | NetworkError> {
  return Effect.gen(function* () {
    const result = yield* httpClient.get(url)
    return yield* parseResponse(result)
  })
}

// Caller must handle specific errors
const peers = await discover().pipe(
  Effect.catchTag("NetworkError", () => 
    Effect.logWarning("Network issue, using cache")
  ),
  Effect.catchTag("DnsError", () => 
    Effect.fail(new DiscoveryError("DNS failed"))
  ),
  Effect.runPromise
)
```

## State Management Comparison

### Original Pattern
```typescript
class Discovery {
  private state = new Map()
  private mutex = new Mutex() // If you're lucky
  
  async updateState(key: string, value: any) {
    // Hope no one else is updating...
    const current = this.state.get(key)
    // Some async operation
    await someAsyncWork()
    // State might have changed!
    this.state.set(key, value)
  }
}
```

### Effect Pattern
```typescript
const DiscoveryLive = Layer.effect(
  Discovery,
  Effect.gen(function* () {
    // Thread-safe by default
    const state = yield* Ref.make(new Map())
    
    const updateState = (key: string, value: any) =>
      Ref.update(state, map => 
        new Map(map).set(key, value)
      )
    
    return { updateState }
  })
)
```

## Resource Management Comparison

### Original Pattern
```typescript
class Discovery {
  private timer?: NodeJS.Timer
  private connections: Connection[] = []
  
  async start() {
    this.timer = setInterval(...)
    // Hope we remember to clean up!
  }
  
  async stop() {
    if (this.timer) clearInterval(this.timer)
    // Did we forget anything?
    for (const conn of this.connections) {
      try {
        await conn.close()
      } catch (e) {
        // Now what?
      }
    }
  }
}
```

### Effect Pattern
```typescript
const discovery = Effect.acquireRelease(
  // Acquire
  Effect.gen(function* () {
    const fiber = yield* Stream.repeat(Effect.sleep("5 minutes")).pipe(
      Stream.flatMap(() => discoverPeers()),
      Stream.runDrain,
      Effect.fork
    )
    return { fiber }
  }),
  // Release (guaranteed to run)
  ({ fiber }) => Fiber.interrupt(fiber)
)

// Use (errors won't prevent cleanup)
const program = Effect.scoped(
  Effect.gen(function* () {
    const { fiber } = yield* discovery
    // Do work...
  })
)
```

## Testing Comparison

### Original Testing
```typescript
// Need to mock everything
describe("Discovery", () => {
  let fetchStub: sinon.SinonStub
  let localStorageStub: any
  
  beforeEach(() => {
    fetchStub = sinon.stub(global, "fetch")
    localStorageStub = {
      getItem: sinon.stub(),
      setItem: sinon.stub()
    }
    global.localStorage = localStorageStub
  })
  
  afterEach(() => {
    fetchStub.restore()
    delete global.localStorage
  })
  
  it("discovers peers", async () => {
    fetchStub.returns(Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockData)
    }))
    
    const discovery = new DnsDiscovery(...)
    // Test...
  })
})
```

### Effect Testing
```typescript
// Provide test implementations
describe("Discovery", () => {
  const TestDnsClient = Layer.succeed(DnsClient, {
    fetchRecords: () => Effect.succeed(["enr:mock"])
  })
  
  const TestStorage = Layer.succeed(StorageBackend, {
    get: () => Effect.succeed(null),
    set: () => Effect.succeed(void 0)
  })
  
  it("discovers peers", async () => {
    const result = await program.pipe(
      Effect.provide(TestDnsClient),
      Effect.provide(TestStorage),
      Effect.runPromise
    )
    
    expect(result).toEqual(expectedPeers)
  })
})
```

## Performance Characteristics

### Memory Usage
- **Original**: Direct object references, minimal overhead
- **Effect**: Small overhead per Effect (~100 bytes), negligible for I/O

### CPU Usage
- **Original**: Baseline performance
- **Effect**: 2-3x overhead for micro-operations, <10% for I/O operations

### Developer Productivity
- **Original**: Quick to write, hard to maintain
- **Effect**: More upfront design, much easier to maintain and test

## Migration Path

```typescript
// Phase 1: Use wrapper (no code changes)
import { DnsDiscoveryEffect as DnsDiscovery } from "@waku/discovery/effect"

// Phase 2: Use Effect services directly
const program = Effect.gen(function* () {
  const dns = yield* DnsDiscoveryService
  const peers = yield* dns.discover().pipe(
    Stream.take(10),
    Stream.runCollect
  )
})

// Phase 3: Compose with your Effect app
const AppLive = Layer.mergeAll(
  DnsDiscoveryLive,
  PeerExchangeLive,
  CacheLive,
  YourServicesLive
)
```

## Conclusion

The Effect implementation provides:
1. **Better error handling** - No silent failures
2. **Safer concurrency** - No race conditions  
3. **Easier testing** - Just provide different layers
4. **Better maintainability** - Clear dependencies
5. **Production readiness** - Built-in retries, timeouts, and recovery

The cost is minimal for I/O-bound operations like discovery, making it an excellent choice for production use.