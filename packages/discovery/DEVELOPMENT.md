# Discovery Package Development Guide

## Overview

The `@waku/discovery` package provides peer discovery implementations for Waku nodes using Effect.js for improved error handling, resource management, and type safety.

## Architecture

### Layer Structure

The package follows a layered architecture:

1. **Service Layer** (`src/effect/services/`)
   - Core business logic implemented with Effect
   - Pure functional implementations
   - Dependency injection via Effect layers

2. **Wrapper Layer** (`src/effect/wrappers/`)
   - libp2p compatibility wrappers
   - Maintains backward compatibility
   - Bridges Effect services to standard APIs

3. **Public API** (`src/index.ts`)
   - Exports both Effect and standard versions
   - Maintains backward compatibility
   - Provides type exports

### Service Dependencies

```
HttpClient (from @effect/platform)
    ↓
DnsClient
    ↓
DnsDiscoveryService
```

## Key Patterns

### Error Handling

All errors are typed and extend Effect's `Data.TaggedError`:

```typescript
export class DnsResolutionError extends Data.TaggedError("DnsResolutionError")<{
  readonly domain: string;
  readonly reason: string;
}> {}
```

### Resource Management

Resources are managed using Effect's `acquireRelease`:

```typescript
Stream.ensuring(Effect.sync(() => cleanup()))
```

### Layer Composition

Services are composed using Effect's Layer system:

```typescript
const layer = ServiceLayer.pipe(
  Layer.provide(DependencyLayer),
  Layer.provide(ConfigLayer)
);
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run only Node.js tests
npm run test:node

# Run specific test file
npm test -- dns-discovery-effect.spec.ts
```

### Test Patterns

- Use `Effect.runPromise` to run Effect code in tests
- Mock dependencies using test layers
- Test error scenarios using Effect's error handling

## Performance Considerations

- Use `Stream.tap` for side effects without blocking
- Leverage Effect's built-in retry strategies
- Use `Effect.forEach` with concurrency limits

## Adding New Features

1. Implement in appropriate service layer
2. Export types/errors from index.ts
3. Update wrappers if API changes
4. Maintain backward compatibility

## Environment Variables

- `WAKU_USE_EFFECT_DISCOVERY` - Use Effect implementations globally
- `WAKU_ENABLE_EFFECT_LOGS` - Enable Effect console logging
- `DEBUG` - Enable debug logging (standard Waku logger)