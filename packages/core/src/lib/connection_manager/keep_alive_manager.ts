import type { PeerId } from "@libp2p/interface";
import type { IEncoder, IRelay, Libp2p } from "@waku/interfaces";
import { Logger } from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";

import { createEncoder } from "../message/version_0.js";

const RelayPingContentTopic = "/relay-ping/1/ping/null";
const log = new Logger("keep-alive");

type KeepAliveOptions = {
  pingKeepAlive: number;
  relayKeepAlive: number;
};

type CreateKeepAliveManagerOptions = {
  options: KeepAliveOptions;
  libp2p: Libp2p;
  relay?: IRelay;
};

interface IKeepAliveManager {
  start(): void;
  stop(): void;
}

export class KeepAliveManager implements IKeepAliveManager {
  private readonly relay?: IRelay;
  private readonly libp2p: Libp2p;

  private readonly options: KeepAliveOptions;

  private pingKeepAliveTimers: Map<string, ReturnType<typeof setInterval>> =
    new Map();
  private relayKeepAliveTimers: Map<string, ReturnType<typeof setInterval>[]> =
    new Map();

  public constructor({
    options,
    relay,
    libp2p
  }: CreateKeepAliveManagerOptions) {
    this.options = options;
    this.relay = relay;
    this.libp2p = libp2p;

    this.onPeerConnect = this.onPeerConnect.bind(this);
    this.onPeerDisconnect = this.onPeerDisconnect.bind(this);
  }

  public start(): void {
    this.libp2p.addEventListener("peer:connect", this.onPeerConnect);
    this.libp2p.addEventListener("peer:disconnect", this.onPeerDisconnect);
  }

  public stop(): void {
    this.libp2p.removeEventListener("peer:connect", this.onPeerConnect);
    this.libp2p.removeEventListener("peer:disconnect", this.onPeerDisconnect);

    for (const timer of this.pingKeepAliveTimers.values()) {
      clearInterval(timer);
    }

    for (const timerArray of this.relayKeepAliveTimers.values()) {
      for (const timer of timerArray) {
        clearInterval(timer);
      }
    }

    this.pingKeepAliveTimers.clear();
    this.relayKeepAliveTimers.clear();
  }

  private onPeerConnect(evt: CustomEvent<PeerId>): void {
    const peerId = evt.detail;
    this.startPingForPeer(peerId);
  }

  private onPeerDisconnect(evt: CustomEvent<PeerId>): void {
    const peerId = evt.detail;
    this.stopPingForPeer(peerId);
  }

  private startPingForPeer(peerId: PeerId): void {
    // Just in case a timer already exists for this peer
    this.stopPingForPeer(peerId);

    this.startLibp2pPing(peerId);
    this.startRelayPing(peerId);
  }

  private stopPingForPeer(peerId: PeerId): void {
    this.stopLibp2pPing(peerId);
    this.stopRelayPing(peerId);
  }

  private startLibp2pPing(peerId: PeerId): void {
    if (this.options.pingKeepAlive === 0) {
      log.warn(
        `Ping keep alive is disabled pingKeepAlive:${this.options.pingKeepAlive}, skipping start for libp2p ping`
      );
      return;
    }

    const peerIdStr = peerId.toString();

    if (this.pingKeepAliveTimers.has(peerIdStr)) {
      log.warn(
        `Ping already started for peer: ${peerIdStr}, skipping start for libp2p ping`
      );
      return;
    }

    const interval = setInterval(() => {
      void this.pingLibp2p(peerId);
    }, this.options.pingKeepAlive * 1000);

    this.pingKeepAliveTimers.set(peerIdStr, interval);
  }

  private stopLibp2pPing(peerId: PeerId): void {
    const peerIdStr = peerId.toString();

    if (!this.pingKeepAliveTimers.has(peerIdStr)) {
      log.warn(
        `Ping not started for peer: ${peerIdStr}, skipping stop for ping`
      );
      return;
    }

    clearInterval(this.pingKeepAliveTimers.get(peerIdStr));
    this.pingKeepAliveTimers.delete(peerIdStr);
  }

  private startRelayPing(peerId: PeerId): void {
    if (!this.relay) {
      return;
    }

    if (this.options.relayKeepAlive === 0) {
      log.warn(
        `Relay keep alive is disabled relayKeepAlive:${this.options.relayKeepAlive}, skipping start for relay ping`
      );
      return;
    }

    if (this.relayKeepAliveTimers.has(peerId.toString())) {
      log.warn(
        `Relay ping already started for peer: ${peerId.toString()}, skipping start for relay ping`
      );
      return;
    }

    const intervals: NodeJS.Timeout[] = [];

    for (const topic of this.relay.pubsubTopics) {
      const meshPeers = this.relay.getMeshPeers(topic);

      if (!meshPeers.includes(peerId.toString())) {
        log.warn(
          `Peer: ${peerId.toString()} is not in the mesh for topic: ${topic}, skipping start for relay ping`
        );
        continue;
      }

      const encoder = createEncoder({
        contentTopic: RelayPingContentTopic,
        pubsubTopicOrShard: topic,
        ephemeral: true
      });

      const interval = setInterval(() => {
        void this.pingRelay(encoder);
      }, this.options.relayKeepAlive * 1000);

      intervals.push(interval);
    }

    this.relayKeepAliveTimers.set(peerId.toString(), intervals);
  }

  private stopRelayPing(peerId: PeerId): void {
    if (!this.relay) {
      return;
    }

    const peerIdStr = peerId.toString();

    if (!this.relayKeepAliveTimers.has(peerIdStr)) {
      log.warn(
        `Relay ping not started for peer: ${peerIdStr}, skipping stop for relay ping`
      );
      return;
    }

    this.relayKeepAliveTimers.get(peerIdStr)?.map(clearInterval);
    this.relayKeepAliveTimers.delete(peerIdStr);
  }

  private async pingRelay(encoder: IEncoder): Promise<void> {
    try {
      log.info("Sending Waku Relay ping message");
      await this.relay!.send(encoder, { payload: new Uint8Array([1]) });
    } catch (e) {
      log.error("Failed to send relay ping", e);
    }
  }

  private async pingLibp2p(peerId: PeerId): Promise<void> {
    try {
      log.info(`Pinging libp2p peer (${peerId.toString()})`);
      const ping = await this.libp2p.services.ping.ping(peerId);

      log.info(`Ping succeeded (${peerId.toString()})`, ping);

      await this.libp2p.peerStore.merge(peerId, {
        metadata: {
          ping: utf8ToBytes(ping.toString())
        }
      });
      log.info(`Ping updated for peer (${peerId.toString()})`);
    } catch (e) {
      log.error(`Ping failed for peer (${peerId.toString()})`, e);
    }
  }
}
