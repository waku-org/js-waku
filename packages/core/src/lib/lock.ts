export class Lock<T = void> {
  private locks: Map<string, Promise<any>> = new Map();

  async withLock(peerId: string, work: () => Promise<T>): Promise<T> {
    let resolveLock: () => void;
    const lock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    const previousLock = this.locks.get(peerId) || Promise.resolve();
    await previousLock;

    this.locks.set(peerId, lock);

    try {
      return await work();
    } finally {
      resolveLock!();
      this.locks.delete(peerId);
    }
  }
}
