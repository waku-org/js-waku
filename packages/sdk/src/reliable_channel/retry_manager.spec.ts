import { delay } from "@waku/utils";
import { expect } from "chai";

import { RetryManager } from "./retry_manager.js";

describe("Retry Manager", () => {
  it("Retries within given interval", async function () {
    const retryManager = new RetryManager(100, 1);

    let retryCount = 0;
    retryManager.startRetries("1", () => {
      retryCount++;
    });

    await delay(110);

    expect(retryCount).to.equal(1);
  });

  it("Retries within maximum given attempts", async function () {
    const maxAttempts = 5;
    const retryManager = new RetryManager(10, maxAttempts);

    let retryCount = 0;
    retryManager.startRetries("1", () => {
      retryCount++;
    });

    await delay(200);

    expect(retryCount).to.equal(maxAttempts);
  });

  it("Wait given interval before re-trying", async function () {
    const retryManager = new RetryManager(100, 1);

    let retryCount = 0;
    retryManager.startRetries("1", () => {
      retryCount++;
    });

    await delay(90);
    expect(retryCount).to.equal(0);

    await delay(110);
    expect(retryCount).to.equal(1);
  });
});
