import type { IdentifyResult } from "@libp2p/interface";
import type { IBaseProtocol, IRelay, Waku } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import debug from "debug";
import { pEvent } from "p-event";

const log = debug("waku:wait-for-remote-peer");

/**
 * Wait for a remote peer to be ready given the passed protocols.
 * Must be used after attempting to connect to nodes, using
 * {@link @waku/core!WakuNode.dial} or a bootstrap method with
 * {@link @waku/sdk!createLightNode}.
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
    promises.push(waitForConnectedPeer(waku.store));
  }

  if (protocols.includes(Protocols.LightPush)) {
    if (!waku.lightPush)
      throw new Error("Cannot wait for LightPush peer: protocol not mounted");
    promises.push(waitForConnectedPeer(waku.lightPush));
  }

  if (protocols.includes(Protocols.Filter)) {
    if (!waku.filter)
      throw new Error("Cannot wait for Filter peer: protocol not mounted");
    promises.push(waitForConnectedPeer(waku.filter));
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
async function waitForConnectedPeer(protocol: IBaseProtocol): Promise<void> {
  const codec = protocol.multicodec;
  const peers = await protocol.peers();

  if (peers.length) {
    log(`${codec} peer found: `, peers[0].id.toString());
    return;
  }

  await new Promise<void>((resolve) => {
    const cb = (evt: CustomEvent<IdentifyResult>): void => {
      if (evt.detail?.protocols?.includes(codec)) {
        log("Resolving for", codec, evt.detail.protocols);
        protocol.removeLibp2pEventListener("peer:identify", cb);
        resolve();
      }
    };
    protocol.addLibp2pEventListener("peer:identify", cb);
  });
}

/**
 * Wait for at least one peer with the given protocol to be connected and in the gossipsub
 * mesh for all pubSubTopics.
 */
async function waitForGossipSubPeerInMesh(waku: IRelay): Promise<void> {
  let peers = waku.getMeshPeers();
  const pubSubTopics = waku.pubSubTopics;

  for (const topic of pubSubTopics) {
    while (peers.length == 0) {
      await pEvent(waku.gossipSub, "gossipsub:heartbeat");
      peers = waku.getMeshPeers(topic);
    }
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
