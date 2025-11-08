import { TypedEventEmitter } from "@libp2p/interface";
import { Logger } from "@waku/utils";

const log = new Logger("sds:status");

export const StatusEvent = {
  /**
   * We are not aware of any missing messages that we may be able to get
   * We MAY have messages lost forever, see the `event.detail`
   */
  Synced: "synced", // TODO or synced or health or caught-up?
  /**
   * We are aware of missing messages that we may be able to get
   */
  Syncing: "syncing" // TODO: it assumes "syncing" is happening via SDS repair or store queries
};

export type StatusEvent = (typeof StatusEvent)[keyof typeof StatusEvent];

export type StatusDetail = {
  /**
   * number of received messages
   */
  received: number;
  /**
   * number of missing messages that are not yet considered as irretrievably lost
   */
  missing: number;
  /**
   * number of messages considered as irretrievably lost
   */
  lost: number;
};

export interface StatusEvents {
  synced: CustomEvent<StatusDetail>;
  syncing: CustomEvent<StatusDetail>;
}

export class StatusEmitter extends TypedEventEmitter<StatusEvents> {
  public safeSend(detail: StatusDetail): void {
    try {
      if (detail.missing === 0) {
        this.dispatchEvent(new CustomEvent(StatusEvent.Synced, { detail }));
      } else {
        this.dispatchEvent(new CustomEvent(StatusEvent.Syncing, { detail }));
      }
    } catch (error) {
      log.error(`Failed to dispatch status synced:`, error);
    }
  }
}
