export class TTLSet<T> {
  /**
   * Creates a new CustomSet with TTL functionality.
   * @param ttlMs - The time-to-live in milliseconds for each entry.
   * @param cleanupIntervalMs - Optional interval between cleanup operations (default: 5000ms).
   */
  public constructor(ttlMs: number, cleanupIntervalMs: number = 5000) {
    this.ttlMs = ttlMs;
    this.startCleanupInterval(cleanupIntervalMs);
  }

  public dispose(): void {
    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    this.entryTimestamps.clear();
  }

  public add(entry: T): this {
    this.entryTimestamps.set(entry, Date.now());
    return this;
  }

  public has(entry: T): boolean {
    return this.entryTimestamps.has(entry);
  }

  private readonly ttlMs: number;
  private cleanupIntervalId: number | null = null;
  private readonly entryTimestamps = new Map<T, number>();

  private startCleanupInterval(intervalMs: number): void {
    this.cleanupIntervalId = setInterval(() => {
      this.removeExpiredEntries();
    }, intervalMs) as unknown as number;
  }

  private removeExpiredEntries(): void {
    const now = Date.now();
    for (const [entry, timestamp] of this.entryTimestamps.entries()) {
      if (now - timestamp > this.ttlMs) {
        this.entryTimestamps.delete(entry);
      }
    }
  }
}
