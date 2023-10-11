import type { PeerId } from "@libp2p/interface/peer-id";
import type { PeerStore } from "@libp2p/interface/peer-store";
import type { IRelay, PeerIdStr } from "@waku/interfaces";
import type { KeepAliveOptions } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";
import debug from "debug";
import type { PingService } from "libp2p/ping";

import { createEncoder } from "./message/version_0.js";

export const RelayPingContentTopic = "/relay-ping/1/ping/null";
const log = debug("waku:keep-alive");

export class KeepAliveManager {
  private pingKeepAliveTimers: Map<string, ReturnType<typeof setInterval>>;
  private relayKeepAliveTimers: Map<PeerId, ReturnType<typeof setInterval>[]>;
  private options: KeepAliveOptions;
  private relay?: IRelay;

  constructor(options: KeepAliveOptions, relay?: IRelay) {
    this.pingKeepAliveTimers = new Map();
    this.relayKeepAliveTimers = new Map();
    this.options = options;
    this.relay = relay;
  }

  public start(
    peerId: PeerId,
    libp2pPing: PingService,
    peerStore: PeerStore
  ): void {
    // Just in case a timer already exists for this peer
    this.stop(peerId);

    const { pingKeepAlive: pingPeriodSecs, relayKeepAlive: relayPeriodSecs } =
      this.options;

    const peerIdStr = peerId.toString();

    if (pingPeriodSecs !== 0) {
      const interval = setInterval(() => {
        void (async () => {
          try {
            // ping the peer for keep alive
            // also update the peer store with the latency
            const ping = await libp2pPing.ping(peerId);
            log(`Ping succeeded (${peerIdStr})`, ping);

            try {
              await peerStore.patch(peerId, {
                metadata: {
                  ping: utf8ToBytes(ping.toString())
                }
              });
            } catch (e) {
              log("Failed to update ping", e);
            }
          } catch (e) {
            log(`Ping failed (${peerIdStr})`, e);
          }
        })();
      }, pingPeriodSecs * 1000);

      this.pingKeepAliveTimers.set(peerIdStr, interval);
    }

    const relay = this.relay;
    if (relay && relayPeriodSecs !== 0) {
      const intervals = this.scheduleRelayPings(
        relay,
        relayPeriodSecs,
        peerId.toString()
      );
      this.relayKeepAliveTimers.set(peerId, intervals);
    }
  }

  public stop(peerId: PeerId): void {
    const peerIdStr = peerId.toString();

    if (this.pingKeepAliveTimers.has(peerIdStr)) {
      clearInterval(this.pingKeepAliveTimers.get(peerIdStr));
      this.pingKeepAliveTimers.delete(peerIdStr);
    }

    if (this.relayKeepAliveTimers.has(peerId)) {
      this.relayKeepAliveTimers.get(peerId)?.map(clearInterval);
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

  private scheduleRelayPings(
    relay: IRelay,
    relayPeriodSecs: number,
    peerIdStr: PeerIdStr
  ): NodeJS.Timeout[] {
    // send a ping message to each PubSubTopic the peer is part of
    const intervals: NodeJS.Timeout[] = [];
    for (const topic of relay.pubSubTopics) {
      const meshPeers = relay.getMeshPeers(topic);
      if (!meshPeers.includes(peerIdStr)) continue;

      const encoder = createEncoder({
        pubsubTopic: topic,
        contentTopic: RelayPingContentTopic,
        ephemeral: true
      });
      const interval = setInterval(() => {
        log("Sending Waku Relay ping message");
        relay
          .send(encoder, { payload: new Uint8Array([1]) })
          .catch((e) => log("Failed to send relay ping", e));
      }, relayPeriodSecs * 1000);
      intervals.push(interval);
    }

    return intervals;
  }
}
