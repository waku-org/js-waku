import { Logger } from "../logger.js";

const log = new Logger("persistent-interval");

interface IntervalTask {
  id: string;
  callback: () => void;
  interval: number;
  lastRun: number;
  nextRun: number;
}

export class PersistentInterval {
  private static instance: PersistentInterval | null = null;
  private tasks: Map<string, IntervalTask> = new Map();
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly checkFrequency = 1000;
  private pageHiddenTime: number | null = null;
  private isBrowser: boolean;

  private constructor() {
    this.isBrowser =
      typeof document !== "undefined" && typeof window !== "undefined";

    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handlePageShow = this.handlePageShow.bind(this);
    this.handlePageHide = this.handlePageHide.bind(this);
    this.checkTasks = this.checkTasks.bind(this);

    if (this.isBrowser) {
      this.setupEventListeners();
    }
  }

  public static getInstance(): PersistentInterval {
    if (!PersistentInterval.instance) {
      PersistentInterval.instance = new PersistentInterval();
    }
    return PersistentInterval.instance;
  }

  public static setInterval(callback: () => void, interval: number): string {
    return PersistentInterval.getInstance().setInterval(callback, interval);
  }

  public static clearInterval(id: string): boolean {
    return PersistentInterval.getInstance().clearInterval(id);
  }

  public static clearAll(): void {
    PersistentInterval.getInstance().clearAll();
  }

  public static destroy(): void {
    if (PersistentInterval.instance) {
      PersistentInterval.instance.destroy();
      PersistentInterval.instance = null;
    }
  }

  private setupEventListeners(): void {
    if (this.isBrowser) {
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange
      );
      window.addEventListener("pagehide", this.handlePageHide);
      window.addEventListener("pageshow", this.handlePageShow);
    }
  }

  private handleVisibilityChange(): void {
    if (this.isBrowser && document.hidden) {
      this.onPageHidden();
    } else if (this.isBrowser) {
      this.onPageVisible();
    }
  }

  private handlePageHide(): void {
    this.onPageHidden();
  }

  private handlePageShow(): void {
    this.onPageVisible();
  }

  private onPageHidden(): void {
    if (!this.isBrowser) return;

    log.info("Page hidden, pausing task execution");
    this.pageHiddenTime = Date.now();
    this.pause();
  }

  private onPageVisible(): void {
    if (!this.isBrowser) return;

    log.info("Page visible, resuming task execution");
    this.resume();
    this.adjustTaskTimings();
  }

  private pause(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
  }

  private resume(): void {
    if (!this.isRunning && this.tasks.size > 0) {
      this.start();
    }
  }

  private start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.checkInterval = setInterval(this.checkTasks, this.checkFrequency);
    log.info("PersistentInterval started");
  }

  private adjustTaskTimings(): void {
    if (this.pageHiddenTime === null || !this.isBrowser) return;

    const now = Date.now();
    const hiddenDuration = now - this.pageHiddenTime;

    for (const task of this.tasks.values()) {
      const missedExecutions = Math.floor(hiddenDuration / task.interval);
      if (missedExecutions > 0) {
        task.nextRun = now + task.interval;
        log.info(
          `Adjusted task ${task.id} timing after ${hiddenDuration}ms hidden`
        );
      }
    }

    this.pageHiddenTime = null;
  }

  private checkTasks(): void {
    const now = Date.now();

    for (const task of this.tasks.values()) {
      if (now >= task.nextRun) {
        try {
          task.callback();
          task.lastRun = now;
          task.nextRun = now + task.interval;
        } catch (error) {
          log.error(`Error executing task ${task.id}:`, error);
        }
      }
    }
  }

  public setInterval(callback: () => void, interval: number): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const task: IntervalTask = {
      id,
      callback,
      interval,
      lastRun: now,
      nextRun: now + interval
    };

    this.tasks.set(id, task);

    if (!this.isRunning) {
      this.start();
    }

    log.info(`Task ${id} scheduled with interval ${interval}ms`);
    return id;
  }

  public clearInterval(id: string): boolean {
    const removed = this.tasks.delete(id);

    if (removed) {
      log.info(`Task ${id} cleared`);

      if (this.tasks.size === 0 && this.isRunning) {
        this.pause();
      }
    }

    return removed;
  }

  public clearAll(): void {
    this.tasks.clear();
    this.pause();
    log.info("All tasks cleared");
  }

  public getTaskCount(): number {
    return this.tasks.size;
  }

  public isTaskScheduled(id: string): boolean {
    return this.tasks.has(id);
  }

  public destroy(): void {
    this.clearAll();

    if (this.isBrowser) {
      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange
      );
      window.removeEventListener("pagehide", this.handlePageHide);
      window.removeEventListener("pageshow", this.handlePageShow);
    }

    log.info("PersistentInterval destroyed");
  }
}
