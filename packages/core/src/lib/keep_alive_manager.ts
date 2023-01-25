import type { PeerId } from "@libp2p/interface-peer-id";
import { IRelay } from "@waku/interfaces";
import debug from "debug";
import type { Libp2p } from "libp2p";

import { createEncoder } from "../index.js";

import { RelayPingContentTopic } from "./relay/constants.js";

const log = debug("waku:keep-alive");

export interface KeepAliveOptions {
  pingKeepAlive: number;
  relayKeepAlive: number;
}

export default class KeepAliveManager {
  private pingKeepAliveTimers: Map<string, ReturnType<typeof setInterval>>;
  private relayKeepAliveTimers: Map<PeerId, ReturnType<typeof setInterval>>;

  constructor() {
    this.pingKeepAliveTimers = new Map();
    this.relayKeepAliveTimers = new Map();
  }

  public startKeepAlive(
    peerId: PeerId,
    libp2pPing: Libp2p["ping"],
    options: KeepAliveOptions,
    relay?: IRelay
  ): void {
    // Just in case a timer already exist for this peer
    this.stopKeepAlive(peerId);

    const { pingKeepAlive: pingPeriodSecs, relayKeepAlive: relayPeriodSecs } =
      options;

    const peerIdStr = peerId.toString();

    if (pingPeriodSecs !== 0) {
      const interval = setInterval(() => {
        libp2pPing(peerId).catch((e) => {
          log(`Ping failed (${peerIdStr})`, e);
        });
      }, pingPeriodSecs * 1000);
      this.pingKeepAliveTimers.set(peerIdStr, interval);
    }

    if (relay && relayPeriodSecs !== 0) {
      const encoder = createEncoder(RelayPingContentTopic);
      const interval = setInterval(() => {
        log("Sending Waku Relay ping message");
        relay
          .send(encoder, { payload: new Uint8Array() })
          .catch((e) => log("Failed to send relay ping", e));
      }, relayPeriodSecs * 1000);
      this.relayKeepAliveTimers.set(peerId, interval);
    }
  }

  public stopKeepAlive(peerId: PeerId): void {
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

  public stopAllKeepAlives(): void {
    for (const timer of [
      ...Object.values(this.pingKeepAliveTimers),
      ...Object.values(this.relayKeepAliveTimers),
    ]) {
      clearInterval(timer);
    }

    this.pingKeepAliveTimers.clear();
    this.relayKeepAliveTimers.clear();
  }
}
