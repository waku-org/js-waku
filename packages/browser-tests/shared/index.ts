import {
  createDecoder,
  createEncoder,
  createLightNode,
  CreateNodeOptions,
  DecodedMessage,
  LightNode,
  SDKProtocolResult,
  SubscribeResult
} from "@waku/sdk";

import { IWakuNode } from "./common.js";

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

export async function pushMessage(
  waku: LightNode,
  contentTopic: string,
  payload?: Uint8Array,
  options?: { clusterId?: number; shard?: number }
): Promise<SDKProtocolResult> {
  if (!waku) throw new Error("Waku node not found");

  const encoder = createEncoder({
    contentTopic,
    pubsubTopicShardInfo: {
      clusterId: options?.clusterId ?? 1,
      shard: options?.shard ?? 1
    }
  });
  return waku.lightPush.send(encoder, { payload: payload ?? new Uint8Array() });
}

export async function createWakuNode(options: CreateNodeOptions) {
  if (typeof window === "undefined") return { success: false, error: "No window" };
  try {
    if ((window as any).waku) await (window as any).waku.stop();
    (window as any).waku = await createLightNode(options);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function startNode() {
  if (typeof window !== "undefined" && (window as any).waku) {
    try {
      await (window as any).waku.start();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
  return { success: false, error: "Waku node not found" };
}

export async function stopNode() {
  if (typeof window !== "undefined" && (window as any).waku) {
    await (window as any).waku.stop();
    return { success: true };
  }
  return { success: false, error: "Waku node not found" };
}

export async function dialPeers(waku: LightNode, peers: string[]) {
  const errors: string[] = [];
  await Promise.allSettled(
    peers.map((p) => waku.dial(p).catch((err: any) => errors.push(err.message)))
  );
  return { total: peers.length, errors };
}

export async function subscribe(
  waku: LightNode,
  contentTopic: string,
  options?: { clusterId?: number; shard?: number },
  // eslint-disable-next-line no-unused-vars
  callback?: (message: DecodedMessage) => void
): Promise<SubscribeResult> {
  const clusterId = options?.clusterId ?? 42;
  const shard = options?.shard ?? 0;
  const decoder = createDecoder(contentTopic, { clusterId, shard });
  return waku.filter.subscribe(decoder, callback ?? ((_m) => console.log(_m)));
}

export const API = {
  getPeerInfo,
  getDebugInfo,
  pushMessage,
  createWakuNode,
  startNode,
  stopNode,
  dialPeers,
  subscribe
};
