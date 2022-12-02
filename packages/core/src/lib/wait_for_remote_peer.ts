import { PeerProtocolsChangeData } from "@libp2p/interface-peer-store";
import type { PointToPointProtocol, Relay, Waku } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import debug from "debug";
import { pEvent } from "p-event";

import { FilterCodec } from "./waku_filter/index.js";
import { LightPushCodec } from "./waku_light_push/index.js";
import { StoreCodec } from "./waku_store/index.js";

const log = debug("waku:wait-for-remote-peer");

/**
 * Wait for a remote peer to be ready given the passed protocols.
 * Must be used after attempting to connect to nodes, using
 * {@link index.waku.WakuNode.dial} or a bootstrap method with
 * {@link lib/create_waku.createLightNode}.
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
 * @throws If passing a protocol that is not mounted
 * @default Wait for remote peers with protocols enabled locally and no time out is applied.
 */
export async function waitForRemotePeer(
  waku: Waku,
  protocols?: Protocols[],
  timeoutMs?: number
): Promise<void> {
  protocols = protocols ?? getEnabledProtocols(waku);

  if (!waku.isStarted()) return Promise.reject("Waku node is not started");

  const promises = [];

  if (protocols.includes(Protocols.Relay)) {
    if (!waku.relay)
      throw new Error("Cannot wait for Relay peer: protocol not mounted");
    promises.push(waitForGossipSubPeerInMesh(waku.relay));
  }

  if (protocols.includes(Protocols.Store)) {
    if (!waku.store)
      throw new Error("Cannot wait for Store peer: protocol not mounted");
    promises.push(waitForConnectedPeer(waku.store, [StoreCodec]));
  }

  if (protocols.includes(Protocols.LightPush)) {
    if (!waku.lightPush)
      throw new Error("Cannot wait for LightPush peer: protocol not mounted");
    promises.push(waitForConnectedPeer(waku.lightPush, [LightPushCodec]));
  }

  if (protocols.includes(Protocols.Filter)) {
    if (!waku.filter)
      throw new Error("Cannot wait for Filter peer: protocol not mounted");
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
  waku: PointToPointProtocol,
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
          waku.peerStore.removeEventListener("change:protocols", cb);
          resolve();
          break;
        }
      }
    };
    waku.peerStore.addEventListener("change:protocols", cb);
  });
}

/**
 * Wait for a peer with the given protocol to be connected and in the gossipsub
 * mesh.
 */
async function waitForGossipSubPeerInMesh(waku: Relay): Promise<void> {
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

function getEnabledProtocols(waku: Waku): Protocols[] {
  const protocols = [];

  if (waku.relay) {
    protocols.push(Protocols.Relay);
  }

  if (waku.filter) {
    protocols.push(Protocols.Filter);
  }

  if (waku.store) {
    protocols.push(Protocols.Store);
  }

  if (waku.lightPush) {
    protocols.push(Protocols.LightPush);
  }

  return protocols;
}
