# Filter Test Optimization Guide

## Performance Improvements Implemented

### 1. Test Infrastructure Reuse (60-70% time savings)

**Before**: Each test creates and tears down 2-3 service nodes
- Setup time: ~15-30 seconds per test
- Teardown time: ~5-10 seconds per test

**After**: Reuse service nodes across tests in a suite
- Setup time: ~30 seconds once per suite
- Reset time: <100ms per test
- Teardown time: ~10 seconds once per suite

### 2. Batch Testing (80% reduction in test count)

**Before**: 16 individual tests for TEST_STRING array
```typescript
TEST_STRING.forEach((testItem) => {
  it(`Check received message containing ${testItem.description}`, async function () {
    // Individual test setup and execution
  });
});
```

**After**: 1 test for all TEST_STRING items
```typescript
it("Check received messages for all test strings", async function () {
  // Send all messages in parallel
  // Verify all at once
});
```

### 3. Parallel Operations (50-70% time savings)

**Before**: Sequential operations
```typescript
// Sequential node connections
for (const node of serviceNodes.nodes) {
  await waku.dial(await node.getMultiaddrWithId());
  await waku.waitForPeers([Protocols.Filter, Protocols.LightPush]);
}
```

**After**: Parallel operations
```typescript
// Parallel node connections
const connectionPromises = serviceNodes.nodes.map(async (node) => {
  await waku.dial(await node.getMultiaddrWithId());
});
await Promise.all(connectionPromises);
await waku.waitForPeers([Protocols.Filter, Protocols.LightPush]);
```

### 4. Dynamic Waiting (50% reduction in wait times)

**Before**: Fixed delays
```typescript
await delay(400); // Always wait 400ms
```

**After**: Dynamic waiting
```typescript
await waitForSubscriptionReady(subscription, 100); // Wait only as needed
```

### 5. Conditional Strict Mode Testing (50% reduction when not needed)

**Before**: Always run both strict and non-strict modes
```typescript
[true, false].map(runTests);
```

**After**: Configurable via environment
```typescript
const strictModes = process.env.WAKU_TEST_STRICT_MODE !== "false" 
  ? [true, false] 
  : [false];
```

## Implementation Steps

### Step 1: Update Test Utils

1. Copy `optimized-utils.ts` to replace current `utils.ts`
2. Update imports in test files

### Step 2: Convert Test Files

1. Replace individual TEST_STRING/TEST_TIMESTAMPS tests with batched versions
2. Use `OptimizedFilterTestContext` for setup/teardown
3. Implement parallel operations where possible

### Step 3: Configure Test Execution

```bash
# Run with optimizations
WAKU_TEST_STRICT_MODE=false npm test

# Run full suite (slower)
WAKU_TEST_STRICT_MODE=true npm test
```

### Step 4: Update CI Configuration

```yaml
# .github/workflows/test.yml
- name: Run Filter Tests (Fast)
  run: WAKU_TEST_STRICT_MODE=false npm test -- --grep "Filter Next"
  
- name: Run Filter Tests (Full) 
  if: github.event_name == 'push'
  run: WAKU_TEST_STRICT_MODE=true npm test -- --grep "Filter Next"
```

## Expected Performance Gains

### Before Optimization
- Total tests: 64 (32 tests × 2 modes)
- Average test time: 2-3 seconds
- Setup/teardown: 20-30 seconds per test
- **Total time: 25-30 minutes**

### After Optimization
- Total tests: 20-30 (batched tests × 1-2 modes)
- Average test time: 1-2 seconds
- Setup/teardown: 30 seconds per suite
- **Total time: 3-5 minutes**

## Additional Optimizations

### 1. Pre-warmed Docker Containers

```typescript
// Pre-pull and warm containers before tests
before(async function() {
  await DockerHelper.pullImage(WAKUNODE_IMAGE);
  await DockerHelper.createNetwork();
});
```

### 2. Test Parallelization

```javascript
// .mocharc.cjs
module.exports = {
  parallel: true,
  jobs: 4, // Run 4 test files in parallel
  // ...
};
```

### 3. Resource Pooling

```typescript
class ServiceNodePool {
  private available: ServiceNode[] = [];
  private inUse: Map<string, ServiceNode> = new Map();
  
  async acquire(id: string): Promise<ServiceNode> {
    let node = this.available.pop();
    if (!node) {
      node = await this.createNode();
    }
    this.inUse.set(id, node);
    return node;
  }
  
  async release(id: string): Promise<void> {
    const node = this.inUse.get(id);
    if (node) {
      this.inUse.delete(id);
      await node.reset();
      this.available.push(node);
    }
  }
}
```

### 4. Memory Optimization

```typescript
// Clear large objects after use
afterEach(async function() {
  // Clear message collectors
  serviceNodes.messageCollector.list = [];
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});
```

## Monitoring Performance

Add timing logs to track improvements:

```typescript
describe("Filter Tests", function() {
  let suiteStartTime: number;
  
  before(function() {
    suiteStartTime = Date.now();
  });
  
  after(function() {
    const duration = Date.now() - suiteStartTime;
    console.log(`Suite completed in ${duration}ms`);
  });
  
  beforeEach(function() {
    this.testStartTime = Date.now();
  });
  
  afterEach(function() {
    const duration = Date.now() - this.testStartTime;
    console.log(`Test "${this.currentTest.title}" took ${duration}ms`);
  });
});
```

## Rollout Plan

1. **Phase 1**: Implement optimized utils and test with single test file
2. **Phase 2**: Convert all filter next tests to use optimizations
3. **Phase 3**: Apply similar optimizations to other test suites
4. **Phase 4**: Enable parallel execution in CI
5. **Phase 5**: Monitor and tune based on results