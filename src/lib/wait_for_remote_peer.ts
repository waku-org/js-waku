import type { GossipSub } from "@chainsafe/libp2p-gossipsub";
import { Peer, PeerProtocolsChangeData } from "@libp2p/interface-peer-store";
import debug from "debug";
import type { Libp2p } from "libp2p";
import { pEvent } from "p-event";

import { StoreCodecs } from "./constants";
import { Protocols, Waku } from "./waku";
import { FilterCodec } from "./waku_filter";
import { LightPushCodec } from "./waku_light_push";

const log = debug("waku:wait-for-remote-peer");

interface WakuProtocol {
  libp2p: Libp2p;
  peers: () => Promise<Peer[]>;
}

interface WakuGossipSubProtocol extends GossipSub {
  getMeshPeers: () => string[];
}

/**
 * Wait for a remote peer to be ready given the passed protocols.
 * Useful when using the [[CreateOptions.bootstrap]] with [[createWaku]].
 *
 * If the passed protocols is a GossipSub protocol, then it resolves only once
 * a peer is in a mesh, to help ensure that other peers will send and receive
 * message to us.
 *
 * @param waku The Waku Node
 * @param protocols The protocols that need to be enabled by remote peers.
 * @param timeoutMs A timeout value in milliseconds..
 *
 * @returns A promise that **resolves** if all desired protocols are fulfilled by
 * remote nodes, **rejects** if the timeoutMs is reached.
 *
 * @default Remote peer must have Waku Relay enabled and no time out is applied.
 */
export async function waitForRemotePeer(
  waku: Waku,
  protocols?: Protocols[],
  timeoutMs?: number
): Promise<void> {
  protocols = protocols ?? [Protocols.Relay];

  if (!waku.isStarted()) return Promise.reject("Waku node is not started");

  const promises = [];

  if (protocols.includes(Protocols.Relay)) {
    promises.push(waitForGossipSubPeerInMesh(waku.relay));
  }

  if (protocols.includes(Protocols.Store)) {
    promises.push(waitForConnectedPeer(waku.store, Object.values(StoreCodecs)));
  }

  if (protocols.includes(Protocols.LightPush)) {
    promises.push(waitForConnectedPeer(waku.lightPush, [LightPushCodec]));
  }

  if (protocols.includes(Protocols.Filter)) {
    promises.push(waitForConnectedPeer(waku.filter, [FilterCodec]));
  }

  if (timeoutMs) {
    await rejectOnTimeout(
      Promise.all(promises),
      timeoutMs,
      "Timed out waiting for a remote peer."
    );
  } else {
    await Promise.all(promises);
  }
}

/**
 * Wait for a peer with the given protocol to be connected.
 */
async function waitForConnectedPeer(
  waku: WakuProtocol,
  codecs: string[]
): Promise<void> {
  const peers = await waku.peers();

  if (peers.length) {
    log(`${codecs} peer found: `, peers[0].id.toString());
    return;
  }

  await new Promise<void>((resolve) => {
    const cb = (evt: CustomEvent<PeerProtocolsChangeData>): void => {
      for (const codec of codecs) {
        if (evt.detail.protocols.includes(codec)) {
          log("Resolving for", codec, evt.detail.protocols);
          waku.libp2p.peerStore.removeEventListener("change:protocols", cb);
          resolve();
          break;
        }
      }
    };
    waku.libp2p.peerStore.addEventListener("change:protocols", cb);
  });
}

/**
 * Wait for a peer with the given protocol to be connected and in the gossipsub
 * mesh.
 */
async function waitForGossipSubPeerInMesh(
  waku: WakuGossipSubProtocol
): Promise<void> {
  let peers = waku.getMeshPeers();

  while (peers.length == 0) {
    await pEvent(waku, "gossipsub:heartbeat");
    peers = waku.getMeshPeers();
  }
}

const awaitTimeout = (ms: number, rejectReason: string): Promise<void> =>
  new Promise((_resolve, reject) => setTimeout(() => reject(rejectReason), ms));

async function rejectOnTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  rejectReason: string
): Promise<void> {
  await Promise.race([promise, awaitTimeout(timeoutMs, rejectReason)]);
}
