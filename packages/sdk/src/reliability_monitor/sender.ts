import type { Connection, Peer, PeerId } from "@libp2p/interface";
import { CoreProtocolResult } from "@waku/interfaces";
import { Logger } from "@waku/utils";

const log = new Logger("sdk:sender:reliability_monitor");

const DEFAULT_MAX_ATTEMPTS = 3;

export class SenderReliabilityMonitor {
  public constructor(
    private getConnections: () => Connection[],
    private renewPeer: (peerId: PeerId) => Promise<Peer>
  ) {}

  public async attemptRetriesOrRenew(
    peerToUse: Peer,
    protocolSend: (p: Peer) => Promise<CoreProtocolResult>
  ): Promise<void> {
    let forceRenew = false;
    for (let i = 0; i < DEFAULT_MAX_ATTEMPTS; i++) {
      const connections = this.getConnections();
      if (
        forceRenew ||
        !connections.find((c) => c.remotePeer.equals(peerToUse.id))
      ) {
        try {
          peerToUse = await this.renewPeer(peerToUse.id);
          forceRenew = false;
        } catch (e) {
          log.error(`Failed to renew peer ${peerToUse.id.toString()}: ${e}`);
          return;
        }
      }

      try {
        const result = await protocolSend(peerToUse);

        if (result.success) {
          return;
        }

        forceRenew = true;
      } catch (_e) {
        continue;
      }
    }
  }
}
