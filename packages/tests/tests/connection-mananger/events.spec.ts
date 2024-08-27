import type { PeerId, PeerInfo } from "@libp2p/interface";
import { CustomEvent, TypedEventEmitter } from "@libp2p/interface";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";
import {
  EConnectionStateEvents,
  EPeersByDiscoveryEvents,
  LightNode,
  Tags
} from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";

import { afterEachCustom, beforeEachCustom, delay } from "../../src/index.js";
import { tearDownNodes } from "../../src/index.js";

const TEST_TIMEOUT = 20_000;

describe("Events", function () {
  let waku: LightNode;
  this.timeout(TEST_TIMEOUT);
  beforeEachCustom(this, async () => {
    waku = await createLightNode();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([], waku);
  });

  describe("peer:discovery", () => {
    it("should emit `peer:discovery:bootstrap` event when a peer is discovered", async function () {
      const peerIdBootstrap = await createSecp256k1PeerId();

      await waku.libp2p.peerStore.save(peerIdBootstrap, {
        tags: {
          [Tags.BOOTSTRAP]: {
            value: 50,
            ttl: 1200000
          }
        }
      });

      const peerDiscoveryBootstrap = new Promise<boolean>((resolve) => {
        waku.connectionManager.addEventListener(
          EPeersByDiscoveryEvents.PEER_DISCOVERY_BOOTSTRAP,
          ({ detail: receivedPeerId }) => {
            resolve(receivedPeerId.toString() === peerIdBootstrap.toString());
          }
        );
      });

      waku.libp2p.dispatchEvent(
        new CustomEvent<PeerInfo>("peer:discovery", {
          detail: {
            id: peerIdBootstrap,
            multiaddrs: []
          }
        })
      );

      expect(await peerDiscoveryBootstrap).to.eq(true);
    });

    it("should emit `peer:discovery:peer-exchange` event when a peer is discovered", async function () {
      const peerIdPx = await createSecp256k1PeerId();

      await waku.libp2p.peerStore.save(peerIdPx, {
        tags: {
          [Tags.PEER_EXCHANGE]: {
            value: 50,
            ttl: 1200000
          }
        }
      });

      const peerDiscoveryPeerExchange = new Promise<boolean>((resolve) => {
        waku.connectionManager.addEventListener(
          EPeersByDiscoveryEvents.PEER_DISCOVERY_PEER_EXCHANGE,
          ({ detail: receivedPeerId }) => {
            resolve(receivedPeerId.toString() === peerIdPx.toString());
          }
        );
      });

      waku.libp2p.dispatchEvent(
        new CustomEvent<PeerInfo>("peer:discovery", {
          detail: {
            id: peerIdPx,
            multiaddrs: []
          }
        })
      );

      expect(await peerDiscoveryPeerExchange).to.eq(true);
    });
  });

  describe("peer:connect", () => {
    it("should emit `peer:connected:bootstrap` event when a peer is connected", async function () {
      const peerIdBootstrap = await createSecp256k1PeerId();

      await waku.libp2p.peerStore.save(peerIdBootstrap, {
        tags: {
          [Tags.BOOTSTRAP]: {
            value: 50,
            ttl: 1200000
          }
        }
      });

      const peerConnectedBootstrap = new Promise<boolean>((resolve) => {
        waku.connectionManager.addEventListener(
          EPeersByDiscoveryEvents.PEER_CONNECT_BOOTSTRAP,
          ({ detail: receivedPeerId }) => {
            resolve(receivedPeerId.toString() === peerIdBootstrap.toString());
          }
        );
      });

      waku.libp2p.dispatchEvent(
        new CustomEvent<PeerId>("peer:connect", { detail: peerIdBootstrap })
      );

      expect(await peerConnectedBootstrap).to.eq(true);
    });
    it("should emit `peer:connected:peer-exchange` event when a peer is connected", async function () {
      const peerIdPx = await createSecp256k1PeerId();

      await waku.libp2p.peerStore.save(peerIdPx, {
        tags: {
          [Tags.PEER_EXCHANGE]: {
            value: 50,
            ttl: 1200000
          }
        }
      });

      const peerConnectedPeerExchange = new Promise<boolean>((resolve) => {
        waku.connectionManager.addEventListener(
          EPeersByDiscoveryEvents.PEER_CONNECT_PEER_EXCHANGE,
          ({ detail: receivedPeerId }) => {
            resolve(receivedPeerId.toString() === peerIdPx.toString());
          }
        );
      });

      waku.libp2p.dispatchEvent(
        new CustomEvent<PeerId>("peer:connect", { detail: peerIdPx })
      );

      expect(await peerConnectedPeerExchange).to.eq(true);
    });
  });

  describe(EConnectionStateEvents.CONNECTION_STATUS, function () {
    let navigatorMock;

    this.beforeEach(() => {
      navigatorMock = { onLine: true };

      // @ts-expect-error: mocking readonly
      globalThis.navigator = navigatorMock;

      const eventEmmitter = new TypedEventEmitter();
      globalThis.addEventListener =
        eventEmmitter.addEventListener.bind(eventEmmitter);
      globalThis.removeEventListener =
        eventEmmitter.removeEventListener.bind(eventEmmitter);
      globalThis.dispatchEvent =
        eventEmmitter.dispatchEvent.bind(eventEmmitter);
    });

    this.afterEach(() => {
      // @ts-expect-error: resetting set value
      globalThis.navigator = undefined;
      // @ts-expect-error: resetting set value
      globalThis.addEventListener = undefined;
      // @ts-expect-error: resetting set value
      globalThis.removeEventListener = undefined;
      // @ts-expect-error: resetting set value
      globalThis.dispatchEvent = undefined;
    });

    it(`should emit events and trasition isConnected state when has peers or no peers`, async function () {
      const peerIdPx = await createSecp256k1PeerId();
      const peerIdPx2 = await createSecp256k1PeerId();

      await waku.libp2p.peerStore.save(peerIdPx, {
        tags: {
          [Tags.PEER_EXCHANGE]: {
            value: 50,
            ttl: 1200000
          }
        }
      });

      await waku.libp2p.peerStore.save(peerIdPx2, {
        tags: {
          [Tags.PEER_EXCHANGE]: {
            value: 50,
            ttl: 1200000
          }
        }
      });

      let eventCount = 0;
      const connectedStatus = new Promise<boolean>((resolve) => {
        waku.connectionManager.addEventListener(
          EConnectionStateEvents.CONNECTION_STATUS,
          ({ detail: status }) => {
            eventCount++;
            resolve(status);
          }
        );
      });

      waku.libp2p.dispatchEvent(
        new CustomEvent<PeerId>("peer:connect", { detail: peerIdPx })
      );
      waku.libp2p.dispatchEvent(
        new CustomEvent<PeerId>("peer:connect", { detail: peerIdPx2 })
      );

      await delay(100);

      expect(waku.isConnected()).to.be.true;
      expect(await connectedStatus).to.eq(true);
      expect(eventCount).to.be.eq(1);

      const disconnectedStatus = new Promise<boolean>((resolve) => {
        waku.connectionManager.addEventListener(
          EConnectionStateEvents.CONNECTION_STATUS,
          ({ detail: status }) => {
            resolve(status);
          }
        );
      });

      waku.libp2p.dispatchEvent(
        new CustomEvent<PeerId>("peer:disconnect", { detail: peerIdPx })
      );
      waku.libp2p.dispatchEvent(
        new CustomEvent<PeerId>("peer:disconnect", { detail: peerIdPx2 })
      );

      expect(waku.isConnected()).to.be.false;
      expect(await disconnectedStatus).to.eq(false);
      expect(eventCount).to.be.eq(2);
    });

    it("should be online or offline if network state changed", async function () {
      // have to recreate js-waku for it to pick up new globalThis
      waku = await createLightNode();

      const peerIdPx = await createSecp256k1PeerId();

      await waku.libp2p.peerStore.save(peerIdPx, {
        tags: {
          [Tags.PEER_EXCHANGE]: {
            value: 50,
            ttl: 1200000
          }
        }
      });

      let eventCount = 0;
      const connectedStatus = new Promise<boolean>((resolve) => {
        waku.connectionManager.addEventListener(
          EConnectionStateEvents.CONNECTION_STATUS,
          ({ detail: status }) => {
            console.log(
              "evnet#1",
              status,
              waku.libp2p.getConnections().length,
              globalThis.navigator.onLine
            );
            eventCount++;
            resolve(status);
          }
        );
      });

      waku.libp2p.dispatchEvent(
        new CustomEvent<PeerId>("peer:connect", { detail: peerIdPx })
      );

      await delay(100);

      console.log("#1");
      expect(waku.isConnected()).to.be.true;
      console.log("#2");
      expect(await connectedStatus).to.eq(true);
      console.log("#3");
      expect(eventCount).to.be.eq(1);

      const disconnectedStatus = new Promise<boolean>((resolve) => {
        waku.connectionManager.addEventListener(
          EConnectionStateEvents.CONNECTION_STATUS,
          ({ detail: status }) => {
            console.log("evnet#2", status);
            resolve(status);
          }
        );
      });

      navigatorMock.onLine = false;
      globalThis.dispatchEvent(new CustomEvent("offline"));

      await delay(100);

      console.log("#4");
      expect(waku.isConnected()).to.be.false;
      console.log("#5");
      expect(await disconnectedStatus).to.eq(false);
      console.log("#6");
      expect(eventCount).to.be.eq(2);

      const connectionRecoveredStatus = new Promise<boolean>((resolve) => {
        waku.connectionManager.addEventListener(
          EConnectionStateEvents.CONNECTION_STATUS,
          ({ detail: status }) => {
            console.log("evnet#3", status);
            resolve(status);
          }
        );
      });

      navigatorMock.onLine = true;
      globalThis.dispatchEvent(new CustomEvent("online"));

      await delay(100);

      console.log("#7");
      expect(waku.isConnected()).to.be.false;
      console.log("#8");
      expect(await connectionRecoveredStatus).to.eq(true);
      console.log("#9");
      expect(eventCount).to.be.eq(3);
    });
  });
});
