import type { PeerId } from "@libp2p/interface/peer-id";
import type { PeerStore } from "@libp2p/interface/peer-store";

export async function getPeerShardInfo(
  peerId: PeerId,
  peerStore: PeerStore
): Promise<Uint8Array | undefined> {
  const peer = await peerStore.get(peerId);
  return peer.metadata.get("shardInfo");
}
