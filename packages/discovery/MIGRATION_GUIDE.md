# Migration Guide: Using Effect-based Discovery

This guide explains how to migrate from the original discovery implementations to the new Effect-based ones.

## Overview

The Effect-based discovery implementations provide:
- Better error handling with typed errors
- Automatic resource cleanup
- Improved concurrency control
- Better testability

All Effect implementations are **drop-in replacements** for the original implementations.

## Migration Options

### Option 1: Environment Variable (Recommended for Testing)

Set the environment variable to enable Effect-based discovery globally:

```bash
export WAKU_USE_EFFECT_DISCOVERY=true
npm start
```

This will automatically use Effect implementations in the SDK when creating nodes with `defaultBootstrap: true`.

### Option 2: Direct Import (Recommended for Production)

Import the Effect-based implementations directly:

```typescript
import { 
  wakuDnsDiscoveryEffect,
  wakuPeerExchangeDiscoveryEffect,
  wakuLocalPeerCacheDiscoveryEffect 
} from "@waku/discovery";
```

### Option 3: Custom Configuration

Use Effect implementations when creating a Waku node:

```typescript
import { createLightNode } from "@waku/sdk";
import { 
  enrTree,
  wakuDnsDiscoveryEffect,
  wakuPeerExchangeDiscoveryEffect 
} from "@waku/discovery";

const waku = await createLightNode({
  libp2p: {
    peerDiscovery: [
      // DNS Discovery with Effect
      wakuDnsDiscoveryEffect([enrTree["SANDBOX"]], {
        store: 3,
        lightPush: 3,
        filter: 3
      }),
      
      // Peer Exchange with Effect
      wakuPeerExchangeDiscoveryEffect(["/waku/2/rs/0/0"])
    ]
  }
});
```

## API Compatibility

### DNS Discovery

```typescript
// Original
import { wakuDnsDiscovery } from "@waku/discovery";
const dns = wakuDnsDiscovery(enrUrls, requirements);

// Effect-based (identical API)
import { wakuDnsDiscoveryEffect } from "@waku/discovery";
const dns = wakuDnsDiscoveryEffect(enrUrls, requirements);
```

### Peer Exchange Discovery

```typescript
// Original
import { wakuPeerExchangeDiscovery } from "@waku/discovery";
const px = wakuPeerExchangeDiscovery(pubsubTopics);

// Effect-based (identical API)
import { wakuPeerExchangeDiscoveryEffect } from "@waku/discovery";
const px = wakuPeerExchangeDiscoveryEffect(pubsubTopics);
```

### Local Peer Cache Discovery

```typescript
// Original
import { wakuLocalPeerCacheDiscovery } from "@waku/discovery";
const cache = wakuLocalPeerCacheDiscovery();

// Effect-based (identical API)
import { wakuLocalPeerCacheDiscoveryEffect } from "@waku/discovery";
const cache = wakuLocalPeerCacheDiscoveryEffect();
```

## Class-based Usage

For direct class instantiation:

```typescript
// Original classes
import { 
  PeerDiscoveryDns,
  PeerExchangeDiscovery,
  LocalPeerCacheDiscovery 
} from "@waku/discovery";

// Effect-based classes
import { 
  PeerDiscoveryDnsEffect,
  PeerExchangeDiscoveryEffect,
  LocalPeerCacheDiscoveryEffect 
} from "@waku/discovery";

// Usage is identical
const dns = new PeerDiscoveryDnsEffect(components, options);
await dns.start();
```

## Testing

To test both implementations side-by-side:

```typescript
describe("Discovery comparison", () => {
  it("should work with original implementation", async () => {
    const discovery = wakuDnsDiscovery(urls);
    // ... test
  });

  it("should work with Effect implementation", async () => {
    const discovery = wakuDnsDiscoveryEffect(urls);
    // ... test
  });
});
```

## Benefits of Migration

1. **Better Error Handling**
   ```typescript
   // Errors are typed and trackable
   import { DnsResolutionError, NetworkTimeoutError } from "@waku/discovery";
   ```

2. **Resource Safety**
   - Automatic cleanup of resources
   - No memory leaks from unclosed streams
   - Guaranteed cleanup on errors

3. **Improved Debugging**
   - Structured error types
   - Better stack traces
   - Traceable error origins

4. **Performance**
   - Optimized concurrent operations
   - Better backpressure handling
   - Efficient retry mechanisms

## Gradual Migration

You can migrate one discovery method at a time:

```typescript
const waku = await createLightNode({
  libp2p: {
    peerDiscovery: [
      // Use Effect for DNS
      wakuDnsDiscoveryEffect([enrTree["SANDBOX"]]),
      
      // Keep original for Peer Exchange
      wakuPeerExchangeDiscovery(["/waku/2/rs/0/0"])
    ]
  }
});
```

## Troubleshooting

### Issue: TypeScript errors with Effect
**Solution**: Ensure you have Effect installed:
```bash
npm install effect
```

### Issue: Node.js compatibility
**Solution**: The polyfill for `Promise.withResolvers` is automatically included for Node.js < 22.

### Issue: Different behavior
**Solution**: The Effect implementations maintain 100% API compatibility. If you notice differences, please report them.

## Support

- Report issues: https://github.com/waku-org/js-waku/issues
- Effect documentation: https://effect.website
- Waku documentation: https://docs.waku.org