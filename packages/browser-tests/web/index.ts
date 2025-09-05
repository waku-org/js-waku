import {
  createLightNode,
  LightNode,
  Protocols,
  NetworkConfig,
  CreateNodeOptions,
} from "@waku/sdk";
import { bootstrap } from "@libp2p/bootstrap";
import { EnrDecoder, TransportProtocol } from "@waku/enr";

export interface SerializableSDKProtocolResult {
  successes: string[];
  failures: Array<{
    error: string;
    peerId?: string;
  }>;
  [key: string]: any;
}

function makeSerializable(result: any): SerializableSDKProtocolResult {
  return {
    ...result,
    successes: result.successes.map((peerId: any) => peerId.toString()),
    failures: result.failures.map((failure: any) => ({
      error: failure.error || failure.toString(),
      peerId: failure.peerId ? failure.peerId.toString() : undefined
    }))
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
  constructor(networkConfig?: Partial<NetworkConfig>, lightpushNode?: string, enrBootstrap?: string) {
    this.waku = null as unknown as LightNode;
    // Use provided config or defaults
    this.networkConfig = this.buildNetworkConfig(networkConfig);
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
    const shouldUse = hasEnr && !isDefaultBootstrap;
    
    return shouldUse;
  }


  private async getBootstrapMultiaddrs(): Promise<string[]> {
    if (!this.enrBootstrap) {
      return [];
    }

    const enrList = this.enrBootstrap.split(',').map(enr => enr.trim());
    const allMultiaddrs: string[] = [];

    for (const enr of enrList) {
      const multiaddrs = await convertEnrToMultiaddrs(enr);
      if (multiaddrs.length > 0) {
        allMultiaddrs.push(...multiaddrs);
      }
    }

    return allMultiaddrs;
  }

  private buildNetworkConfig(providedConfig?: Partial<NetworkConfig>): NetworkConfig {
    const clusterId = providedConfig?.clusterId ?? 1;
    
    // Check if static sharding is requested through environment or config
    const staticShards = (providedConfig as any)?.shards;
    if (staticShards && Array.isArray(staticShards) && staticShards.length > 0) {
      return {
        clusterId,
        shards: staticShards
      } as NetworkConfig;
    }
    
    // Default to auto-sharding
    const numShardsInCluster = (providedConfig as any)?.numShardsInCluster ?? 8;
    return {
      clusterId,
      numShardsInCluster
    } as NetworkConfig;
  }


  async pushMessage(
    contentTopic: string,
    payload: string,
  ): Promise<SerializableSDKProtocolResult> {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }

    // Ensure payload is properly formatted
    let processedPayload: Uint8Array;
    // If it's a string, try to decode as base64 first
    try {
      // Use TextDecoder to decode base64 (browser-compatible)
      const binaryString = atob(payload);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      processedPayload = bytes;
    } catch (e) {
      // If base64 decoding fails, encode as UTF-8
      processedPayload = new TextEncoder().encode(payload);
    }

    try {
      const lightPush = this.waku.lightPush;
      if (!lightPush) {
        throw new Error("Lightpush service not available");
      }


      const encoder = this.waku.createEncoder({ contentTopic });

      const result = await lightPush.send(encoder, {
        payload: processedPayload,
        timestamp: new Date(),
      });

      // Convert to serializable format for cross-context communication
      const serializableResult = makeSerializable(result);

      return serializableResult;
    } catch (error) {
      console.error("Error sending message via lightpush:", error);
      throw new Error(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async pushMessageV3(
    contentTopic: string,
    payload: string,
  ): Promise<SerializableSDKProtocolResult> {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }

    // Ensure payload is properly formatted
    let processedPayload: Uint8Array;
    // If it's a string, try to decode as base64 first
    try {
      // Use TextDecoder to decode base64 (browser-compatible)
      const binaryString = atob(payload);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      processedPayload = bytes;
    } catch (e) {
      // If base64 decoding fails, encode as UTF-8
      processedPayload = new TextEncoder().encode(payload);
    }

    try {
      const lightPush = this.waku.lightPush;
      if (!lightPush) {
        throw new Error("Lightpush service not available");
      }


      const encoder = this.waku.createEncoder({ contentTopic });

      let result;
      if (this.lightpushNode) {
        try {
          const preferredPeerId = this.getPeerIdFromMultiaddr(this.lightpushNode);
          if (preferredPeerId) {
            result = await lightPush.send(encoder, {
              payload: processedPayload,
              timestamp: new Date(),
            });
            console.log("✅ Message sent via preferred lightpush node");
          } else {
            throw new Error("Could not extract peer ID from preferred node address");
          }
        } catch (error) {
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

      // Convert to serializable format for cross-context communication
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

      // Log connected peers
      const peers = this.waku.libp2p.getPeers();

      return {
        success: true,
        peersFound: peers.length,
        protocolsRequested: protocols,
        timeElapsed: elapsed
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

    if (options.networkConfig) {
      this.networkConfig = options.networkConfig;
    }


    let libp2pConfig: any = {
      ...options.libp2p,
      filterMultiaddrs: false,
      connectionManager: {
        minConnections: 1,
        maxConnections: 50,
        connectionGater: {
          denyDialPeer: () => false,
          denyDialMultiaddr: () => false,
          denyInboundConnection: () => false,
          denyOutboundConnection: () => false,
          denyInboundEncryptedConnection: () => false,
          denyOutboundEncryptedConnection: () => false,
          denyInboundUpgradedConnection: () => false,
          denyOutboundUpgradedConnection: () => false,
        },
      },
    };

    if (this.enrBootstrap && this.shouldUseCustomBootstrap(options)) {
      const multiaddrs = await this.getBootstrapMultiaddrs();
      
      if (multiaddrs.length > 0) {
        libp2pConfig.peerDiscovery = [
          bootstrap({ list: multiaddrs }),
          ...(options.libp2p?.peerDiscovery || [])
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
    }
  }

  private getPeerIdFromMultiaddr(multiaddr: string): string | null {
    const parts = multiaddr.split('/');
    const p2pIndex = parts.indexOf('p2p');
    return (p2pIndex !== -1 && p2pIndex + 1 < parts.length) ? parts[p2pIndex + 1] : null;
  }

  async stopNode() {
    if (!this.waku) {
      throw new Error("Waku node not created");
    }
    await this.waku.stop();
    return { success: true };
  }

  async dialPeers(peerAddrs: string[]) {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }

    const errors: string[] = [];
    await Promise.allSettled(
      (peerAddrs || []).map((addr) =>
        this.waku!.dial(addr).catch((err: any) =>
          errors.push(String(err?.message || err)),
        ),
      ),
    );
    return { total: (peerAddrs || []).length, errors };
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

  getDebugInfo() {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }

    return {
      listenAddresses: this.waku.libp2p
        .getMultiaddrs()
        .map((a: any) => a.toString()),
      peerId: this.waku.libp2p.peerId.toString(),
      protocols: Array.from(this.waku.libp2p.getProtocols()),
    };
  }

  getAvailablePeerProtocols() {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }

    try {
      const libp2p = this.waku.libp2p;
      const availableProtocols = new Set<string>();

        const ownProtocols = Array.from(libp2p.getProtocols());
      ownProtocols.forEach(p => availableProtocols.add(p));

        if (libp2p.components && libp2p.components.connectionManager) {
        const connections = libp2p.components.connectionManager.getConnections();
        connections.forEach((conn: any) => {
          console.log(`Peer ${conn.remotePeer.toString()} connected via ${conn.remoteAddr.toString()}`);
        });
      }

      return {
        ownProtocols: ownProtocols,
        availableProtocols: Array.from(availableProtocols),
        totalConnections: libp2p.components?.connectionManager?.getConnections().length || 0
      };
    } catch (error) {
      return {
        error: `Failed to get peer protocols: ${error instanceof Error ? error.message : String(error)}`,
        ownProtocols: this.waku.libp2p.getProtocols(),
        availableProtocols: [],
        totalConnections: 0
      };
    }
  }


  getPeerConnectionStatus() {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }

    try {
      const libp2p = this.waku.libp2p;

      const basicInfo: any = {
        peerId: libp2p.peerId.toString(),
        listenAddresses: libp2p.getMultiaddrs().map((a: any) => a.toString()),
        protocols: Array.from(libp2p.getProtocols()),
        networkConfig: this.networkConfig,
        libp2pKeys: Object.keys(libp2p),
        libp2pType: typeof libp2p,
      };

      try {
        if (libp2p.components && libp2p.components.connectionManager) {
          const connectionManager = libp2p.components.connectionManager;
          const connections = connectionManager.getConnections().map((conn: any) => ({
            remotePeer: conn.remotePeer.toString(),
            remoteAddr: conn.remoteAddr.toString(),
            status: conn.status,
          }));
          basicInfo.connections = connections;
        } else {
          basicInfo.connections = [];
          basicInfo.connectionError = `No connection manager found in components`;
        }
      } catch (connError) {
        basicInfo.connections = [];
        basicInfo.connectionError = `Connection manager error: ${connError instanceof Error ? connError.message : String(connError)}`;
      }

      try {
        if (typeof libp2p.getPeers === 'function') {
          const peers = libp2p.getPeers().map((peerId: any) => peerId.toString());
          basicInfo.peers = peers;
        } else {
          basicInfo.peers = [];
          basicInfo.peerError = `libp2p.getPeers is not a function`;
        }
      } catch (peerError) {
        basicInfo.peers = [];
        basicInfo.peerError = `Peer error: ${peerError instanceof Error ? peerError.message : String(peerError)}`;
      }

      try {
        if (libp2p.status) {
          basicInfo.isStarted = libp2p.status;
        } else {
          basicInfo.isStarted = 'unknown';
          basicInfo.startError = `No status property found`;
        }
      } catch (startError) {
        basicInfo.isStarted = 'error';
        basicInfo.startError = `Start check error: ${startError instanceof Error ? startError.message : String(startError)}`;
      }

      return basicInfo;
    } catch (error) {
      return {
        error: `Failed to get peer status: ${error instanceof Error ? error.message : String(error)}`,
        peerId: this.waku.libp2p.peerId.toString(),
        isStarted: 'unknown',
      };
    }
  }

}

(() => {
  try {
    console.log("Initializing WakuHeadless...");

    const globalNetworkConfig = (window as any).__WAKU_NETWORK_CONFIG;
    const globalLightpushNode = (window as any).__WAKU_LIGHTPUSH_NODE;
    const globalEnrBootstrap = (window as any).__WAKU_ENR_BOOTSTRAP;
    
    const instance = new WakuHeadless(globalNetworkConfig, globalLightpushNode, globalEnrBootstrap);

    (window as any).wakuApi = instance;
    console.log(
      "WakuHeadless initialized successfully:",
      !!(window as any).wakuApi,
    );
  } catch (error) {
    console.error("Error initializing WakuHeadless:", error);
    (window as any).wakuApi = {
      start: () =>
        Promise.reject(new Error("WakuHeadless failed to initialize")),
      error: error,
    };
  }
})();
