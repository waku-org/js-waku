import type { PeerId } from "@libp2p/interface/peer-id";
import type { IRelay } from "@waku/interfaces";
import type { KeepAliveOptions } from "@waku/interfaces";
import debug from "debug";
import type { PingService } from "libp2p/ping";

import { createEncoder } from "../index.js";

export const RelayPingContentTopic = "/relay-ping/1/ping/null";
const log = debug("waku:keep-alive");

export class KeepAliveManager {
  private pingKeepAliveTimers: Map<string, ReturnType<typeof setInterval>>;
  private relayKeepAliveTimers: Map<PeerId, ReturnType<typeof setInterval>>;
  private options: KeepAliveOptions;
  private relay?: IRelay;
  private libp2pPing: PingService;
  private peerPings: Map<string, number>;

  constructor(
    libp2pPing: PingService,
    options: KeepAliveOptions,
    relay?: IRelay
  ) {
    this.pingKeepAliveTimers = new Map();
    this.relayKeepAliveTimers = new Map();
    this.options = options;
    this.relay = relay;
    this.peerPings = new Map();
    this.libp2pPing = libp2pPing;
  }

  public getPing(peerId: PeerId): number | Promise<number> {
    const ping = this.peerPings.get(peerId.toString());
    if (!ping) {
      return this.libp2pPing.ping(peerId);
    }
    return ping;
  }

  public start(peerId: PeerId): void {
    // Just in case a timer already exist for this peer
    this.stop(peerId);

    const { pingKeepAlive: pingPeriodSecs, relayKeepAlive: relayPeriodSecs } =
      this.options;

    const peerIdStr = peerId.toString();

    if (pingPeriodSecs !== 0) {
      const interval = setInterval(() => {
        this.libp2pPing
          .ping(peerId)
          .then((ping) => {
            log(`Ping succeeded (${peerIdStr})`, ping);
            this.peerPings.set(peerIdStr, ping);
          })
          .catch((e) => {
            log(`Ping failed (${peerIdStr})`, e);
          });
      }, pingPeriodSecs * 1000);
      this.pingKeepAliveTimers.set(peerIdStr, interval);
    }

    const relay = this.relay;
    if (relay && relayPeriodSecs !== 0) {
      const encoder = createEncoder({
        contentTopic: RelayPingContentTopic,
        ephemeral: true
      });
      const interval = setInterval(() => {
        log("Sending Waku Relay ping message");
        relay
          .send(encoder, { payload: new Uint8Array([1]) })
          .catch((e) => log("Failed to send relay ping", e));
      }, relayPeriodSecs * 1000);
      this.relayKeepAliveTimers.set(peerId, interval);
    }
  }

  public stop(peerId: PeerId): void {
    const peerIdStr = peerId.toString();

    if (this.pingKeepAliveTimers.has(peerIdStr)) {
      clearInterval(this.pingKeepAliveTimers.get(peerIdStr));
      this.pingKeepAliveTimers.delete(peerIdStr);
    }

    if (this.relayKeepAliveTimers.has(peerId)) {
      clearInterval(this.relayKeepAliveTimers.get(peerId));
      this.relayKeepAliveTimers.delete(peerId);
    }
  }

  public stopAll(): void {
    for (const timer of [
      ...Object.values(this.pingKeepAliveTimers),
      ...Object.values(this.relayKeepAliveTimers)
    ]) {
      clearInterval(timer);
    }

    this.pingKeepAliveTimers.clear();
    this.relayKeepAliveTimers.clear();
  }
}
