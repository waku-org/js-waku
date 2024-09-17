import type { Peer, PeerId } from "@libp2p/interface";
import { CoreProtocolResult, PeerIdStr } from "@waku/interfaces";
import { Logger } from "@waku/utils";

const log = new Logger("sdk:sender:reliability_monitor");

const DEFAULT_MAX_ATTEMPTS_BEFORE_RENEWAL = 3;

export class SenderReliabilityMonitor {
  private attempts: Map<PeerIdStr, number> = new Map();
  private readonly maxAttemptsBeforeRenewal =
    DEFAULT_MAX_ATTEMPTS_BEFORE_RENEWAL;

  public constructor(private renewPeer: (peerId: PeerId) => Promise<Peer>) {}

  public async attemptRetriesOrRenew(
    peerId: PeerId,
    protocolSend: () => Promise<CoreProtocolResult>
  ): Promise<void> {
    const peerIdStr = peerId.toString();
    const currentAttempts = this.attempts.get(peerIdStr) || 0;
    this.attempts.set(peerIdStr, currentAttempts + 1);

    if (currentAttempts + 1 < this.maxAttemptsBeforeRenewal) {
      try {
        const result = await protocolSend();
        if (result.success) {
          log.info(`Successfully sent message after retry to ${peerIdStr}`);
          this.attempts.delete(peerIdStr);
        } else {
          log.error(
            `Failed to send message after retry to ${peerIdStr}: ${result.failure}`
          );
          await this.attemptRetriesOrRenew(peerId, protocolSend);
        }
      } catch (error) {
        log.error(
          `Failed to send message after retry to ${peerIdStr}: ${error}`
        );
        await this.attemptRetriesOrRenew(peerId, protocolSend);
      }
    } else {
      try {
        const newPeer = await this.renewPeer(peerId);
        log.info(
          `Renewed peer ${peerId.toString()} to ${newPeer.id.toString()}`
        );

        this.attempts.delete(peerIdStr);
        this.attempts.set(newPeer.id.toString(), 0);
        await protocolSend();
      } catch (error) {
        log.error(`Failed to renew peer ${peerId.toString()}: ${error}`);
      }
    }
  }
}
