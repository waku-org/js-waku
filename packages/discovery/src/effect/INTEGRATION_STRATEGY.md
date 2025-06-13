# Effect Implementation Integration Strategy

## Goal
Keep the Effect implementation alongside the original code with minimal changes to the existing codebase.

## Approach

### 1. Separate Exports (Recommended) ✅
Create a separate export path for Effect-based implementations:

```typescript
// Main exports (unchanged)
export { DnsDiscovery } from "./dns/dns_discovery.js"
export { PeerExchangeDiscovery } from "./peer-exchange/waku_peer_exchange_discovery.js"
export { LocalPeerCacheDiscovery } from "./local-peer-cache/index.js"

// Effect exports (new)
export { PeerDiscoveryDnsEffect } from "./effect/wrappers/dns-discovery-wrapper.js"
export { PeerExchangeDiscoveryEffect } from "./effect/wrappers/peer-exchange-wrapper.js"
export { LocalPeerCacheDiscoveryEffect } from "./effect/wrappers/cache-discovery-wrapper.js"
```

**Benefits:**
- No breaking changes
- Users can opt-in to Effect implementations
- Easy to test both implementations side-by-side
- Gradual migration path

**Usage:**
```typescript
// Original (unchanged)
import { DnsDiscovery } from "@waku/discovery"

// Effect-based (opt-in)
import { PeerDiscoveryDnsEffect } from "@waku/discovery"
```

### 2. Package.json Exports (Alternative)
Use package.json exports field for separate entry points:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./effect": {
      "types": "./dist/effect/index.d.ts",
      "import": "./dist/effect/index.js"
    }
  }
}
```

**Usage:**
```typescript
// Original
import { DnsDiscovery } from "@waku/discovery"

// Effect-based
import { DnsDiscovery } from "@waku/discovery/effect"
```

### 3. Build Configuration
Update build to handle Effect files:

1. **TypeScript**: Already configured with `downlevelIteration: true`
2. **Bundle**: Effect code will be included in main bundle
3. **Tests**: Create separate test files for Effect implementations

### 4. Documentation Strategy

1. **README Update**: Add section about Effect implementations
2. **Migration Guide**: Document how to switch from original to Effect
3. **API Docs**: Clearly mark Effect exports as experimental/opt-in

### 5. CI/CD Strategy

1. **Parallel Testing**: Test both implementations
2. **Performance Benchmarks**: Compare original vs Effect
3. **Compatibility Tests**: Ensure wrappers work as drop-in replacements

## Implementation Steps

1. **Update src/index.ts** ✅
   - Add Effect wrapper exports
   - Keep original exports unchanged

2. **Update Package.json** (Optional)
   - Add Effect-specific export path
   - Update version to indicate new features

3. **Add Documentation**
   - Update README with Effect section
   - Create migration guide
   - Add examples

4. **Update CI**
   - Add Effect-specific tests
   - Add compatibility checks
   - Add performance benchmarks

## Minimal Changes Required

1. **src/index.ts**: Add 3 new export lines
2. **tsconfig.json**: Add `downlevelIteration: true` ✅
3. **README.md**: Add Effect section
4. **CI**: Add Effect test job

Total files changed: 4 (excluding Effect implementation files)

## Conclusion

The Effect implementation can coexist with the original code with minimal changes. Users can opt-in to Effect-based implementations while maintaining full backward compatibility. This approach allows for gradual migration and real-world testing before any potential full transition.