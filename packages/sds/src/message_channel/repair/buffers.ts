import { Logger } from "@waku/utils";
import _ from "lodash";

const log = new Logger("sds:repair:buffers");

/**
 * Extended HistoryEntry that includes sender_id for SDS-R
 */
export interface RepairHistoryEntry {
  messageId: string;
  retrievalHint?: Uint8Array;
  senderId?: string; // Original sender's ID for repair calculations
}

/**
 * Entry in the outgoing repair buffer with request timing
 */
interface OutgoingBufferEntry {
  entry: RepairHistoryEntry;
  tReq: number; // Timestamp when this repair request should be sent
}

/**
 * Entry in the incoming repair buffer with response timing
 */
interface IncomingBufferEntry {
  entry: RepairHistoryEntry;
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

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Add a missing message to the outgoing repair request buffer
   * If message already exists, it is not updated (keeps original T_req)
   */
  public add(entry: RepairHistoryEntry, tReq: number): void {
    const messageId = entry.messageId;
    
    // Check if already exists - do NOT update T_req per spec
    const existingIndex = this.items.findIndex(item => item.entry.messageId === messageId);
    if (existingIndex !== -1) {
      log.info(`Message ${messageId} already in outgoing buffer, keeping original T_req`);
      return;
    }

    // Check buffer size limit
    if (this.items.length >= this.maxSize) {
      // Evict oldest T_req entry (first in sorted array since we want to evict oldest)
      const evicted = this.items.shift()!;
      log.warn(`Buffer full, evicted oldest entry ${evicted.entry.messageId} with T_req ${evicted.tReq}`);
    }

    // Add new entry and re-sort
    const newEntry: OutgoingBufferEntry = { entry, tReq };
    const combined = [...this.items, newEntry];
    
    // Sort by T_req (ascending)
    combined.sort((a, b) => a.tReq - b.tReq);
    
    this.items = combined;
    log.info(`Added ${messageId} to outgoing buffer with T_req: ${tReq}`);
  }

  /**
   * Remove a message from the buffer (e.g., when received)
   */
  public remove(messageId: string): void {
    this.items = this.items.filter(item => item.entry.messageId !== messageId);
  }

  /**
   * Get eligible repair requests (where T_req <= currentTime)
   * Returns up to maxRequests entries from the front of the sorted array
   */
  public getEligible(currentTime: number, maxRequests = 3): RepairHistoryEntry[] {
    const eligible: RepairHistoryEntry[] = [];
    
    // Iterate from front of sorted array (earliest T_req first)
    for (const item of this.items) {
      if (item.tReq <= currentTime && eligible.length < maxRequests) {
        eligible.push(item.entry);
      } else if (item.tReq > currentTime) {
        // Since array is sorted, no more eligible entries
        break;
      }
    }
    
    return eligible;
  }

  /**
   * Check if a message is in the buffer
   */
  public has(messageId: string): boolean {
    return this.items.some(item => item.entry.messageId === messageId);
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
  public getAll(): RepairHistoryEntry[] {
    return this.items.map(item => item.entry);
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

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  /**
   * Add a repair request that we can fulfill
   * If message already exists, it is ignored (not updated)
   */
  public add(entry: RepairHistoryEntry, tResp: number): void {
    const messageId = entry.messageId;
    
    // Check if already exists - ignore per spec
    const existingIndex = this.items.findIndex(item => item.entry.messageId === messageId);
    if (existingIndex !== -1) {
      log.info(`Message ${messageId} already in incoming buffer, ignoring`);
      return;
    }

    // Check buffer size limit
    if (this.items.length >= this.maxSize) {
      // Evict furthest T_resp entry (last in sorted array)
      const evicted = this.items.pop()!;
      log.warn(`Buffer full, evicted furthest entry ${evicted.entry.messageId} with T_resp ${evicted.tResp}`);
    }

    // Add new entry and re-sort
    const newEntry: IncomingBufferEntry = { entry, tResp };
    const combined = [...this.items, newEntry];
    
    // Sort by T_resp (ascending)
    combined.sort((a, b) => a.tResp - b.tResp);
    
    this.items = combined;
    log.info(`Added ${messageId} to incoming buffer with T_resp: ${tResp}`);
  }

  /**
   * Remove a message from the buffer
   */
  public remove(messageId: string): void {
    this.items = this.items.filter(item => item.entry.messageId !== messageId);
  }

  /**
   * Get repairs ready to be sent (where T_resp <= currentTime)
   * Removes and returns ready entries
   */
  public getReady(currentTime: number): RepairHistoryEntry[] {
    const ready: RepairHistoryEntry[] = [];
    const remaining: IncomingBufferEntry[] = [];
    
    for (const item of this.items) {
      if (item.tResp <= currentTime) {
        ready.push(item.entry);
        log.info(`Repair for ${item.entry.messageId} is ready to be sent`);
      } else {
        // Since array is sorted, all remaining entries are not ready
        remaining.push(item);
      }
    }
    
    // Keep only non-ready entries
    this.items = remaining;
    
    return ready;
  }

  /**
   * Check if a message is in the buffer
   */
  public has(messageId: string): boolean {
    return this.items.some(item => item.entry.messageId === messageId);
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
  public getAll(): RepairHistoryEntry[] {
    return this.items.map(item => item.entry);
  }

  /**
   * Get items array directly (for testing)
   */
  public getItems(): IncomingBufferEntry[] {
    return [...this.items];
  }
}