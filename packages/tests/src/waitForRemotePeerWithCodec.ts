import type { IdentifyResult } from "@libp2p/interface";
import type { PeerId } from "@libp2p/interface/peer-id";
import type { LightNode } from "@waku/interfaces";

/**
 * Wait for a remote peer to be identified with a given codec
 * @param waku - Waku node
 * @param codec - Codec to wait for
 * @returns Promise that resolves when the peer is identified
 * @internal
 * This function is introduced as `core/waitForRemotePeer` only accounts for core protocols like Filter, LightPush & Store
 * While this (currently) is not required by the SDK, it is required for the tests
 */
export async function waitForRemotePeerWithCodec(
  waku: LightNode,
  codec: string,
  nodePeerId: PeerId
): Promise<void> {
  const connectedPeers = waku.libp2p
    .getConnections()
    .map((conn) => conn.remotePeer);
  if (
    connectedPeers.find((connectedPeer) => connectedPeer.equals(nodePeerId))
  ) {
    return;
  }

  await new Promise<void>((resolve) => {
    const cb = (evt: CustomEvent<IdentifyResult>): void => {
      if (evt.detail.protocols.includes(codec)) {
        waku.libp2p.removeEventListener("peer:identify", cb);
        resolve();
      }
    };
    waku.libp2p.addEventListener("peer:identify", cb);
  });

  return;
}
