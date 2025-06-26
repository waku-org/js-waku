import type { PeerId } from "@libp2p/interface";
import { LightPushCodecV2 } from "@waku/core";
import { LightPushCodecV3 } from "@waku/interfaces";

export interface LightPushV3ResponseCapture {
  peerId: string;
  protocolUsed: string;
  requestId?: string;
  statusCode?: number;
  statusDesc?: string;
  relayPeerCount?: number;
  timestamp: number;
}

export class LightPushV3TestCollector {
  private responses: LightPushV3ResponseCapture[] = [];
  private static instance?: LightPushV3TestCollector;

  public static getInstance(): LightPushV3TestCollector {
    if (!LightPushV3TestCollector.instance) {
      LightPushV3TestCollector.instance = new LightPushV3TestCollector();
    }
    return LightPushV3TestCollector.instance;
  }

  public captureResponse(response: {
    peerId: PeerId;
    protocolUsed?: string;
    requestId?: string;
    statusCode?: number;
    statusDesc?: string;
    relayPeerCount?: number;
  }): void {
    this.responses.push({
      peerId: response.peerId.toString(),
      protocolUsed: response.protocolUsed || "unknown",
      requestId: response.requestId,
      statusCode: response.statusCode,
      statusDesc: response.statusDesc,
      relayPeerCount: response.relayPeerCount,
      timestamp: Date.now()
    });
  }

  public getResponses(): LightPushV3ResponseCapture[] {
    return [...this.responses];
  }

  public getV3Responses(): LightPushV3ResponseCapture[] {
    return this.responses.filter((r) => r.protocolUsed === LightPushCodecV3);
  }

  public getV2Responses(): LightPushV3ResponseCapture[] {
    return this.responses.filter((r) => r.protocolUsed === LightPushCodecV2);
  }

  public getResponsesForPeer(peerId: string): LightPushV3ResponseCapture[] {
    return this.responses.filter((r) => r.peerId === peerId);
  }

  public getSuccessfulResponses(): LightPushV3ResponseCapture[] {
    return this.responses.filter((r) => r.statusCode === 200);
  }

  public getErrorResponses(): LightPushV3ResponseCapture[] {
    return this.responses.filter(
      (r) => r.statusCode !== 200 && r.statusCode !== undefined
    );
  }

  public clear(): void {
    this.responses = [];
  }

  public getStatistics(): {
    total: number;
    v3Count: number;
    v2Count: number;
    successCount: number;
    errorCount: number;
    averageRelayPeerCount?: number;
  } {
    const v3Responses = this.getV3Responses();
    const v2Responses = this.getV2Responses();
    const successResponses = this.getSuccessfulResponses();
    const errorResponses = this.getErrorResponses();

    const relayPeerCounts = this.responses
      .map((r) => r.relayPeerCount)
      .filter((count): count is number => count !== undefined);

    const averageRelayPeerCount =
      relayPeerCounts.length > 0
        ? relayPeerCounts.reduce((sum, count) => sum + count, 0) /
          relayPeerCounts.length
        : undefined;

    return {
      total: this.responses.length,
      v3Count: v3Responses.length,
      v2Count: v2Responses.length,
      successCount: successResponses.length,
      errorCount: errorResponses.length,
      averageRelayPeerCount
    };
  }
}

export function isValidUUID(uuid: string | undefined): boolean {
  if (!uuid) return false;
  if (uuid === "N/A") return true;

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

export function expectV3Features(response: LightPushV3ResponseCapture): void {
  // V3-specific validations
  if (response.protocolUsed === LightPushCodecV3) {
    // Request ID should be valid UUID or "N/A"
    if (response.requestId) {
      const isValid = isValidUUID(response.requestId);
      if (!isValid) {
        throw new Error(`Invalid request ID format: ${response.requestId}`);
      }
    }

    // Status code should be present and valid HTTP-style
    if (response.statusCode !== undefined) {
      if (response.statusCode < 200 || response.statusCode >= 600) {
        throw new Error(`Invalid status code: ${response.statusCode}`);
      }
    }

    // Relay peer count should be non-negative if present
    if (response.relayPeerCount !== undefined) {
      if (response.relayPeerCount < 0) {
        throw new Error(`Invalid relay peer count: ${response.relayPeerCount}`);
      }
    }
  }
}
