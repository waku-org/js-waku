import type { PeerId } from "@libp2p/interface";
import { type CoreProtocolResult, ProtocolError } from "@waku/interfaces";
import { expect } from "chai";
import sinon from "sinon";

import { PeerManager } from "../peer_manager/index.js";

import { RetryManager, ScheduledTask } from "./retry_manager.js";

describe("RetryManager", () => {
  let retryManager: RetryManager;
  let peerManager: PeerManager;
  let mockPeerId: PeerId;
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    mockPeerId = { toString: () => "test-peer-id" } as PeerId;
    peerManager = {
      getPeers: () => [mockPeerId],
      requestRenew: sinon.spy(),
      start: sinon.spy(),
      stop: sinon.spy()
    } as unknown as PeerManager;

    retryManager = new RetryManager({
      peerManager,
      retryIntervalMs: 100
    });
  });

  afterEach(() => {
    clock.restore();
    retryManager.stop();
    sinon.restore();
  });

  it("should start and stop interval correctly", () => {
    const setIntervalSpy = sinon.spy(global, "setInterval");
    const clearIntervalSpy = sinon.spy(global, "clearInterval");

    retryManager.start();
    expect(setIntervalSpy.calledOnce).to.be.true;

    retryManager.stop();
    expect(clearIntervalSpy.calledOnce).to.be.true;
  });

  it("should process tasks in queue", async () => {
    const successCallback = sinon.spy(
      async (peerId: PeerId): Promise<CoreProtocolResult> => ({
        success: peerId,
        failure: null
      })
    );

    retryManager.push(successCallback, 3);
    retryManager.start();

    clock.tick(1000);

    expect(successCallback.calledOnce, "called").to.be.true;
    expect(successCallback.calledWith(mockPeerId), "called with peer").to.be
      .true;
  });

  it("should retry failed tasks", async () => {
    const failingCallback = sinon.spy(
      async (): Promise<CoreProtocolResult> => ({
        success: null,
        failure: { error: "test error" as any }
      })
    );

    const queue = (retryManager as any)["queue"] as ScheduledTask[];

    const task = { callback: failingCallback, maxAttempts: 2 };
    await (retryManager as any)["taskExecutor"](task);

    expect(failingCallback.calledOnce, "executed callback").to.be.true;
    expect(
      queue.some((t) => t.maxAttempts === 1),
      "task attempt decreased"
    ).to.be.true;
  });

  it("should request peer renewal on specific errors", async () => {
    const errorCallback = sinon.spy(async (): Promise<CoreProtocolResult> => {
      throw new Error(ProtocolError.NO_PEER_AVAILABLE);
    });

    await (retryManager as any)["taskExecutor"]({
      callback: errorCallback,
      maxAttempts: 1
    });

    expect((peerManager.requestRenew as sinon.SinonSpy).calledOnce).to.be.true;
    expect((peerManager.requestRenew as sinon.SinonSpy).calledWith(mockPeerId))
      .to.be.true;
  });

  it("should handle task timeouts", async () => {
    const slowCallback = sinon.spy(async (): Promise<CoreProtocolResult> => {
      await new Promise((resolve) => setTimeout(resolve, 15000));
      return { success: mockPeerId, failure: null };
    });

    const task = { callback: slowCallback, maxAttempts: 1 };
    const executionPromise = (retryManager as any)["taskExecutor"](task);

    clock.tick(11000);
    await executionPromise;

    expect(slowCallback.calledOnce).to.be.true;
  });

  it("should respect max attempts limit", async () => {
    const failingCallback = sinon.spy(async (): Promise<CoreProtocolResult> => {
      throw new Error("test error" as any);
    });

    const task = { callback: failingCallback, maxAttempts: 0 };
    await (retryManager as any)["taskExecutor"](task);

    expect(failingCallback.calledOnce).to.be.true;
    expect(task.maxAttempts).to.equal(0);
  });
});
