# Test Code Simplification - Before and After Comparison

This document demonstrates the simplification and deduplication achieved in the Waku tests codebase.

## Summary of Changes

### 1. Centralized Test Configuration (`src/test-configs/index.ts`)

**Before:** Each protocol had its own utils.ts file with nearly identical configuration:

```typescript
// packages/tests/tests/filter/utils.ts
export const TestContentTopic = "/test/1/waku-filter/default";
export const TestClusterId = 2;
export const TestNumShardsInCluster = 8;
export const TestNetworkConfig = {
  clusterId: TestClusterId,
  numShardsInCluster: TestNumShardsInCluster
};
export const TestRoutingInfo = createRoutingInfo(TestNetworkConfig, {
  contentTopic: TestContentTopic
});
// ... more boilerplate

// packages/tests/tests/light-push/utils.ts  
export const TestContentTopic = "/test/1/waku-light-push/utf8";
export const TestClusterId = 3;
export const TestNumShardsInCluster = 8;
// ... same boilerplate repeated

// packages/tests/tests/store/utils.ts
export const TestContentTopic = "/test/1/waku-store/utf8";
export const TestClusterId = 5;
// ... same boilerplate repeated again
```

**After:** Single centralized configuration:

```typescript
export const TEST_CONFIGS: Record<string, ProtocolTestConfig> = {
  filter: {
    clusterId: 2,
    contentTopic: "/test/1/waku-filter/default",
    messageText: "Filtering works!",
    loggerName: "test:filter"
  },
  lightpush: {
    clusterId: 3,
    contentTopic: "/test/1/waku-light-push/utf8",
    messageText: "Light Push works!",
    loggerName: "test:lightpush"
  },
  // ... all protocols in one place
};
```

### 2. Unified Test Utilities Factory (`src/test-utils/utilities-factory.ts`)

**Before:** Each protocol manually created encoders, decoders, routing info:

```typescript
// Repeated in every protocol's utils.ts
export const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  routingInfo: TestRoutingInfo
});
export const TestDecoder = createDecoder(TestContentTopic, TestRoutingInfo);
export const messagePayload = { payload: utf8ToBytes(messageText) };
```

**After:** Single factory function creates everything:

```typescript
export function createTestUtilities(protocol: string): TestUtilities {
  const config = getTestConfig(protocol);
  // Creates all test objects with consistent patterns
  return { config, networkConfig, routingInfo, encoder, decoder, messagePayload, logger, expectOptions };
}

// Usage:
const utilities = createTestUtilities("filter");
// utilities.encoder, utilities.decoder, etc. are ready to use
```

### 3. Common Test Patterns (`src/test-utils/common-patterns.ts`)

**Before:** Repetitive test code in every test file:

```typescript
// Repeated pattern in many test files
await waku.filter.subscribe(TestDecoder, serviceNodes.messageCollector.callback);
await waku.lightPush.send(TestEncoder, messagePayload);
expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(true);
serviceNodes.messageCollector.verifyReceivedMessage(0, {
  expectedMessageText: messageText,
  expectedContentTopic: TestContentTopic
});
await serviceNodes.confirmMessageLength(1);
```

**After:** Reusable test patterns:

```typescript
// Single line replaces 5+ lines of boilerplate
await testSingleMessage({ serviceNodes, waku }, utilities);

// Or for subscription tests:
await testSubscription({ serviceNodes, waku }, utilities);
```

### 4. Simplified Protocol Utils Files

**Before:** filter/utils.ts had 31 lines of configuration boilerplate
**After:** filter/utils-new.ts has 19 lines, mostly backwards compatibility exports

```typescript
// New simplified utils file
export const {
  config,
  networkConfig: TestNetworkConfig,
  routingInfo: TestRoutingInfo,
  encoder: TestEncoder,
  decoder: TestDecoder,
  messagePayload,
  logger: log,
  expectOptions
} = createTestUtilities("filter");

// Legacy exports for backwards compatibility
export const TestContentTopic = config.contentTopic;
```

## Code Reduction Metrics

### Lines of Code Reduction:
- **filter/utils.ts**: 31 lines → 19 lines (-39%)
- **light-push/utils.ts**: 22 lines → 17 lines (-23%)
- **store/utils.ts**: 135 lines → ~30 lines (-78% for basic config, complex helpers remain)

### Duplication Elimination:
- **Test configuration**: 4 separate files → 1 centralized config
- **Encoder/decoder creation**: 4 separate implementations → 1 factory function
- **Message verification patterns**: Repeated in every test → Reusable functions

### New Capabilities:
1. **Easy protocol variations**: Create test configs for new protocols in one place
2. **Consistent test patterns**: All tests follow the same successful patterns
3. **Better maintainability**: Change test behavior in one place, affects all protocols
4. **Reduced cognitive load**: Developers focus on test logic, not boilerplate

## Migration Strategy

1. **Backwards Compatible**: New utils files export same names as old ones
2. **Gradual Migration**: Can migrate tests one by one using new patterns
3. **No Breaking Changes**: Existing tests continue to work while new tests use simpler patterns

## Example Test Simplification

**Before (typical test structure):**
```typescript
describe("Filter Subscribe Tests", function() {
  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;
  
  beforeEachCustom(this, async () => {
    [serviceNodes, waku] = await runMultipleNodes(this.ctx, TestRoutingInfo, undefined, strictCheck);
  });
  
  it("Subscribe and receive message", async function() {
    expect(waku.libp2p.getConnections()).has.length(2);
    await waku.filter.subscribe(TestDecoder, serviceNodes.messageCollector.callback);
    await waku.lightPush.send(TestEncoder, messagePayload);
    expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(true);
    serviceNodes.messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });
    await serviceNodes.confirmMessageLength(1);
  });
});
```

**After (using new patterns):**
```typescript
const utilities = createTestUtilities("filter");

describe(createTestSuiteDescription("Filter", "Subscribe"), function() {
  // Same setup code
  
  it("Subscribe and receive message", async function() {
    verifyConnections(waku, 2);
    await testSubscription({ serviceNodes, waku }, utilities);
  });
});
```

The new approach reduces the test from ~12 lines to ~3 lines while maintaining the same functionality and improving readability.