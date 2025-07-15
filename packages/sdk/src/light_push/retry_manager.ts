import type { PeerId } from "@libp2p/interface";
import { type LightPushCoreResult, Protocols } from "@waku/interfaces";
import { Logger } from "@waku/utils";

import type { PeerManager } from "../peer_manager/index.js";

import { shouldPeerBeChanged, timeout } from "./utils.js";

type RetryManagerConfig = {
  retryIntervalMs: number;
  peerManager: PeerManager;
};

type AttemptCallback = (peerId: PeerId) => Promise<LightPushCoreResult>;

export type ScheduledTask = {
  maxAttempts: number;
  pubsubTopic: string;
  callback: AttemptCallback;
};

const MAX_CONCURRENT_TASKS = 5;
const TASK_TIMEOUT_MS = 10_000;

const log = new Logger("sdk:retry-manager");

export class RetryManager {
  private intervalID: number | null = null;
  private readonly retryIntervalMs: number;

  private inProgress: number = 0;
  private readonly queue: ScheduledTask[] = [];

  private readonly peerManager: PeerManager;

  public constructor(config: RetryManagerConfig) {
    this.peerManager = config.peerManager;
    this.retryIntervalMs = config.retryIntervalMs || 1000;
  }

  public start(): void {
    this.intervalID = setInterval(() => {
      this.processQueue();
    }, this.retryIntervalMs) as unknown as number;
  }

  public stop(): void {
    if (this.intervalID) {
      clearInterval(this.intervalID);
      this.intervalID = null;
    }
  }

  public push(
    callback: AttemptCallback,
    maxAttempts: number,
    pubsubTopic: string
  ): void {
    this.queue.push({
      maxAttempts,
      callback,
      pubsubTopic
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0) {
      return;
    }

    while (this.queue.length && this.inProgress < MAX_CONCURRENT_TASKS) {
      const task = this.queue.shift();

      if (task) {
        this.scheduleTask(task);
      }
    }
  }

  private scheduleTask(task: ScheduledTask): void {
    const delayedTask = async (): Promise<void> => {
      return this.taskExecutor(task);
    };

    // schedule execution ASAP
    // need to use setTimeout to avoid blocking main execution
    setTimeout(delayedTask as () => void, 100);
  }

  private async taskExecutor(task: ScheduledTask): Promise<void> {
    if (task.maxAttempts <= 0) {
      log.warn("scheduleTask: max attempts has reached, removing from queue");
      return;
    }

    const peerId = (
      await this.peerManager.getPeers({
        protocol: Protocols.LightPush,
        pubsubTopic: task.pubsubTopic
      })
    )[0];

    if (!peerId) {
      log.warn("scheduleTask: no peers, putting back to queue");

      this.queue.push({
        ...task,
        maxAttempts: task.maxAttempts - 1
      });

      return;
    }

    try {
      this.inProgress += 1;

      const response = await Promise.race([
        timeout(TASK_TIMEOUT_MS),
        task.callback(peerId)
      ]);

      // If timeout resolves first, response will be void (undefined)
      // In this case, we should treat it as a timeout error
      if (response === undefined) {
        throw new Error("Task timeout");
      }

      if (response.failure) {
        throw Error(response.failure.error);
      }

      log.info("scheduleTask: executed successfully");

      if (task.maxAttempts === 0) {
        log.warn("scheduleTask: discarded a task due to limit of max attempts");
        return;
      }

      this.queue.push({
        ...task,
        maxAttempts: task.maxAttempts - 1
      });
    } catch (_err) {
      const error = _err as unknown as { message: string };

      log.error("scheduleTask: task execution failed with error:", error);

      if (shouldPeerBeChanged(error.message)) {
        await this.peerManager.renewPeer(peerId, {
          protocol: Protocols.LightPush,
          pubsubTopic: task.pubsubTopic
        });
      }

      if (task.maxAttempts === 0) {
        log.warn("scheduleTask: discarded a task due to limit of max attempts");
        return;
      }

      this.queue.push({
        ...task,
        maxAttempts: task.maxAttempts - 1
      });
    } finally {
      this.inProgress -= 1;
    }
  }
}
