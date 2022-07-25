import { PeerProtocolsChangeData } from "@libp2p/interface-peer-store";
import debug from "debug";

import { StoreCodecs } from "./constants";
import { Protocols, Waku } from "./waku";
import { FilterCodec } from "./waku_filter";
import { LightPushCodec } from "./waku_light_push";

const log = debug("waku:wait-for-remote-peer");

/**
 * Wait for a remote peer to be ready given the passed protocols.
 * Useful when using the [[CreateOptions.bootstrap]] with [[Waku.create]].
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

  const promises: Promise<void>[] = [];

  if (protocols.includes(Protocols.Relay)) {
    const peers = waku.relay.getMeshPeers(waku.relay.pubSubTopic);

    if (peers.length == 0) {
      // No peer yet available, wait for a subscription
      const promise = new Promise<void>((resolve) => {
        // TODO: Remove listeners once done
        waku.relay.addEventListener("subscription-change", () => {
          // Remote peer subscribed to topic, now wait for a heartbeat
          // so that the mesh is updated and the remote peer added to it
          waku.relay.addEventListener("gossipsub:heartbeat", () => resolve());
        });
      });
      promises.push(promise);
    }
  }

  // TODO: This can be factored in one helper function
  // Probably need to add a "string" protocol to each class to make it easier
  if (protocols.includes(Protocols.Store)) {
    const storePromise = (async (): Promise<void> => {
      const peers = await waku.store.peers();

      if (peers.length) {
        log("Store peer found: ", peers[0].id.toString());
        return;
      }

      await new Promise<void>((resolve) => {
        const cb = (evt: CustomEvent<PeerProtocolsChangeData>): void => {
          for (const codec of Object.values(StoreCodecs)) {
            if (evt.detail.protocols.includes(codec)) {
              log("Resolving for", StoreCodecs, evt.detail.protocols);
              waku.libp2p.peerStore.removeEventListener("change:protocols", cb);
              resolve();
              break;
            }
          }
        };
        waku.libp2p.peerStore.addEventListener("change:protocols", cb);
      });
    })();
    promises.push(storePromise);
  }

  if (protocols.includes(Protocols.LightPush)) {
    const lightPushPromise = (async (): Promise<void> => {
      const peers = await waku.lightPush.peers();

      if (peers.length) {
        log("Light Push peer found: ", peers[0].id.toString());
        return;
      }

      await new Promise<void>((resolve) => {
        const cb = (evt: CustomEvent<PeerProtocolsChangeData>): void => {
          if (evt.detail.protocols.includes(LightPushCodec)) {
            log("Resolving for", LightPushCodec, evt.detail.protocols);
            waku.libp2p.peerStore.removeEventListener("change:protocols", cb);
            resolve();
          }
        };
        waku.libp2p.peerStore.addEventListener("change:protocols", cb);
      });
    })();
    promises.push(lightPushPromise);
  }

  if (protocols.includes(Protocols.Filter)) {
    const filterPromise = (async (): Promise<void> => {
      const peers = await waku.filter.peers();

      if (peers.length) {
        log("Filter peer found: ", peers[0].id.toString());
        return;
      }

      await new Promise<void>((resolve) => {
        const cb = (evt: CustomEvent<PeerProtocolsChangeData>): void => {
          if (evt.detail.protocols.includes(FilterCodec)) {
            log("Resolving for", FilterCodec, evt.detail.protocols);
            waku.libp2p.peerStore.removeEventListener("change:protocols", cb);
            resolve();
          }
        };
        waku.libp2p.peerStore.addEventListener("change:protocols", cb);
      });
    })();
    promises.push(filterPromise);
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

const awaitTimeout = (ms: number, rejectReason: string): Promise<void> =>
  new Promise((_resolve, reject) => setTimeout(() => reject(rejectReason), ms));

async function rejectOnTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  rejectReason: string
): Promise<void> {
  await Promise.race([promise, awaitTimeout(timeoutMs, rejectReason)]);
}
