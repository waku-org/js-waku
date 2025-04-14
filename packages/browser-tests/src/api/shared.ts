import {
  createEncoder,
  createLightNode,
  CreateNodeOptions,
  LightNode,
  SDKProtocolResult
} from "@waku/sdk";

import { IWakuNode } from "./common.js";

/**
 * Gets peer information from a Waku node
 */
export async function getPeerInfo(waku: IWakuNode): Promise<{
  peerId: string;
  multiaddrs: string[];
  peers: string[];
}> {
  const multiaddrs = waku.libp2p.getMultiaddrs();
  const peers = await waku.libp2p.peerStore.all();

  return {
    peerId: waku.libp2p.peerId.toString(),
    multiaddrs: multiaddrs.map((addr) => addr.toString()),
    peers: peers.map((peer) => peer.id.toString())
  };
}

/**
 * Gets debug information from a Waku node
 */
export async function getDebugInfo(waku: IWakuNode): Promise<{
  listenAddresses: string[];
  peerId: string;
  protocols: string[];
}> {
  return {
    listenAddresses: waku.libp2p.getMultiaddrs().map((addr) => addr.toString()),
    peerId: waku.libp2p.peerId.toString(),
    protocols: Array.from(waku.libp2p.getProtocols())
  };
}

/**
 * Pushes a message to the network
 */
export async function pushMessage(
  waku: LightNode,
  contentTopic: string,
  payload?: Uint8Array,
  options?: {
    clusterId?: number;
    shard?: number;
  }
): Promise<SDKProtocolResult> {
  if (!waku) {
    throw new Error("Waku node not found");
  }
  // await waku.waitForPeers(["lightpush"]);
  const encoder = createEncoder({
    contentTopic,
    pubsubTopicShardInfo: {
      clusterId: options?.clusterId ?? 0,
      shard: options?.shard ?? 0
    }
  });

  const result = await waku.lightPush.send(encoder, {
    payload: payload ?? new Uint8Array()
  });
  return result;
}

/**
 * Creates and initializes a Waku node
 * Checks if a node is already running in window and stops it if it exists
 */
export async function createWakuNode(
  options: CreateNodeOptions
): Promise<{ success: boolean; error?: string }> {
  // Check if we're in a browser environment and a node already exists
  if (typeof window === "undefined") {
    return { success: false, error: "No window found" };
  }

  try {
    if ((window as any).waku) {
      await (window as any).waku.stop();
    }
    (window as any).waku = await createLightNode(options);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function startNode(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (typeof window !== "undefined" && (window as any).waku) {
    try {
      await (window as any).waku.start();
      return { success: true };
    } catch (error: any) {
      // Silently continue if there's an error starting the node
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: "Waku node not found in window" };
}

export async function stopNode(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (typeof window !== "undefined" && (window as any).waku) {
    await (window as any).waku.stop();
    return { success: true };
  }
  return { success: false, error: "Waku node not found in window" };
}

export async function dialPeers(
  waku: LightNode,
  peers: string[]
): Promise<{
  total: number;
  errors: string[];
}> {
  const total = peers.length;
  const errors: string[] = [];
  for (const peer of peers) {
    try {
      await waku.dial(peer);
    } catch (error: any) {
      errors.push(error.message);
    }
  }
  return { total, errors };
}

// Export all API functions as a collection for easier importing
export const API = {
  getPeerInfo,
  getDebugInfo,
  pushMessage,
  createWakuNode,
  startNode,
  stopNode,
  dialPeers
};
