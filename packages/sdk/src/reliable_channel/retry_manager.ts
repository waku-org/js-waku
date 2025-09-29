export class RetryManager {
  private timeouts: Map<string, ReturnType<typeof setTimeout>>;

  public constructor(
    // TODO: back-off strategy
    private retryIntervalMs: number,
    private maxRetryNumber: number
  ) {
    this.timeouts = new Map();

    if (
      !retryIntervalMs ||
      retryIntervalMs <= 0 ||
      !maxRetryNumber ||
      maxRetryNumber <= 0
    ) {
      throw Error(
        `Invalid retryIntervalMs ${retryIntervalMs} or maxRetryNumber ${maxRetryNumber} values`
      );
    }
  }

  public stopRetries(id: string): void {
    const timeout = this.timeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  public startRetries(id: string, retry: () => void | Promise<void>): void {
    this.retry(id, retry, 0);
  }

  private retry(
    id: string,
    retry: () => void | Promise<void>,
    attemptNumber: number
  ): void {
    clearTimeout(this.timeouts.get(id));
    if (attemptNumber < this.maxRetryNumber) {
      const interval = setTimeout(() => {
        void retry();

        // Register for next retry until we are told to stop;
        this.retry(id, retry, ++attemptNumber);
      }, this.retryIntervalMs);

      this.timeouts.set(id, interval);
    }
  }
}
