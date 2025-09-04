// @ts-nocheck
import {
  createLightNode,
  LightNode,
  Protocols,
  NetworkConfig,
  SDKProtocolResult,
  CreateNodeOptions,
} from "@waku/sdk";
import type { PeerId } from "@libp2p/interface";

/**
 * Enhanced SDKProtocolResult with serializable peer IDs for browser/Node.js communication
 */
export interface SerializableSDKProtocolResult {
  successes: string[]; // Converted PeerId objects to strings
  failures: Array<{
    error: string;
    peerId?: string; // Converted PeerId to string if available
  }>;
  [key: string]: any; // Allow for other SDK result properties
}

/**
 * Convert SDKProtocolResult to a serializable format for browser/Node.js communication
 */
function makeSerializable(result: SDKProtocolResult): SerializableSDKProtocolResult {
  return {
    ...result,
    successes: result.successes.map((peerId: PeerId) => peerId.toString()),
    failures: result.failures.map((failure: any) => ({
      error: failure.error || failure.toString(),
      peerId: failure.peerId ? failure.peerId.toString() : undefined
    }))
  };
}

export class WakuHeadless {
  waku: LightNode | null;
  networkConfig: NetworkConfig;
  lightpushNode: string | null;
  constructor(networkConfig?: Partial<NetworkConfig>, lightpushNode?: string) {
    this.waku = null as unknown as LightNode;
    // Use provided config or defaults
    this.networkConfig = this.buildNetworkConfig(networkConfig);
    this.lightpushNode = lightpushNode || null;
    
    if (this.lightpushNode) {
      console.log(`Configured preferred lightpush node: ${this.lightpushNode}`);
    }
  }

  /**
   * Build network configuration from provided config or defaults
   */
  private buildNetworkConfig(providedConfig?: Partial<NetworkConfig>): NetworkConfig {
    // Default configuration
    let config: NetworkConfig = {
      clusterId: 1,
      numShardsInCluster: 8  // Enable auto-sharding by default
    };

    // Apply provided configuration
    if (providedConfig) {
      config.clusterId = providedConfig.clusterId ?? config.clusterId;

      // If specific shards are provided, use static sharding
      if (providedConfig.shards && providedConfig.shards.length > 0) {
        config.shards = providedConfig.shards;
        delete config.numShardsInCluster; // Remove auto-sharding when using static shards
        console.log(`Using static sharding with shard(s) ${providedConfig.shards.join(', ')} on cluster ${config.clusterId}`);
      } else if (providedConfig.numShardsInCluster) {
        config.numShardsInCluster = providedConfig.numShardsInCluster;
        console.log(`Using auto-sharding with ${config.numShardsInCluster} shards on cluster ${config.clusterId}`);
      } else {
        console.log(`Using auto-sharding with ${config.numShardsInCluster} shards on cluster ${config.clusterId}`);
      }
    } else {
      console.log(`Using default auto-sharding with ${config.numShardsInCluster} shards on cluster ${config.clusterId}`);
    }

    return config;
  }

  /**
   * Create and start a Waku light node with default bootstrap
   * Optionally override the network config
   * @param networkConfig
   */
  async start() {
    this.waku = await createLightNode({
      defaultBootstrap: true,
      networkConfig: this.networkConfig,
    });
    await this.waku?.start();
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

      console.log(`Preparing to send message with contentTopic: ${contentTopic}`);
      console.log(`Using network config:`, this.networkConfig);

      // Use the WakuNode's createEncoder method which handles auto-sharding properly
      const encoder = this.waku.createEncoder({ contentTopic });

      console.log("Encoder created with pubsubTopic:", encoder.pubsubTopic);
      // Send the message using lightpush
      const result = await lightPush.send(encoder, {
        payload: processedPayload,
        timestamp: new Date(),
      });

      // Convert to serializable format for cross-context communication
      const serializableResult = makeSerializable(result);

      // Log a cleaner representation of the lightpush result
      if (serializableResult.successes && serializableResult.successes.length > 0) {
        console.log(`✅ Message sent successfully to ${serializableResult.successes.length} peer(s):`);

        // Get current connected peers for better identification
        const connectedPeers = this.waku.libp2p.getPeers();

        serializableResult.successes.forEach((peerIdString: string, index: number) => {
          console.log(`  ${index + 1}. ${peerIdString}`);
        });

        // Show connected peer count for context
        if (connectedPeers.length > 0) {
          console.log(`📡 Connected to ${connectedPeers.length} total peer(s)`);
        }

        if (serializableResult.failures && serializableResult.failures.length > 0) {
          console.log(`❌ Failed to send to ${serializableResult.failures.length} peer(s)`);
        }
      } else {
        console.log("Message send result:", serializableResult);
      }
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
    pubsubTopic: string,
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

      console.log(`Preparing to send message with contentTopic: ${contentTopic}, pubsubTopic: ${pubsubTopic}`);
      console.log(`Using network config:`, this.networkConfig);

      // Create encoder with explicit pubsubTopic for v3 API compatibility
      const encoder = this.waku.createEncoder({ contentTopic, pubsubTopic });

      console.log("Encoder created with pubsubTopic:", encoder.pubsubTopic);
      
      // Send the message using lightpush with preferred peer if configured
      let result;
      if (this.lightpushNode) {
        console.log(`Attempting to send via preferred lightpush node: ${this.lightpushNode}`);
        try {
          // Try to send to preferred peer first
          const preferredPeerId = await this.getPeerIdFromMultiaddr(this.lightpushNode);
          if (preferredPeerId) {
            result = await lightPush.send(encoder, {
              payload: processedPayload,
              timestamp: new Date(),
            }, { peerId: preferredPeerId });
            console.log("✅ Message sent via preferred lightpush node");
          } else {
            throw new Error("Could not extract peer ID from preferred node address");
          }
        } catch (error) {
          console.warn("Failed to send via preferred node, falling back to default:", error);
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

      // Log a cleaner representation of the lightpush result
      if (serializableResult.successes && serializableResult.successes.length > 0) {
        console.log(`✅ v3 Message sent successfully to ${serializableResult.successes.length} peer(s):`);

        // Get current connected peers for better identification
        const connectedPeers = this.waku.libp2p.getPeers();

        serializableResult.successes.forEach((peerIdString: string, index: number) => {
          console.log(`  ${index + 1}. ${peerIdString}`);
        });

        // Show connected peer count for context
        if (connectedPeers.length > 0) {
          console.log(`📡 Connected to ${connectedPeers.length} total peer(s)`);
        }

        if (serializableResult.failures && serializableResult.failures.length > 0) {
          console.log(`❌ Failed to send to ${serializableResult.failures.length} peer(s)`);
        }
      } else {
        console.log("v3 Message send result:", serializableResult);
      }
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

    console.log(`Waiting for peers with protocols ${protocols} (timeout: ${timeoutMs}ms)...`);
    const startTime = Date.now();

    try {
      await this.waku.waitForPeers(protocols, timeoutMs);
      const elapsed = Date.now() - startTime;
      console.log(`Found peers after ${elapsed}ms`);

      // Log connected peers
      const peers = this.waku.libp2p.getPeers();
      console.log(`Connected to ${peers.length} peers:`, peers.map(p => p.toString()));

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

    // Store the network config from options if provided
    if (options.networkConfig) {
      this.networkConfig = options.networkConfig;
    }

    console.log("Creating Waku node with options:", JSON.stringify(options, null, 2));
    console.log("Using network config:", JSON.stringify(this.networkConfig, null, 2));

    // Configure for real network connectivity
    const createOptions = {
      ...options,
      // Always use our stored network config
      networkConfig: this.networkConfig,
      libp2p: {
        ...options.libp2p,
        filterMultiaddrs: false,
        connectionManager: {
          minConnections: 1,
          maxConnections: 50,
          connectionGater: {
            // Allow all connections
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
      },
    };

    this.waku = await createLightNode(createOptions);
    console.log("Waku node created successfully");
    return { success: true };
  }

  async startNode() {
    if (!this.waku) {
      throw new Error("Waku node not created");
    }
    console.log("Starting Waku node...");
    await this.waku.start();
    console.log("Waku node started, peer ID:", this.waku.libp2p.peerId.toString());
    
    // If a preferred lightpush node is configured, dial it
    if (this.lightpushNode) {
      await this.dialPreferredLightpushNode();
    }
    
    return { success: true };
  }

  /**
   * Dial the preferred lightpush node if configured
   */
  private async dialPreferredLightpushNode() {
    if (!this.waku || !this.lightpushNode) {
      return;
    }

    try {
      console.log(`Dialing preferred lightpush node: ${this.lightpushNode}`);
      await this.waku.dial(this.lightpushNode);
      console.log(`Successfully connected to preferred lightpush node: ${this.lightpushNode}`);
    } catch (error) {
      console.warn(`Failed to dial preferred lightpush node ${this.lightpushNode}:`, error);
      // Don't throw error - fallback to default peer discovery
    }
  }

  /**
   * Extract peer ID from multiaddr string
   */
  private async getPeerIdFromMultiaddr(multiaddr: string): Promise<any | null> {
    if (!this.waku) {
      return null;
    }

    try {
      // Check if this peer is already connected
      const connectedPeers = this.waku.libp2p.getPeers();
      
      // Try to match by the multiaddr - this is a simplified approach
      // In a real implementation, you'd parse the multiaddr to extract the peer ID
      for (const peerId of connectedPeers) {
        try {
          const peerInfo = await this.waku.libp2p.peerStore.get(peerId);
          for (const addr of peerInfo.addresses) {
            if (addr.multiaddr.toString().includes(multiaddr.split('/')[2])) {
              console.log(`Found matching peer ID for ${multiaddr}: ${peerId.toString()}`);
              return peerId;
            }
          }
        } catch (e) {
          // Continue searching
        }
      }
      
      // If not found, try to extract from multiaddr format
      // Format: /ip4/x.x.x.x/tcp/port/p2p/peerID
      const parts = multiaddr.split('/');
      const p2pIndex = parts.indexOf('p2p');
      if (p2pIndex !== -1 && p2pIndex + 1 < parts.length) {
        const peerIdString = parts[p2pIndex + 1];
        console.log(`Extracted peer ID from multiaddr: ${peerIdString}`);
        // For now, return as string - the actual implementation might need proper PeerId construction
        return peerIdString;
      }
      
      console.warn(`Could not extract peer ID from multiaddr: ${multiaddr}`);
      return null;
    } catch (error) {
      console.warn("Error extracting peer ID from multiaddr:", error);
      return null;
    }
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

  /**
   * Get available protocols from connected peers
   */
  getAvailablePeerProtocols() {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }

    try {
      const libp2p = this.waku.libp2p;
      const availableProtocols = new Set<string>();

      // Get protocols from our own node
      const ownProtocols = Array.from(libp2p.getProtocols());
      ownProtocols.forEach(p => availableProtocols.add(p));

      // Try to get protocols from connected peers
      if (libp2p.components && libp2p.components.connectionManager) {
        const connections = libp2p.components.connectionManager.getConnections();
        connections.forEach((conn: any) => {
          // Note: Getting peer protocols might require additional libp2p methods
          // For now, we'll just log the connection info
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

  /**
   * Get detailed peer connection status for debugging
   */
  getPeerConnectionStatus() {
    if (!this.waku) {
      throw new Error("Waku node not started");
    }

    try {
      const libp2p = this.waku.libp2p;

      // Basic info that should always be available
      const basicInfo = {
        peerId: libp2p.peerId.toString(),
        listenAddresses: libp2p.getMultiaddrs().map((a: any) => a.toString()),
        protocols: Array.from(libp2p.getProtocols()),
        networkConfig: this.networkConfig,
        // Add debug info about libp2p
        libp2pKeys: Object.keys(libp2p),
        libp2pType: typeof libp2p,
      };

      // Try to get connection info if available
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

      // Try to get peer store info if available
      try {
        if (libp2p.peerStore) {
          const peerStore = libp2p.peerStore;
          if (typeof peerStore.getPeers === 'function') {
            const peers = Array.from(peerStore.getPeers()).map((peerId: any) => peerId.toString());
            basicInfo.peers = peers;
          } else {
            basicInfo.peers = [];
            basicInfo.peerError = `peerStore.getPeers is not a function`;
          }
        } else {
          basicInfo.peers = [];
          basicInfo.peerError = `No peerStore found`;
        }
      } catch (peerError) {
        basicInfo.peers = [];
        basicInfo.peerError = `Peer store error: ${peerError instanceof Error ? peerError.message : String(peerError)}`;
      }

      // Try to check if started
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

// Expose a singleton instance on window for Playwright to use
(() => {
  try {
    console.log("Initializing WakuHeadless...");

    // Check for global network configuration set by server
    const globalNetworkConfig = (window as any).__WAKU_NETWORK_CONFIG;
    
    // Check for global lightpushnode configuration set by server
    const globalLightpushNode = (window as any).__WAKU_LIGHTPUSH_NODE;
    
    const instance = new WakuHeadless(globalNetworkConfig, globalLightpushNode);

    // @ts-ignore - will add proper typings in global.d.ts
    (window as any).wakuApi = instance;
    console.log(
      "WakuHeadless initialized successfully:",
      !!(window as any).wakuApi,
    );
  } catch (error) {
    console.error("Error initializing WakuHeadless:", error);
    // Set a fallback to help with debugging
    (window as any).wakuApi = {
      start: () =>
        Promise.reject(new Error("WakuHeadless failed to initialize")),
      error: error,
    };
  }
})();
