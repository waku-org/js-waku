/* eslint-disable no-console */
import { createEncoder } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { createLightNode, Protocols } from "@waku/sdk";
import { createRoutingInfo } from "@waku/utils";

declare global {
  interface Window {
    wakuBrowser: WakuBrowser;
  }
}

class WakuBrowser {
  private waku: LightNode | null = null;

  public async createAndStartNode(config: {
    bootstrapPeers: string[];
    networkConfig: { clusterId: number; numShardsInCluster: number };
  }): Promise<{ success: boolean }> {
    console.log("Creating light node...");
    this.waku = await createLightNode({
      defaultBootstrap: false,
      bootstrapPeers: config.bootstrapPeers,
      networkConfig: config.networkConfig,
      libp2p: {
        filterMultiaddrs: false
      }
    });

    console.log("Starting node...");
    await this.waku.start();

    console.log("Connecting to bootstrap peers...");
    for (const peer of config.bootstrapPeers) {
      await this.waku.dial(peer);
    }

    console.log("Waiting for peers...");
    await this.waku.waitForPeers([Protocols.LightPush]);

    const peers = this.waku.libp2p.getPeers();
    console.log(`Connected to ${peers.length} peers`);

    return { success: true };
  }

  public async sendLightPushMessage(
    contentTopic: string,
    message: string
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
  }> {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }

    const networkConfig = {
      clusterId: 0,
      numShardsInCluster: 8
    };

    const routingInfo = createRoutingInfo(networkConfig, { contentTopic });
    const encoder = createEncoder({ contentTopic, routingInfo });

    const result = await this.waku.lightPush.send(encoder, {
      payload: new TextEncoder().encode(message)
    });

    return {
      success: result.successes.length > 0,
      successCount: result.successes.length,
      failureCount: result.failures?.length || 0
    };
  }

  public async stop(): Promise<{ success: boolean }> {
    if (this.waku) {
      await this.waku.stop();
      this.waku = null;
    }
    return { success: true };
  }
}

// Expose to window
window.wakuBrowser = new WakuBrowser();
console.log("WakuBrowser initialized");
