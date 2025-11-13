/**
 * Enables waiting a random time before doing an action (using `setTimeout`),
 * with possibility to apply a multiplier to manipulate said time.
 */
export class RandomTimeout {
  private timeout: ReturnType<typeof setTimeout> | undefined;

  public constructor(
    /**
     * The maximum interval one would wait before the call is made, in milliseconds.
     */
    private maxIntervalMs: number,
    /**
     * When not zero: Anytime a call is made, then a new call will be rescheduled
     * using this multiplier
     */
    private multiplierOnCall: number,
    /**
     * The function to call when the timer is reached
     */
    private callback: () => void | Promise<void>
  ) {}

  /**
   * Use to start the timer. If a timer was already set, it deletes it and
   * schedule a new one.
   * @param multiplier applied to [[maxIntervalMs]]
   */
  public restart(multiplier: number = 1): void {
    this.stop();

    if (this.maxIntervalMs) {
      const timeoutMs = Math.random() * this.maxIntervalMs * multiplier;

      this.timeout = setTimeout(() => {
        void this.callback();
        void this.restart(this.multiplierOnCall);
      }, timeoutMs);
    }
  }

  public stop(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }
}
