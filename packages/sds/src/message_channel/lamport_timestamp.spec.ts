import { expect } from "chai";

import { lamportTimestampIncrement } from "./message_channel.js";

describe("lamportTimestampIncrement", () => {
  it("should increment timestamp by 1 when current time is not greater", () => {
    const futureTimestamp = BigInt(Date.now()) + 1000n;
    const result = lamportTimestampIncrement(futureTimestamp);
    expect(result).to.equal(futureTimestamp + 1n);
  });

  it("should use current time when it's greater than incremented timestamp", () => {
    const pastTimestamp = BigInt(Date.now()) - 1000n;
    const result = lamportTimestampIncrement(pastTimestamp);
    const now = BigInt(Date.now());
    // Result should be at least as large as now (within small tolerance for test execution time)
    expect(result >= now - 10n).to.be.true;
    expect(result <= now + 10n).to.be.true;
  });

  it("should handle timestamp equal to current time", () => {
    const currentTimestamp = BigInt(Date.now());
    const result = lamportTimestampIncrement(currentTimestamp);
    // Should increment by 1 since now is likely not greater than current + 1
    expect(result >= currentTimestamp + 1n).to.be.true;
  });

  it("should ensure monotonic increase", () => {
    let timestamp = BigInt(Date.now()) + 5000n;
    const results: bigint[] = [];

    for (let i = 0; i < 5; i++) {
      timestamp = lamportTimestampIncrement(timestamp);
      results.push(timestamp);
    }

    // Verify all timestamps are strictly increasing
    for (let i = 1; i < results.length; i++) {
      expect(results[i] > results[i - 1]).to.be.true;
    }
  });

  it("should handle very large timestamps", () => {
    const largeTimestamp = BigInt(Number.MAX_SAFE_INTEGER) * 1000n;
    const result = lamportTimestampIncrement(largeTimestamp);
    expect(result).to.equal(largeTimestamp + 1n);
  });

  it("should jump to current time when timestamp is far in the past", () => {
    const veryOldTimestamp = 1000n; // Very old timestamp (1 second after epoch)
    const result = lamportTimestampIncrement(veryOldTimestamp);
    const now = BigInt(Date.now());
    expect(result >= now - 10n).to.be.true;
    expect(result <= now + 10n).to.be.true;
  });
});
