# Logging Integration: Waku Logger + Effect

This document explains how the Effect-based discovery implementations integrate with the existing Waku logging infrastructure while providing additional Effect-specific logging capabilities.

## Overview

The integration provides a bridge between:
- **Waku Logger**: The existing debug-based logging used throughout the monorepo
- **Effect Console**: Effect's native logging capabilities for Effect-aware tooling

## Key Features

### 1. Dual Logging Support
- **Default**: Uses Waku Logger for consistency with the rest of the monorepo
- **Optional**: Can enable Effect Console logging for Effect-specific tooling
- **Seamless**: Consumers don't need to import Effect to use discovery

### 2. Environment Variable Configuration
```bash
# Enable Effect Console logging (disabled by default)
export WAKU_ENABLE_EFFECT_CONSOLE=true

# Disable Waku Logger (enabled by default)
export WAKU_DISABLE_WAKU_LOGGER=true
```

### 3. Consistent Logging Namespaces
- DNS Discovery: `effect:dns-discovery`
- Peer Exchange: `effect:peer-exchange` 
- Local Cache: `effect:local-cache`

## Usage Examples

### Basic Usage (No Changes Required)
```typescript
import { wakuDnsDiscovery } from "@waku/discovery";

// Logging works automatically using Waku Logger
const discovery = wakuDnsDiscovery(urls);
```

### Advanced: Custom Logging Layer
```typescript
import { 
  wakuDnsDiscoveryEffect,
  createLoggerLayer
} from "@waku/discovery";

// Create custom logger configuration
const customLogger = createLoggerLayer({
  prefix: "my-app:dns",
  enableEffectConsole: true,
  enableWakuLogger: true
});

// Use with custom Effect application
```

### Advanced: Programmatic Log Control
```typescript
import {
  logWithContext,
  logError,
  logPeerDiscovered,
  logDiscoveryOperation
} from "@waku/discovery";

// These helpers are available for custom Effect code
```

## Implementation Details

### Waku Logger Integration
- Uses the same `debug` package as the rest of the monorepo
- Maintains existing namespace conventions (`waku:info:*, waku:warn:*, waku:error:*`)
- Respects existing DEBUG environment variable patterns

### Effect Console Integration  
- Provides structured logging for Effect-aware development tools
- Supports Effect's logging levels (debug, info, warn, error)
- Can be enabled/disabled independently of Waku Logger

### Layer Architecture
```typescript
// Discovery layers automatically include logging
DnsDiscoveryServiceRaw.pipe(
  Layer.provide(DnsClientLive),
  Layer.provide(EnrParserLive), 
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(createEnvironmentLoggerLayer("dns-discovery")), // <-- Logging layer
  Layer.provide(Layer.succeed(DnsDiscoveryConfigTag, config))
);
```

## Debugging

### View DNS Discovery Logs
```bash
DEBUG="waku:*:effect:dns-discovery" node your-app.js
```

### View All Effect Discovery Logs
```bash
DEBUG="waku:*:effect:*" node your-app.js
```

### Enable Effect Console Logging
```bash
WAKU_ENABLE_EFFECT_CONSOLE=true node your-app.js
```

## Benefits

1. **Backward Compatibility**: Existing code continues to work without changes
2. **Consistent Logging**: Same logging patterns as rest of Waku ecosystem
3. **Effect-Aware**: Supports Effect-specific development workflows
4. **Configurable**: Can be tuned for different environments (dev, prod, testing)
5. **Type Safe**: All logging is typed and integrated with Effect's error handling

## Log Output Examples

### Waku Logger Output (Default)
```
waku:info:effect:dns-discovery DNS discovery completed {"enrUrl":"enrtree://...", "discoveredPeers":3, "domain":"test.waku.nodes.status.im"}
```

### Effect Console Output (When Enabled)
```
[INFO] DNS discovery completed {"context": {"enrUrl":"enrtree://...", "discoveredPeers":3, "domain":"test.waku.nodes.status.im"}}
```

## Migration Notes

- **No breaking changes**: Existing code continues to work
- **Opt-in**: Effect Console logging is disabled by default
- **Performance**: Minimal overhead when Effect Console is disabled
- **Testing**: Mock DNS clients and logging work together seamlessly