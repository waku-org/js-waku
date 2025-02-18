import type { PeerId } from "@libp2p/interface";
import type { CoreProtocolResult } from "@waku/interfaces";
import { Logger } from "@waku/utils";

import type { PeerManager } from "../peer_manager/index.js";

import { isPeerShouldBeChanged, timeout } from "./utils.js";

type RetryManagerConfig = {
  retryIntervalMs: number;
  peerManager: PeerManager;
};

type AttemptCallback = (peerId: PeerId) => Promise<CoreProtocolResult>;

type ScheduledAttempt = {
  maxAttempts: number;
  callback: AttemptCallback;
};

const MAX_CONCURRENT_TASKS = 5;
const TASK_TIMEOUT_MS = 10_000;

const log = new Logger("sdk:retry-manager");

export class RetryManager {
  private intervalID: number | null = null;
  private readonly retryIntervalMs: number;

  private inProgress: number = 0;
  private readonly queue: ScheduledAttempt[] = [];

  private readonly peerManager: PeerManager;

  public constructor(config: RetryManagerConfig) {
    this.peerManager = config.peerManager;
    this.retryIntervalMs = config.retryIntervalMs;
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

  public push(callback: AttemptCallback, maxAttempts: number): void {
    this.queue.push({
      maxAttempts,
      callback
    });
  }

  private processQueue(): void {
    if (this.queue.length === 0) {
      log.info("processQueue: queue is empty");
      return;
    }

    while (this.queue.length && this.inProgress < MAX_CONCURRENT_TASKS) {
      const task = this.queue.shift();

      if (task) {
        this.scheduleTask(task);
      }
    }
  }

  private scheduleTask(task: ScheduledAttempt): void {
    const delayedTask = async (): Promise<void> => {
      const peerId = this.peerManager.getPeers()[0];

      if (!peerId) {
        log.warn("scheduleTask: no peers, skipping");
        return;
      }

      try {
        this.inProgress += 1;

        const response = await Promise.race([
          timeout(TASK_TIMEOUT_MS),
          task.callback(peerId)
        ]);

        this.inProgress -= 1;

        if (response?.failure) {
          throw Error(response.failure.error);
        }

        log.info("scheduleTask: executed successfully");

        if (task.maxAttempts === 0) {
          log.warn(
            "scheduleTask: discarded a task due to limit of max attempts"
          );
          return;
        }

        this.queue.push(task);
      } catch (_err) {
        const error = _err as unknown as { message: string };

        log.error("scheduleTask: task execution failed with error:", error);

        if (isPeerShouldBeChanged(error.message)) {
          this.peerManager.requestRenew(peerId);
        }

        if (task.maxAttempts === 0) {
          log.warn(
            "scheduleTask: discarded a task due to limit of max attempts"
          );
          return;
        }

        this.queue.push({ ...task, maxAttempts: task.maxAttempts - 1 });
      } finally {
        this.inProgress -= 1;
      }
    };

    // schedule execution ASAP
    setTimeout(delayedTask as () => void, 100);
  }
}
