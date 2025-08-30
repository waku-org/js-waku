import { Logger } from "@waku/utils";

import { Message } from "../message.js";

import {
  IncomingRepairBuffer,
  OutgoingRepairBuffer,
  RepairHistoryEntry
} from "./buffers.js";
import {
  bigintToNumber,
  calculateXorDistance,
  combinedHash,
  hashString,
  ParticipantId
} from "./utils.js";

const log = new Logger("sds:repair:manager");

/**
 * Configuration for SDS-R repair protocol
 */
export interface RepairConfig {
  /** Minimum wait time before requesting repair (milliseconds) */
  tMin?: number;
  /** Maximum wait time for repair window (milliseconds) */
  tMax?: number;
  /** Number of response groups for load distribution */
  numResponseGroups?: number;
  /** Maximum buffer size for repair requests */
  bufferSize?: number;
  /** Whether repair is enabled */
  enabled?: boolean;
}

/**
 * Default configuration values based on spec recommendations
 */
export const DEFAULT_REPAIR_CONFIG: Required<RepairConfig> = {
  tMin: 30000, // 30 seconds
  tMax: 120000, // 120 seconds
  numResponseGroups: 1, // Recommendation is 1 group per 128 participants
  bufferSize: 1000,
  enabled: true
};

/**
 * Manager for SDS-R repair protocol
 * Handles repair request/response timing and coordination
 */
export class RepairManager {
  private readonly participantId: ParticipantId;
  private readonly config: Required<RepairConfig>;
  private readonly outgoingBuffer: OutgoingRepairBuffer;
  private readonly incomingBuffer: IncomingRepairBuffer;

  constructor(participantId: ParticipantId, config: RepairConfig = {}) {
    this.participantId = participantId;
    this.config = { ...DEFAULT_REPAIR_CONFIG, ...config };
    
    this.outgoingBuffer = new OutgoingRepairBuffer(this.config.bufferSize);
    this.incomingBuffer = new IncomingRepairBuffer(this.config.bufferSize);
    
    log.info(`RepairManager initialized for participant ${participantId}`);
  }

  /**
   * Calculate T_req - when to request repair for a missing message
   * Per spec (with bug fix): T_req = current_time + hash(participant_id, message_id) % (T_max - T_min) + T_min
   */
  public calculateTReq(messageId: string, currentTime = Date.now()): number {
    const hash = combinedHash(this.participantId, messageId);
    const range = BigInt(this.config.tMax - this.config.tMin);
    const offset = bigintToNumber(hash % range) + this.config.tMin;
    return currentTime + offset;
  }

  /**
   * Calculate T_resp - when to respond with a repair
   * Per spec: T_resp = current_time + (distance * hash(message_id)) % T_max
   * where distance = participant_id XOR sender_id
   */
  public calculateTResp(
    senderId: ParticipantId,
    messageId: string,
    currentTime = Date.now()
  ): number {
    const distance = calculateXorDistance(this.participantId, senderId);
    const messageHash = hashString(messageId);
    const product = distance * messageHash;
    const offset = bigintToNumber(product % BigInt(this.config.tMax));
    return currentTime + offset;
  }

  /**
   * Determine if this participant is in the response group for a message
   * Per spec: (hash(participant_id, message_id) % num_response_groups) == 
   *           (hash(sender_id, message_id) % num_response_groups)
   */
  public isInResponseGroup(
    senderId: ParticipantId,
    messageId: string
  ): boolean {
    if (!senderId) {
      // Cannot determine response group without sender_id
      return false;
    }

    const numGroups = BigInt(this.config.numResponseGroups);
    if (numGroups <= 1n) {
      // Single group, everyone is in it
      return true;
    }

    const participantGroup = combinedHash(this.participantId, messageId) % numGroups;
    const senderGroup = combinedHash(senderId, messageId) % numGroups;
    
    return participantGroup === senderGroup;
  }

  /**
   * Handle missing dependencies by adding them to outgoing repair buffer
   * Called when causal dependencies are detected as missing
   */
  public onMissingDependencies(
    missingEntries: RepairHistoryEntry[],
    currentTime = Date.now()
  ): void {
    if (!this.config.enabled) {
      return;
    }

    for (const entry of missingEntries) {
      // Calculate when to request this repair
      const tReq = this.calculateTReq(entry.messageId, currentTime);
      
      // Add to outgoing buffer
      this.outgoingBuffer.add(entry, tReq);
      
      log.info(
        `Added missing dependency ${entry.messageId} to repair buffer with T_req=${tReq}`
      );
    }
  }

  /**
   * Handle receipt of a message - remove from repair buffers
   * Called when a message is successfully received
   */
  public onMessageReceived(messageId: string): void {
    // Remove from both buffers as we no longer need to request or respond
    this.outgoingBuffer.remove(messageId);
    this.incomingBuffer.remove(messageId);
    
    log.info(`Removed ${messageId} from repair buffers after receipt`);
  }

  /**
   * Get repair requests that are eligible to be sent
   * Returns up to maxRequests entries where T_req <= currentTime
   */
  public getRepairRequests(
    maxRequests = 3,
    currentTime = Date.now()
  ): RepairHistoryEntry[] {
    if (!this.config.enabled) {
      return [];
    }

    return this.outgoingBuffer.getEligible(currentTime, maxRequests);
  }

  /**
   * Process incoming repair requests from other participants
   * Adds to incoming buffer if we can fulfill and are in response group
   */
  public processIncomingRepairRequests(
    requests: RepairHistoryEntry[],
    localHistory: Map<string, Message>,
    currentTime = Date.now()
  ): void {
    if (!this.config.enabled) {
      return;
    }

    for (const request of requests) {
      // Remove from our own outgoing buffer (someone else is requesting it)
      this.outgoingBuffer.remove(request.messageId);
      
      // Check if we have this message
      if (!localHistory.has(request.messageId)) {
        log.info(`Cannot fulfill repair for ${request.messageId} - not in local history`);
        continue;
      }

      // Check if we're in the response group
      if (!request.senderId) {
        log.warn(`Cannot determine response group for ${request.messageId} - missing sender_id`);
        continue;
      }

      if (!this.isInResponseGroup(request.senderId, request.messageId)) {
        log.info(`Not in response group for ${request.messageId}`);
        continue;
      }

      // Calculate when to respond
      const tResp = this.calculateTResp(request.senderId, request.messageId, currentTime);
      
      // Add to incoming buffer
      this.incomingBuffer.add(request, tResp);
      
      log.info(
        `Will respond to repair request for ${request.messageId} at T_resp=${tResp}`
      );
    }
  }

  /**
   * Sweep outgoing buffer for repairs that should be requested
   * Returns entries where T_req <= currentTime
   */
  public sweepOutgoingBuffer(
    maxRequests = 3,
    currentTime = Date.now()
  ): RepairHistoryEntry[] {
    if (!this.config.enabled) {
      return [];
    }

    return this.getRepairRequests(maxRequests, currentTime);
  }

  /**
   * Sweep incoming buffer for repairs ready to be sent
   * Returns messages that should be rebroadcast
   */
  public sweepIncomingBuffer(
    localHistory: Map<string, Message>,
    currentTime = Date.now()
  ): Message[] {
    if (!this.config.enabled) {
      return [];
    }

    const ready = this.incomingBuffer.getReady(currentTime);
    const messages: Message[] = [];

    for (const entry of ready) {
      const message = localHistory.get(entry.messageId);
      if (message) {
        messages.push(message);
        log.info(`Sending repair for ${entry.messageId}`);
      } else {
        log.warn(`Message ${entry.messageId} no longer in local history`);
      }
    }

    return messages;
  }

  /**
   * Clear all buffers
   */
  public clear(): void {
    this.outgoingBuffer.clear();
    this.incomingBuffer.clear();
  }

  /**
   * Check if repair is enabled
   */
  public get isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update number of response groups (e.g., when participants change)
   */
  public updateResponseGroups(numParticipants: number): void {
    // Per spec: num_response_groups = max(1, num_participants / 128)
    this.config.numResponseGroups = Math.max(1, Math.floor(numParticipants / 128));
    log.info(`Updated response groups to ${this.config.numResponseGroups} for ${numParticipants} participants`);
  }
}