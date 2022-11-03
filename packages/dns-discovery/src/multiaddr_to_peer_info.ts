import { PeerInfo } from "@libp2p/interface-peer-info";
import { peerIdFromString } from "@libp2p/peer-id";
import { Multiaddr } from "@multiformats/multiaddr";

export function multiaddrsToPeerInfo(mas: Multiaddr[]): PeerInfo[] {
  return mas
    .map((ma) => {
      const peerIdStr = ma.getPeerId();
      const protocols: string[] = [];
      return {
        id: peerIdStr ? peerIdFromString(peerIdStr) : null,
        multiaddrs: [ma.decapsulateCode(421)],
        protocols,
      };
    })
    .filter((peerInfo): peerInfo is PeerInfo => peerInfo.id !== null);
}
