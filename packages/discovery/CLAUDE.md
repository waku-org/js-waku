# Claude Context for Discovery Package

## Overview
This package has been refactored to use Effect for better error handling, resource management, and async operation control. The Effect implementations are drop-in replacements for the original implementations.

## Key Implementation Details

### Layer Composition
The Effect implementation uses a layered architecture for dependency injection:
- `HttpClient` (from @effect/platform) → `DnsClient` → `DnsDiscoveryService`
- Services are composed using Effect's Layer system
- Use `DnsDiscoveryServiceRaw` when you need to compose layers manually

### Error Types
All errors are typed and exported:
- `DnsResolutionError` - DNS lookup failures
- `EnrParsingError` - ENR record parsing issues  
- `PeerExchangeError` - Peer exchange protocol errors
- `NetworkTimeoutError` - Network timeout issues
- `InvalidPeerError` - Invalid peer data
- `CacheError` - Local storage errors
- `ProtocolError` - Protocol-level errors

### Resource Management
- All resources (subscriptions, timers, etc.) are automatically cleaned up
- Use Effect's `ensuring` and `acquireRelease` for resource safety
- Streams handle backpressure automatically

### Testing
- Tests use FetchHttpClient for HTTP layer in Node.js
- Layer composition must be done correctly for tests to pass
- Use `Effect.runPromise` to run Effect code in tests

## Migration Guide Summary

### For SDK Integration
```typescript
// Environment variable approach
export WAKU_USE_EFFECT_DISCOVERY=true

// Direct import approach  
import { wakuDnsDiscoveryEffect } from "@waku/discovery"
```

### API Compatibility
All Effect implementations maintain 100% API compatibility with original versions:
- Same function signatures
- Same return types
- Same behavior

### Gradual Migration
You can migrate one discovery method at a time - they work alongside original implementations.

## File Structure

### Effect Implementation
- `src/effect/services/` - Core Effect services
- `src/effect/wrappers/` - libp2p-compatible wrappers
- `src/effect/index.ts` - Public exports

### Legacy Code (kept for compatibility)
- `src/dns/` - Original DNS implementation
- `src/peer-exchange/` - Protocol-level exports
- `src/local-peer-cache/` - Original cache implementation

### Removed Files
- Old implementation files that were fully replaced
- Temporary documentation and backup files
- Unused test files

## Development Notes

### Adding New Features
1. Implement in appropriate service layer
2. Export types/errors from index.ts
3. Update wrappers if API changes
4. Maintain backward compatibility

### Common Patterns
```typescript
// Error handling
Effect.gen(function* () {
  const result = yield* operation.pipe(
    Effect.mapError(() => new CustomError({ ... }))
  )
})

// Resource management
Stream.ensuring(Effect.sync(() => cleanup()))

// Timeout handling  
Effect.timeout("30 seconds").pipe(
  Effect.mapError(() => new NetworkTimeoutError({ ... }))
)
```

### Performance Considerations
- Use `Stream.tap` for side effects without blocking
- Use `Effect.forEach` with concurrency limits
- Leverage Effect's built-in retry strategies

## Future Improvements
- Consider adding metrics/tracing support
- Could add configuration validation layer
- Potential for adding health checks