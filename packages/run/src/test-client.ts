import { createEncoder } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { createRoutingInfo } from "@waku/utils";

import {
  DEFAULT_NODE1_WS_PORT,
  DEFAULT_NODE2_WS_PORT,
  NODE1_PEER_ID,
  NODE2_PEER_ID
} from "./constants.js";

export interface WakuTestClientOptions {
  node1Port?: string;
  node2Port?: string;
  clusterId?: number;
  numShardsInCluster?: number;
  contentTopic?: string;
}

export interface TestResult {
  success: boolean;
  connectedPeers: number;
  messagesSent: number;
  failures: number;
  error?: string;
}

export class WakuTestClient {
  public waku: LightNode | null = null;
  private options: Required<WakuTestClientOptions>;

  public constructor(options: WakuTestClientOptions = {}) {
    this.options = {
      node1Port:
        options.node1Port || process.env.NODE1_WS_PORT || DEFAULT_NODE1_WS_PORT,
      node2Port:
        options.node2Port || process.env.NODE2_WS_PORT || DEFAULT_NODE2_WS_PORT,
      clusterId: options.clusterId ?? 0,
      numShardsInCluster: options.numShardsInCluster ?? 8,
      contentTopic: options.contentTopic || "/waku-run/1/test/proto"
    };
  }

  /**
   * Create and start the Waku light node
   */
  public async start(): Promise<void> {
    const { node1Port, node2Port, clusterId, numShardsInCluster } =
      this.options;

    const networkConfig = {
      clusterId,
      numShardsInCluster
    };

    this.waku = await createLightNode({
      defaultBootstrap: false,
      bootstrapPeers: [
        `/ip4/127.0.0.1/tcp/${node1Port}/ws/p2p/${NODE1_PEER_ID}`,
        `/ip4/127.0.0.1/tcp/${node2Port}/ws/p2p/${NODE2_PEER_ID}`
      ],
      networkConfig,
      numPeersToUse: 2,
      libp2p: {
        filterMultiaddrs: false
      }
    });

    await this.waku.start();
  }

  /**
   * Send a test message via lightpush
   */
  public async sendTestMessage(
    payload: string = "Hello Waku!"
  ): Promise<TestResult> {
    if (!this.waku) {
      throw new Error("Waku node not started. Call start() first.");
    }

    try {
      const { contentTopic, clusterId, numShardsInCluster } = this.options;
      const networkConfig = { clusterId, numShardsInCluster };

      const routingInfo = createRoutingInfo(networkConfig, { contentTopic });
      const encoder = createEncoder({ contentTopic, routingInfo });

      const result = await this.waku.lightPush.send(encoder, {
        payload: new TextEncoder().encode(payload)
      });

      const connectedPeers = this.waku.libp2p.getPeers().length;

      return {
        success:
          result.successes.length > 0 && (result.failures?.length || 0) === 0,
        connectedPeers,
        messagesSent: result.successes.length,
        failures: result.failures?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        connectedPeers: this.waku.libp2p.getPeers().length,
        messagesSent: 0,
        failures: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Stop the Waku node
   */
  public async stop(): Promise<void> {
    if (this.waku) {
      await this.waku.stop();
      this.waku = null;
    }
  }
}
