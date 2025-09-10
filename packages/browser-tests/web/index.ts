import {
  createLightNode,
  LightNode,
  Protocols,
  NetworkConfig,
  CreateNodeOptions,
} from "@waku/sdk";
import { DEFAULT_CLUSTER_ID, DEFAULT_NUM_SHARDS } from "@waku/interfaces";
import { bootstrap } from "@libp2p/bootstrap";
import { EnrDecoder, TransportProtocol } from "@waku/enr";
import type { ITestBrowser } from "../types/global.js";

export interface SerializableSDKProtocolResult {
  successes: string[];
  failures: Array<{
    error: string;
    peerId?: string;
  }>;
  myPeerId?: string;
}

function makeSerializable(result: any): SerializableSDKProtocolResult {
  return {
    ...result,
    successes: result.successes.map((peerId: any) => peerId.toString()),
    failures: result.failures.map((failure: any) => ({
      error: failure.error || failure.toString(),
      peerId: failure.peerId ? failure.peerId.toString() : undefined,
    })),
  };
}

async function convertEnrToMultiaddrs(enrString: string): Promise<string[]> {
  try {
    const enr = await EnrDecoder.fromString(enrString);
    const allMultiaddrs = enr.getAllLocationMultiaddrs();
    const multiaddrs: string[] = [];

    for (const multiaddr of allMultiaddrs) {
      const maStr = multiaddr.toString();
      multiaddrs.push(maStr);
    }
    if (multiaddrs.length === 0) {
      const tcpMultiaddr = enr.getFullMultiaddr(TransportProtocol.TCP);
      if (tcpMultiaddr) {
        const tcpStr = tcpMultiaddr.toString();
        multiaddrs.push(tcpStr);
      }
      const udpMultiaddr = enr.getFullMultiaddr(TransportProtocol.UDP);
      if (udpMultiaddr) {
        const udpStr = udpMultiaddr.toString();
        multiaddrs.push(udpStr);
      }
    }

    return multiaddrs;
  } catch (error) {
    return [];
  }
}

export class WakuHeadless {
  waku: LightNode | null;
  networkConfig: NetworkConfig;
  lightpushNode: string | null;
  enrBootstrap: string | null;
  constructor(
    networkConfig?: Partial<NetworkConfig>,
    lightpushNode?: string | null,
    enrBootstrap?: string | null,
  ) {
    this.waku = null as unknown as LightNode;
    this.networkConfig = this.buildNetworkConfig(networkConfig);
    console.log("Network config on construction:", this.networkConfig);
    this.lightpushNode = lightpushNode || null;
    this.enrBootstrap = enrBootstrap || null;

    if (this.lightpushNode) {
      console.log(`Configured preferred lightpush node: ${this.lightpushNode}`);
    }
    if (this.enrBootstrap) {
      console.log(`Configured ENR bootstrap: ${this.enrBootstrap}`);
    }
  }

  private shouldUseCustomBootstrap(options: CreateNodeOptions): boolean {
    const hasEnr = Boolean(this.enrBootstrap);
    const isDefaultBootstrap = Boolean(options.defaultBootstrap);

    return hasEnr && !isDefaultBootstrap;
  }

  private async getBootstrapMultiaddrs(): Promise<string[]> {
    if (!this.enrBootstrap) {
      return [];
    }

    const enrList = this.enrBootstrap.split(",").map((enr) => enr.trim());
    const allMultiaddrs: string[] = [];

    for (const enr of enrList) {
      const multiaddrs = await convertEnrToMultiaddrs(enr);
      if (multiaddrs.length > 0) {
        allMultiaddrs.push(...multiaddrs);
      }
    }

    return allMultiaddrs;
  }

  private buildNetworkConfig(
    providedConfig?: Partial<NetworkConfig>,
  ): NetworkConfig {
    const clusterId = providedConfig?.clusterId ?? DEFAULT_CLUSTER_ID;

    const staticShards = (providedConfig as any)?.shards;
    if (
      staticShards &&
      Array.isArray(staticShards) &&
      staticShards.length > 0
    ) {
      return {
        clusterId,
        shards: staticShards,
      } as NetworkConfig;
    }

    const numShardsInCluster =
      (providedConfig as any)?.numShardsInCluster ?? DEFAULT_NUM_SHARDS;
    return {
      clusterId,
      numShardsInCluster,
    } as NetworkConfig;
  }

  async pushMessageV3(
    contentTopic: string,
    payload: string,
    pubsubTopic: string,
  ): Promise<SerializableSDKProtocolResult> {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }
    console.log("Pushing message via v3 lightpush:", contentTopic, payload, pubsubTopic);
    console.log("Waku node:", this.waku);
    console.log("Network config:", this.networkConfig);

    let processedPayload: Uint8Array;
    try {
      const binaryString = atob(payload);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      processedPayload = bytes;
    } catch (e) {
      processedPayload = new TextEncoder().encode(payload);
    }

    try {
      const lightPush = this.waku.lightPush;
      if (!lightPush) {
        throw new Error("Lightpush service not available");
      }

      const encoder = this.waku.createEncoder({ contentTopic });
      console.log("Encoder:", encoder);
      console.log("Pubsub topic:", pubsubTopic);
      console.log("Encoder pubsub topic:", encoder.pubsubTopic);

      if (pubsubTopic && pubsubTopic !== encoder.pubsubTopic) {
        console.warn(
          `Explicit pubsubTopic ${pubsubTopic} provided, but auto-sharding determined ${encoder.pubsubTopic}. Using auto-sharding.`,
        );
      }

      let result;
      if (this.lightpushNode) {
        try {
          const preferredPeerId = this.getPeerIdFromMultiaddr(
            this.lightpushNode,
          );
          if (preferredPeerId) {
            result = await lightPush.send(encoder, {
              payload: processedPayload,
              timestamp: new Date(),
            });
            console.log("✅ Message sent via preferred lightpush node");
          } else {
            throw new Error(
              "Could not extract peer ID from preferred node address",
            );
          }
        } catch (error) {
          console.error("Couldn't send message via preferred lightpush node:", error);
          result = await lightPush.send(encoder, {
            payload: processedPayload,
            timestamp: new Date(),
          });
        }
      } else {
        result = await lightPush.send(encoder, {
          payload: processedPayload,
          timestamp: new Date(),
        });
      }

      const serializableResult = makeSerializable(result);

      return serializableResult;
    } catch (error) {
      console.error("Error sending message via v3 lightpush:", error);
      throw new Error(
        `Failed to send v3 message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async waitForPeers(
    timeoutMs: number = 10000,
    protocols: Protocols[] = [Protocols.LightPush, Protocols.Filter],
  ) {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }

    const startTime = Date.now();

    try {
      await this.waku.waitForPeers(protocols, timeoutMs);
      const elapsed = Date.now() - startTime;

      const peers = this.waku.libp2p.getPeers();

      return {
        success: true,
        peersFound: peers.length,
        protocolsRequested: protocols,
        timeElapsed: elapsed,
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`Failed to find peers after ${elapsed}ms:`, error);
      throw error;
    }
  }

  async createWakuNode(options: CreateNodeOptions) {
    try {
      if (this.waku) {
        await this.waku.stop();
      }
    } catch (e) {
      console.warn("ignore previous waku stop error");
    }

    // if (options.networkConfig) {
    //   this.networkConfig = options.networkConfig;
    //   console.log("Network config on createWakuNode:", this.networkConfig);
    // }

    let libp2pConfig: any = {
      ...options.libp2p,
      filterMultiaddrs: false,
    };

    if (this.enrBootstrap && this.shouldUseCustomBootstrap(options)) {
      const multiaddrs = await this.getBootstrapMultiaddrs();

      if (multiaddrs.length > 0) {
        libp2pConfig.peerDiscovery = [
          bootstrap({ list: multiaddrs }),
          ...(options.libp2p?.peerDiscovery || []),
        ];
      }
    }

    const createOptions = {
      ...options,
      networkConfig: this.networkConfig,
      libp2p: libp2pConfig,
    };

    this.waku = await createLightNode(createOptions);
    return { success: true };
  }

  async startNode() {
    if (!this.waku) {
      throw new Error("Waku node not created");
    }
    await this.waku.start();

    if (this.lightpushNode) {
      await this.dialPreferredLightpushNode();
    }

    return { success: true };
  }

  private async dialPreferredLightpushNode() {
    if (!this.waku || !this.lightpushNode) {
      return;
    }

    try {
      await this.waku.dial(this.lightpushNode);
    } catch {
      // Ignore dial errors
      console.warn("Failed to dial preferred lightpush node:", this.lightpushNode);
    }
  }

  private getPeerIdFromMultiaddr(multiaddr: string): string | null {
    const parts = multiaddr.split("/");
    const p2pIndex = parts.indexOf("p2p");
    return p2pIndex !== -1 && p2pIndex + 1 < parts.length
      ? parts[p2pIndex + 1]
      : null;
  }

  async stopNode() {
    if (!this.waku) {
      throw new Error("Waku node not created");
    }
    await this.waku.stop();
    return { success: true };
  }

  getPeerInfo() {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }

    const addrs = this.waku.libp2p.getMultiaddrs();
    return {
      peerId: this.waku.libp2p.peerId.toString(),
      multiaddrs: addrs.map((a: any) => a.toString()),
      peers: [],
    };
  }
}

(() => {
  try {
    console.log("Initializing WakuHeadless...");

    const testWindow = window as ITestBrowser;
    const globalNetworkConfig = testWindow.__WAKU_NETWORK_CONFIG;
    const globalLightpushNode = testWindow.__WAKU_LIGHTPUSH_NODE;
    const globalEnrBootstrap = testWindow.__WAKU_ENR_BOOTSTRAP;

    const instance = new WakuHeadless(
      globalNetworkConfig,
      globalLightpushNode,
      globalEnrBootstrap,
    );

    testWindow.wakuApi = instance;
    console.log("WakuHeadless initialized successfully:", !!testWindow.wakuApi);
  } catch (error) {
    console.error("Error initializing WakuHeadless:", error);
    const testWindow = window as ITestBrowser;
    testWindow.wakuApi = {
      start: () =>
        Promise.reject(new Error("WakuHeadless failed to initialize")),
      error: error,
    } as any;
  }
})();
