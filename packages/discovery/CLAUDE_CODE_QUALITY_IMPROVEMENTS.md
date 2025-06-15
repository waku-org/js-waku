# Discovery Package Code Quality Improvement Plan

## Overview
This document outlines improvements for the discovery package to enhance readability and developer UX while maintaining all functionality.

## Code Quality Analysis Summary

### Strengths
- Clear separation between Effect and non-Effect code
- Well-organized service layers with logical grouping
- Consistent use of Effect patterns
- Good error typing with tagged unions

### Key Issues
1. **Type Safety**: Extensive use of `any` types in critical places
2. **Documentation**: No JSDoc comments on public APIs
3. **Code Complexity**: Long Effect chains that could be extracted
4. **Mixed Legacy Code**: Unclear separation between old and new implementations
5. **Developer UX**: Confusing dual exports and unclear migration path

## Improvement Plan

### Phase 1: Type Safety & Documentation (High Priority)

#### 1.1 Replace All `any` Types
```typescript
// Before
private layer: any;
private fiber: Fiber.RuntimeFiber<any, any> | null = null;

// After
type DiscoveryLayer = Layer.Layer<
  DnsDiscoveryService | EnrParser | DnsClient | HttpClient.HttpClient,
  never,
  never
>;
private layer: DiscoveryLayer;
private fiber: Fiber.RuntimeFiber<void, never> | null = null;
```

#### 1.2 Add JSDoc Comments
```typescript
/**
 * Creates a DNS-based peer discovery instance for Waku nodes.
 * 
 * @param enrUrls - Array of ENR tree URLs to discover peers from
 * @param wantedNodeCapabilityCount - Required capabilities for discovered nodes
 * @returns A factory function that creates a PeerDiscovery instance
 * 
 * @example
 * ```typescript
 * const discovery = wakuDnsDiscovery(
 *   ["enrtree://...@nodes.example.org"],
 *   { relay: 2, store: 1 }
 * );
 * ```
 * 
 * @throws {EnrParsingError} If ENR tree URLs are malformed
 * @throws {DnsResolutionError} If DNS lookups fail
 */
export function wakuDnsDiscovery(
  enrUrls: string[],
  wantedNodeCapabilityCount: Partial<NodeCapabilityCount> = {}
): (components: DnsDiscoveryComponents) => PeerDiscovery
```

### Phase 2: Code Organization (Medium Priority)

#### 2.1 Extract Complex Effect Chains
```typescript
// Create utility functions for common patterns
const fetchDnsRecordsWithRetry = (
  client: DnsClientService,
  domain: string,
  publicKey: string
) => 
  client.fetchRecords(domain, publicKey).pipe(
    withTimeout(30000, `DNS lookup for ${domain}`),
    withExponentialRetry({ initialDelay: 1000, maxDelay: 10000 })
  );
```

#### 2.2 Reorganize File Structure
```
src/
├── effect/           # All Effect-based implementations
├── legacy/           # Move old implementations here
│   ├── dns/
│   ├── peer-exchange/
│   └── local-peer-cache/
├── index.ts          # Clean exports
└── types.ts          # Shared types
```

### Phase 3: Developer Experience (Medium Priority)

#### 3.1 Improve Error Messages
```typescript
// Before
new InvalidPeerError({
  reason: "No multiaddrs found in peer info"
})

// After  
new InvalidPeerError({
  reason: "No multiaddrs found in peer info",
  suggestion: "Ensure the ENR record contains valid IP addresses and ports",
  peerId: peer.id.toString()
})
```

#### 3.2 Simplify Public API
- Choose single naming convention (remove dual exports)
- Deprecate legacy exports with clear migration path
- Create migration guide with examples

### Phase 4: Documentation & Testing (Low Priority)

#### 4.1 Create Comprehensive Documentation
- API reference with all public functions
- Common patterns and recipes
- Troubleshooting guide
- Performance optimization tips

#### 4.2 Enhance Testing
- Integration tests with real DNS servers
- Error scenario coverage
- Performance benchmarks
- Effect pattern tests

## Implementation Checklist

- [ ] Create type definitions for all Effect layers and fibers
- [ ] Add JSDoc comments to all public functions
- [ ] Extract complex Effect chains into utility functions
- [ ] Move legacy code to legacy/ subdirectory
- [ ] Enhance error messages with actionable information
- [ ] Create shared patterns directory
- [ ] Add debug logging configuration
- [ ] Write API reference documentation
- [ ] Add integration test suite
- [ ] Create migration guide from legacy to Effect

## Code Patterns Library

### Timeout with Retry
```typescript
const withTimeoutAndRetry = <E, A>(
  timeoutMs: number,
  operation: string,
  retrySchedule = Schedule.exponential("1 second", 2)
) => (effect: Effect.Effect<A, E>) =>
  effect.pipe(
    Effect.timeout(Duration.millis(timeoutMs)),
    Effect.mapError(() => new NetworkTimeoutError({ operation, timeoutMs })),
    Effect.retry(retrySchedule)
  );
```

### Silent Error Recovery
```typescript
const recoverWithEmpty = <A>(effect: Effect.Effect<readonly A[], any>) =>
  effect.pipe(
    Effect.tapError((error) => 
      Effect.logWarning("Recovering from error with empty result", error)
    ),
    Effect.orElseSucceed(() => [] as readonly A[])
  );
```

### Resource Management Pattern
```typescript
const withResource = <R, E, A>(
  acquire: Effect.Effect<R, E>,
  use: (resource: R) => Effect.Effect<A, E>,
  release: (resource: R) => Effect.Effect<void>
) =>
  Effect.acquireRelease(acquire, (resource, exit) =>
    Exit.isFailure(exit) 
      ? Effect.logError("Resource cleanup after failure").pipe(
          Effect.zipRight(release(resource))
        )
      : release(resource)
  ).pipe(Effect.map(use), Effect.flatten);
```

## Benefits

1. **Better Developer Experience**: Self-documenting API with clear types
2. **Improved Maintainability**: Organized structure and reusable patterns
3. **Enhanced Debugging**: Better errors and optional debug logging
4. **Backward Compatibility**: All changes preserve existing functionality
5. **Future-Proof**: Establishes patterns for continued Effect adoption

## Next Steps

1. Start with type safety improvements (highest impact)
2. Add documentation incrementally as we touch each file
3. Refactor complex code during regular maintenance
4. Plan legacy code migration for next major version