import type { LightNode } from "@waku/interfaces";
export async function waitForConnections(
  numPeers: number,
  waku: LightNode
): Promise<void> {
  let connectionsLen = waku.libp2p.getConnections().length;
  if (connectionsLen >= numPeers) {
    return;
  }
  await new Promise<void>((resolve) => {
    const cb = (): void => {
      connectionsLen++;
      if (connectionsLen >= numPeers) {
        waku.libp2p.removeEventListener("peer:identify", cb);
        resolve();
      }
    };
    waku.libp2p.addEventListener("peer:identify", cb);
  });
}
