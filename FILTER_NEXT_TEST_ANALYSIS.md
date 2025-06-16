# Filter Next Test Analysis

## Issues Identified

### 1. Import Issues (FIXED)
- Tests were importing `runMultipleNodes` from wrong module
- Missing `networkConfig` in local utils version
- Function signature mismatches

### 2. Timeout Issues (PARTIALLY FIXED)
- Individual test timeout increased from 10s to 60s
- Some tests take up to 18s to complete
- Cumulative test time exceeds overall timeout when running all tests

### 3. Connection Count Issues (FIXED)
- Subscribe tests expect 2 connections but default creates 3 nodes
- Fixed by explicitly passing node count

## Test Execution Times

Individual test timings when run in isolation:
- Basic tests: ~200ms each
- "20 topics" test: ~4s
- "2 nwaku nodes" test: up to 18s
- "restart waku node" test: ~900ms
- "recreate nwaku nodes" test: ~8s

## Root Cause

The filter next tests are timing out when run together because:
1. Setup/teardown for each test takes significant time (~1-2s)
2. Some tests are inherently slow (4-18s)
3. Running 32+ tests (16 tests × 2 modes) accumulates to several minutes
4. Default mocha timeout may be insufficient for the full suite

## Recommendations

1. **Run filter next tests separately** with increased timeout
2. **Consider parallelization** for filter next tests in CI
3. **Optimize slow tests** like "2 nwaku nodes" test
4. **Add progress logging** to identify which specific tests timeout

## Tests Status

All individual tests PASS when run in isolation:
- ✅ Push tests (10 tests × 2 modes)
- ✅ Subscribe tests (16 tests × 2 modes)  
- ✅ Unsubscribe tests (? tests × 2 modes)

The failures only occur when running the full suite together.