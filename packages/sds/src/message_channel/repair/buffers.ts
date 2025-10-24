import { Logger } from "@waku/utils";

import type { HistoryEntry } from "../message.js";

const log = new Logger("sds:repair:buffers");

/**
 * Entry in the outgoing repair buffer with request timing
 */
interface OutgoingBufferEntry {
  entry: HistoryEntry;
  tReq: number; // Timestamp when this repair request should be sent
  requested: boolean; // Whether this repair has already been requested by the local node
}

/**
 * Entry in the incoming repair buffer with response timing
 */
interface IncomingBufferEntry {
  entry: HistoryEntry;
  tResp: number; // Timestamp when we should respond with this repair
}

/**
 * Buffer for outgoing repair requests (messages we need)
 * Maintains a sorted array by T_req for efficient retrieval of eligible entries
 */
export class OutgoingRepairBuffer {
  // Sorted array by T_req (ascending - earliest first)
  private items: OutgoingBufferEntry[] = [];
  private readonly maxSize: number;

  public constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Add a missing message to the outgoing repair request buffer
   * If message already exists, it is not updated (keeps original T_req)
   * @returns true if the entry was added, false if it already existed
   */
  public add(entry: HistoryEntry, tReq: number): boolean {
    const messageId = entry.messageId;

    // Check if already exists - do NOT update T_req per spec
    if (this.has(messageId)) {
      log.info(
        `Message ${messageId} already in outgoing buffer, keeping original T_req`
      );
      return false;
    }

    // Check buffer size limit
    if (this.items.length >= this.maxSize) {
      // Evict furthest T_req entry (last in sorted array) to preserve repairs that need to be sent the soonest
      const evicted = this.items.pop()!;
      log.warn(
        `Buffer full, evicted furthest entry ${evicted.entry.messageId} with T_req ${evicted.tReq}`
      );
    }

    // Add new entry and re-sort
    const newEntry: OutgoingBufferEntry = { entry, tReq, requested: false };
    const combined = [...this.items, newEntry];

    // Sort by T_req (ascending)
    combined.sort((a, b) => a.tReq - b.tReq);

    this.items = combined;
    log.info(`Added ${messageId} to outgoing buffer with T_req: ${tReq}`);
    return true;
  }

  /**
   * Remove a message from the buffer (e.g., when received)
   */
  public remove(messageId: string): void {
    this.items = this.items.filter(
      (item) => item.entry.messageId !== messageId
    );
  }

  /**
   * Get eligible repair requests (where T_req <= currentTime)
   * Returns up to maxRequests entries from the front of the sorted array
   * Marks returned entries as requested but keeps them in buffer until received
   */
  public getEligible(
    currentTime: number = Date.now(),
    maxRequests = 3
  ): HistoryEntry[] {
    const eligible: HistoryEntry[] = [];

    // Iterate from front of sorted array (earliest T_req first)
    for (const item of this.items) {
      // Since array is sorted, once we hit an item with tReq > currentTime,
      // all remaining items also have tReq > currentTime
      if (item.tReq > currentTime) {
        break;
      }

      // Only return items that haven't been requested yet
      if (!item.requested && eligible.length < maxRequests) {
        eligible.push(item.entry);
        // Mark as requested so we don't request it again
        item.requested = true;
        log.info(
          `Repair request for ${item.entry.messageId} is eligible and marked as requested`
        );
      }

      // If we've found enough eligible items, exit early
      if (eligible.length >= maxRequests) {
        break;
      }
    }

    return eligible;
  }

  /**
   * Check if a message is in the buffer
   */
  public has(messageId: string): boolean {
    return this.items.some((item) => item.entry.messageId === messageId);
  }

  /**
   * Get the current buffer size
   */
  public get size(): number {
    return this.items.length;
  }

  /**
   * Clear all entries
   */
  public clear(): void {
    this.items = [];
  }

  /**
   * Get all entries (for testing/debugging)
   */
  public getAll(): HistoryEntry[] {
    return this.items.map((item) => item.entry);
  }

  /**
   * Get items array directly (for testing)
   */
  public getItems(): OutgoingBufferEntry[] {
    return [...this.items];
  }
}

/**
 * Buffer for incoming repair requests (repairs we need to send)
 * Maintains a sorted array by T_resp for efficient retrieval of ready entries
 */
export class IncomingRepairBuffer {
  // Sorted array by T_resp (ascending - earliest first)
  private items: IncomingBufferEntry[] = [];
  private readonly maxSize: number;

  public constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Add a repair request that we can fulfill
   * If message already exists, it is ignored (not updated)
   * @returns true if the entry was added, false if it already existed
   */
  public add(entry: HistoryEntry, tResp: number): boolean {
    const messageId = entry.messageId;

    // Check if already exists - ignore per spec
    if (this.has(messageId)) {
      log.info(`Message ${messageId} already in incoming buffer, ignoring`);
      return false;
    }

    // Check buffer size limit
    if (this.items.length >= this.maxSize) {
      // Evict furthest T_resp entry (last in sorted array)
      const evicted = this.items.pop()!;
      log.warn(
        `Buffer full, evicted furthest entry ${evicted.entry.messageId} with T_resp ${evicted.tResp}`
      );
    }

    // Add new entry and re-sort
    const newEntry: IncomingBufferEntry = { entry, tResp };
    const combined = [...this.items, newEntry];

    // Sort by T_resp (ascending)
    combined.sort((a, b) => a.tResp - b.tResp);

    this.items = combined;
    log.info(`Added ${messageId} to incoming buffer with T_resp: ${tResp}`);
    return true;
  }

  /**
   * Remove a message from the buffer
   */
  public remove(messageId: string): void {
    this.items = this.items.filter(
      (item) => item.entry.messageId !== messageId
    );
  }

  /**
   * Get repairs ready to be sent (where T_resp <= currentTime)
   * Removes and returns ready entries
   */
  public getReady(currentTime: number): HistoryEntry[] {
    // Find cutoff point - first item with tResp > currentTime
    // Since array is sorted, all items before this are ready
    let cutoff = 0;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].tResp > currentTime) {
        cutoff = i;
        break;
      }
      // If we reach the end, all items are ready
      cutoff = i + 1;
    }

    // Extract ready items and log them
    const ready = this.items.slice(0, cutoff).map((item) => {
      log.info(`Repair for ${item.entry.messageId} is ready to be sent`);
      return item.entry;
    });

    // Keep only items after cutoff
    this.items = this.items.slice(cutoff);

    return ready;
  }

  /**
   * Check if a message is in the buffer
   */
  public has(messageId: string): boolean {
    return this.items.some((item) => item.entry.messageId === messageId);
  }

  /**
   * Get the current buffer size
   */
  public get size(): number {
    return this.items.length;
  }

  /**
   * Clear all entries
   */
  public clear(): void {
    this.items = [];
  }

  /**
   * Get all entries (for testing/debugging)
   */
  public getAll(): HistoryEntry[] {
    return this.items.map((item) => item.entry);
  }

  /**
   * Get items array directly (for testing)
   */
  public getItems(): IncomingBufferEntry[] {
    return [...this.items];
  }
}
