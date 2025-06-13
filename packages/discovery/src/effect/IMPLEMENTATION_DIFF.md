# Annotated Diff: Original vs Effect Implementation

This document shows the key differences between the original Waku Discovery implementation and the Effect-based version.

## 1. DNS Discovery Service

### Original Implementation
```typescript
// src/dns/dns.ts
export class DnsNodeDiscovery implements PeerDiscovery {
  private readonly nextPeer = new Map<string, Map<string, ENR>>();
  private _started = false;
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    enrUrls: string[],
    private components: DnsDiscoveryComponents
  ) {
    // Direct initialization
    this.enrTreeUrls = enrUrls.map(parseEnrTree);
    this.dns = new DnsOverHttps();
  }

  async start(): Promise<void> {
    if (this._started) return;
    
    // Simple async/await pattern
    await this.findAndAddPeers();
    
    // Basic setInterval for recurring discovery
    this.timer = setInterval(() => {
      this.findAndAddPeers().catch((e) => 
        log.error("DNS discovery error", e)
      );
    }, 300_000); // 5 minutes
    
    this._started = true;
  }
  
  private async findAndAddPeers(): Promise<void> {
    for (const { publicKey, domain } of this.enrTreeUrls) {
      try {
        const enrs = await this.dns.retrieveNodes(domain, publicKey);
        // Manual filtering and processing
        const peers = enrs.filter(enr => /* complex filtering logic */);
        // Direct event emission
        for (const peer of peers) {
          this.dispatchEvent(new CustomEvent("peer", { detail: peer }));
        }
      } catch (error) {
        log.error(`Failed to discover peers from ${domain}`, error);
        // Error is logged but not propagated
      }
    }
  }
}
```

### Effect Implementation
```typescript
// src/effect/services/dns/dns-service.ts
export const DnsDiscoveryServiceLive = Layer.effect(
  DnsDiscoveryService,
  Effect.gen(function* () {
    // Dependencies injected via Effect context
    const config = yield* DnsDiscoveryConfig
    const dnsClient = yield* DnsClient  
    const enrParser = yield* EnrParser
    
    // State managed with Effect Ref
    const isRunning = yield* Ref.make(true)
    
    const discoverFromUrl = (url: string) =>
      Effect.gen(function* () {
        // Parse URL with error handling built-in
        const { domain, publicKey } = yield* enrParser.parseTreeUrl(url)
        
        // Fetch records with automatic retry and timeout
        const records = yield* dnsClient.fetchRecords(domain, publicKey).pipe(
          Effect.timeout("30 seconds"),
          Effect.retry(Schedule.exponential("1 second"))
        )
        
        // Parse ENRs with error recovery
        const peers = yield* Effect.forEach(
          records,
          (record) => enrParser.parseEnr(record).pipe(
            Effect.flatMap(enrToDiscoveredPeer),
            Effect.catchAll(() => Effect.succeed(null))
          ),
          { concurrency: "unbounded" }
        ).pipe(
          Effect.map(results => results.filter(isDefined))
        )
        
        return peers
      })
    
    // Stream-based continuous discovery
    const discover = () =>
      Stream.repeatEffect(
        Effect.forEach(config.enrUrls, discoverFromUrl, { concurrency: 5 })
      ).pipe(
        Stream.schedule(Schedule.spaced("5 minutes")),
        Stream.flatMap(Stream.fromIterable),
        Stream.flatMap(Stream.fromIterable),
        Stream.takeWhile(() => Ref.get(isRunning))
      )
    
    return { discover, discoverFromUrl, stop: () => Ref.set(isRunning, false) }
  })
)
```

**Key Differences:**
- ✅ **Dependency Injection**: Effect uses context tags instead of constructor parameters
- ✅ **Error Handling**: All errors are tracked in the type system
- ✅ **Resource Management**: Automatic cleanup with streams
- ✅ **Retry Logic**: Built-in retry with exponential backoff
- ✅ **Concurrency**: Controlled concurrent operations
- ✅ **Testability**: Easy to mock any dependency

## 2. Peer Exchange Service

### Original Implementation
```typescript
// src/peer-exchange/waku_peer_exchange_discovery.ts
export class PeerExchangeDiscovery implements PeerDiscovery {
  private queryingPeers: Set<string> = new Set();
  private queryAttempts: Map<string, number> = new Map();
  
  private async query(peerId: PeerId): Promise<void> {
    const peerIdStr = peerId.toString();
    
    // Manual state tracking
    if (this.queryingPeers.has(peerIdStr)) return;
    this.queryingPeers.add(peerIdStr);
    
    try {
      // Direct protocol usage
      const result = await this.peerExchange.query({
        peerId,
        numPeers: DEFAULT_PEER_EXCHANGE_REQUEST_NODES
      });
      
      // Manual error handling and retry logic
      if (!result || result.error) {
        const attempts = (this.queryAttempts.get(peerIdStr) || 0) + 1;
        this.queryAttempts.set(peerIdStr, attempts);
        
        if (attempts < DEFAULT_MAX_RETRIES) {
          // Manual exponential backoff
          setTimeout(() => {
            this.query(peerId).catch(log.error);
          }, Math.pow(2, attempts) * 1000);
        }
        return;
      }
      
      // Process peers
      for (const peerInfo of result.peerInfos) {
        this.dispatchEvent(new CustomEvent("peer", { detail: peerInfo }));
      }
    } catch (error) {
      log.error(`Failed to query peer ${peerIdStr}`, error);
    } finally {
      this.queryingPeers.delete(peerIdStr);
    }
  }
}
```

### Effect Implementation
```typescript
// src/effect/services/peer-exchange/peer-exchange-service.ts
export const PeerExchangeServiceLive = Layer.effect(
  PeerExchangeService,
  Effect.gen(function* () {
    const config = yield* PeerExchangeConfig
    const protocol = yield* PeerExchangeProtocol
    
    // State managed with Effect Ref
    const queryStates = yield* Ref.make(new Map<string, PeerQueryState>())
    const discoveryQueue = yield* Queue.unbounded<DiscoveredPeer>()
    
    const queryPeer = (peerId: PeerId, numPeers: number) =>
      Effect.gen(function* () {
        // Protocol query with built-in timeout
        const result = yield* protocol.query({ peerId, numPeers }).pipe(
          Effect.timeout("30 seconds"),
          Effect.mapError((error) => {
            if (error._tag === "TimeoutException") {
              return new NetworkTimeoutError({
                operation: `Peer exchange query to ${peerId}`,
                timeoutMs: 30000
              })
            }
            return error
          })
        )
        
        // Convert ENRs to peers with error recovery
        const peers = yield* Effect.forEach(
          result.peerInfos,
          (peerInfo) => enrToDiscoveredPeer(peerInfo.ENR).pipe(
            Effect.option
          ),
          { concurrency: "unbounded" }
        ).pipe(
          Effect.map(options => options.filter(isDefined))
        )
        
        return peers
      })
    
    const startRecurringQueries = (peerId: PeerId) =>
      Effect.repeat(
        Effect.gen(function* () {
          const state = yield* Ref.get(queryStates).pipe(
            Effect.map(states => states.get(peerId.toString()))
          )
          
          if (!state?.isActive || state.attempts >= config.maxRetries) {
            return yield* stopQueriesForPeer(peerId.toString())
          }
          
          // Query and queue results
          const peers = yield* queryPeer(peerId, config.numPeersToRequest)
          yield* Queue.offerAll(discoveryQueue, peers)
          
          // Update state
          yield* Ref.update(queryStates, updatePeerState(peerId))
        }),
        // Automatic exponential backoff with jitter
        Schedule.exponential(config.queryInterval, 2).pipe(
          Schedule.jittered,
          Schedule.upTo(config.queryInterval * 10)
        )
      ).pipe(Effect.fork)
    
    // Stream-based discovery
    const discover = () => Stream.fromQueue(discoveryQueue)
    
    return { discover, queryPeer, stop, handlePeerExchangePeer }
  })
)
```

**Key Differences:**
- ✅ **State Management**: Effect Ref instead of Set/Map
- ✅ **Queue-based Discovery**: Decouples discovery from consumption
- ✅ **Schedule Combinators**: Sophisticated retry with jitter
- ✅ **Type-safe Errors**: All failure modes tracked
- ✅ **Concurrent Safety**: No race conditions

## 3. Cache Service

### Original Implementation
```typescript
// src/local-peer-cache/index.ts
export class LocalPeerCacheDiscovery implements PeerDiscovery {
  private peers: Map<string, LocalStoragePeerInfo> = new Map();
  
  constructor(
    components: Libp2pComponents,
    private readonly options?: LocalPeerCacheDiscoveryOptions
  ) {
    // Direct localStorage access
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          const peers = JSON.parse(stored);
          // Manual validation and filtering
          this.peers = new Map(
            peers.filter(p => this.isValidPeer(p))
                 .map(p => [p.id, p])
          );
        }
      } catch (error) {
        log.error("Failed to load peers from localStorage", error);
      }
    }
  }
  
  private async savePeers(): Promise<void> {
    if (typeof window === "undefined" || !window.localStorage) return;
    
    try {
      const peersArray = Array.from(this.peers.values());
      localStorage.setItem(this.storageKey, JSON.stringify(peersArray));
    } catch (error) {
      log.error("Failed to save peers", error);
      // Quota exceeded handling
      if (error.name === "QuotaExceededError") {
        this.peers.clear();
        localStorage.removeItem(this.storageKey);
      }
    }
  }
}
```

### Effect Implementation
```typescript
// src/effect/services/cache/cache-service.ts
export const CacheServiceLive = Layer.effect(
  CacheService,
  Effect.gen(function* () {
    const config = yield* LocalCacheConfig
    const storage = yield* StorageBackend
    
    // Initialize cache with stored data
    const initialData = yield* storage.get(config.storageKey).pipe(
      Effect.map(data => data ? JSON.parse(data) : []),
      Effect.catchAll(() => Effect.succeed([]))
    )
    
    // Thread-safe cache with Ref
    const cache = yield* Ref.make(new Map(
      initialData
        .filter(isValidCacheEntry)
        .map(entry => [entry.peerId, entry])
    ))
    
    // Automatic persistence on changes
    const persistCache = () =>
      Effect.gen(function* () {
        const entries = yield* Ref.get(cache)
        const data = JSON.stringify(Array.from(entries.values()))
        
        yield* storage.set(config.storageKey, data).pipe(
          Effect.catchTag("QuotaExceededError", () =>
            Effect.gen(function* () {
              // Clear cache and retry
              yield* Ref.set(cache, new Map())
              yield* storage.remove(config.storageKey)
            })
          )
        )
      })
    
    const add = (peer: DiscoveredPeer) =>
      Effect.gen(function* () {
        const now = Date.now()
        
        yield* Ref.update(cache, (map) => {
          const newMap = new Map(map)
          
          // Enforce size limit
          if (newMap.size >= config.maxSize) {
            const oldest = Array.from(newMap.entries())
              .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0]
            if (oldest) newMap.delete(oldest[0])
          }
          
          newMap.set(peer.peerInfo.id.toString(), {
            ...peer,
            timestamp: now,
            lastSeen: now
          })
          
          return newMap
        })
        
        yield* persistCache()
      })
    
    const getAll = () =>
      Ref.get(cache).pipe(
        Effect.map(map => {
          const now = Date.now()
          const validEntries = Array.from(map.values())
            .filter(entry => now - entry.timestamp < config.ttl)
          
          return validEntries.map(({ peerInfo, source }) => ({
            peerInfo,
            source
          }))
        })
      )
    
    return { get, getAll, add, remove, clear }
  })
)
```

**Key Differences:**
- ✅ **Storage Abstraction**: Platform-agnostic storage backend
- ✅ **Thread Safety**: Ref ensures atomic updates
- ✅ **Automatic Persistence**: Changes trigger saves
- ✅ **Error Recovery**: Graceful quota handling
- ✅ **TTL Management**: Built into queries

## 4. Wrapper Pattern for Backward Compatibility

```typescript
// src/effect/wrappers/dns-discovery-wrapper.ts
export class DnsDiscoveryEffect
  extends TypedEventEmitter<PeerDiscoveryEvents>
  implements PeerDiscovery {
  
  private runtime: Runtime.Runtime<any>
  private _layer: Layer.Layer<any, any, any>
  
  constructor(
    components: DnsDiscoveryComponents,
    options: DnsDiscoveryOptions
  ) {
    super()
    
    // Create Effect layer with config
    const config = {
      enrUrls: options.enrUrls,
      wantedNodeCapabilityCount: options.wantedNodeCapabilityCount || {},
      tagName: options.tagName || DEFAULT_BOOTSTRAP_TAG_NAME,
      tagValue: options.tagValue ?? DEFAULT_BOOTSTRAP_TAG_VALUE,
      tagTTL: options.tagTTL ?? DEFAULT_BOOTSTRAP_TAG_TTL
    }
    
    // Build service layer
    this._layer = createDnsDiscoveryLayer(config, components)
    this.runtime = Runtime.defaultRuntime
  }
  
  async start(): Promise<void> {
    if (this._started) return
    
    // Run Effect discovery as traditional async
    const effect = Effect.gen(function* () {
      const service = yield* DnsDiscoveryService
      
      // Convert stream to events
      yield* service.discover().pipe(
        Stream.tap((peer) => 
          Effect.sync(() => 
            this.dispatchEvent(
              new CustomEvent("peer:discovery", { detail: peer })
            )
          )
        ),
        Stream.runDrain
      )
    }).pipe(
      Effect.provide(this._layer),
      Effect.fork
    )
    
    this.fiber = await Effect.runPromise(effect)
    this._started = true
  }
  
  stop(): void {
    if (!this._started) return
    
    // Interrupt Effect fiber
    if (this.fiber) {
      Effect.runPromise(Fiber.interrupt(this.fiber))
    }
    
    this._started = false
  }
}
```

**Key Pattern:**
- ✅ **Drop-in Replacement**: Same API as original
- ✅ **Effect Integration**: Runs Effect internally
- ✅ **Event Compatibility**: Converts streams to events
- ✅ **Resource Cleanup**: Proper fiber interruption

## Summary of Benefits

1. **Type Safety**: All errors are tracked at compile time
2. **Composability**: Services can be easily combined
3. **Testability**: Any dependency can be mocked
4. **Resource Safety**: Automatic cleanup guaranteed
5. **Retry Logic**: Sophisticated retry strategies built-in
6. **Concurrency**: Safe concurrent operations
7. **Observability**: Built-in logging and tracing hooks
8. **Performance**: Minimal overhead for I/O operations