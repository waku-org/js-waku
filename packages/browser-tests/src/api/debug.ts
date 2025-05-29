import { IWakuNode } from "./common.js";

/**
 * Gets peer information from a Waku node
 * Used in both server API endpoints and headless tests
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
 * Used in both server API endpoints and tests
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
