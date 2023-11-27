import type { PeerId } from "@libp2p/interface/peer-id";
import type { PeerInfo } from "@libp2p/interface/peer-info";
import { CustomEvent } from "@libp2p/interfaces/events";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";
import { Multiaddr } from "@multiformats/multiaddr";
import {
  EConnectionStateEvents,
  EPeersByDiscoveryEvents,
  LightNode,
  Protocols,
  Tags
} from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";
import sinon, { SinonSpy, SinonStub } from "sinon";

import { delay } from "../dist/delay.js";
import { makeLogFileName, NimGoNode, tearDownNodes } from "../src/index.js";

const TEST_TIMEOUT = 10_000;
const DELAY_MS = 1_000;

describe("ConnectionManager", function () {
  this.timeout(20_000);
  let waku: LightNode;

  beforeEach(async function () {
    waku = await createLightNode();
  });

  afterEach(async () => {
    this.timeout(15000);
    await tearDownNodes([], waku);
  });

  describe("Events", () => {
    describe("peer:discovery", () => {
      it("should emit `peer:discovery:bootstrap` event when a peer is discovered", async function () {
        this.timeout(TEST_TIMEOUT);

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
              multiaddrs: [],
              protocols: []
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
              multiaddrs: [],
              protocols: []
            }
          })
        );

        expect(await peerDiscoveryPeerExchange).to.eq(true);
      });
    });

    describe("peer:connect", () => {
      it("should emit `peer:connected:bootstrap` event when a peer is connected", async function () {
        this.timeout(TEST_TIMEOUT);

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

    describe("peer:disconnect", () => {
      it("should emit `waku:offline` event when all peers disconnect", async function () {
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

        waku.libp2p.dispatchEvent(
          new CustomEvent<PeerId>("peer:connect", { detail: peerIdPx })
        );
        waku.libp2p.dispatchEvent(
          new CustomEvent<PeerId>("peer:connect", { detail: peerIdPx2 })
        );

        await delay(100);

        let eventCount = 0;
        const connectionStatus = new Promise<boolean>((resolve) => {
          waku.connectionManager.addEventListener(
            EConnectionStateEvents.CONNECTION_STATUS,
            ({ detail: status }) => {
              eventCount++;
              resolve(status);
            }
          );
        });

        expect(waku.isConnected()).to.be.true;

        waku.libp2p.dispatchEvent(
          new CustomEvent<PeerId>("peer:disconnect", { detail: peerIdPx })
        );
        waku.libp2p.dispatchEvent(
          new CustomEvent<PeerId>("peer:disconnect", { detail: peerIdPx2 })
        );

        expect(await connectionStatus).to.eq(false);
        expect(eventCount).to.be.eq(1);
      });
      it("isConnected should return false after all peers disconnect", async function () {
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

        waku.libp2p.dispatchEvent(
          new CustomEvent<PeerId>("peer:connect", { detail: peerIdPx })
        );
        waku.libp2p.dispatchEvent(
          new CustomEvent<PeerId>("peer:connect", { detail: peerIdPx2 })
        );

        await delay(100);

        expect(waku.isConnected()).to.be.true;

        waku.libp2p.dispatchEvent(
          new CustomEvent<PeerId>("peer:disconnect", { detail: peerIdPx })
        );
        waku.libp2p.dispatchEvent(
          new CustomEvent<PeerId>("peer:disconnect", { detail: peerIdPx2 })
        );

        expect(waku.isConnected()).to.be.false;
      });
    });
  });

  describe("Dials", () => {
    let dialPeerStub: SinonStub;
    let getConnectionsStub: SinonStub;
    let getTagNamesForPeerStub: SinonStub;
    let isPeerTopicConfigured: SinonStub;
    let waku: LightNode;

    this.beforeEach(async function () {
      this.timeout(15000);
      waku = await createLightNode();
      isPeerTopicConfigured = sinon.stub(
        waku.connectionManager as any,
        "isPeerTopicConfigured"
      );
      isPeerTopicConfigured.resolves(true);
    });

    afterEach(async () => {
      this.timeout(15000);
      await tearDownNodes([], waku);
      isPeerTopicConfigured.restore();
      sinon.restore();
    });

    describe("attemptDial method", function () {
      let attemptDialSpy: SinonSpy;

      beforeEach(function () {
        attemptDialSpy = sinon.spy(
          waku.connectionManager as any,
          "attemptDial"
        );
      });

      afterEach(function () {
        attemptDialSpy.restore();
      });

      it("should be called at least once on all `peer:discovery` events", async function () {
        this.timeout(TEST_TIMEOUT);

        const totalPeerIds = 5;
        for (let i = 1; i <= totalPeerIds; i++) {
          waku.libp2p.dispatchEvent(
            new CustomEvent<PeerInfo>("peer:discovery", {
              detail: {
                id: await createSecp256k1PeerId(),
                multiaddrs: [],
                protocols: []
              }
            })
          );
        }

        await delay(100);

        expect(attemptDialSpy.callCount).to.be.greaterThanOrEqual(
          totalPeerIds,
          "attemptDial should be called at least once for each peer:discovery event"
        );
      });
    });

    describe("dialPeer method", function () {
      let peerStoreHasStub: SinonStub;
      let dialAttemptsForPeerHasStub: SinonStub;
      beforeEach(function () {
        getConnectionsStub = sinon.stub(
          (waku.connectionManager as any).libp2p,
          "getConnections"
        );
        getTagNamesForPeerStub = sinon.stub(
          waku.connectionManager as any,
          "getTagNamesForPeer"
        );
        dialPeerStub = sinon.stub(waku.connectionManager as any, "dialPeer");
        peerStoreHasStub = sinon.stub(waku.libp2p.peerStore, "has");
        dialAttemptsForPeerHasStub = sinon.stub(
          (waku.connectionManager as any).dialAttemptsForPeer,
          "has"
        );

        // simulate that the peer is not connected
        getConnectionsStub.returns([]);

        // simulate that the peer is a bootstrap peer
        getTagNamesForPeerStub.resolves([Tags.BOOTSTRAP]);

        // simulate that the peer is not in the peerStore
        peerStoreHasStub.returns(false);

        // simulate that the peer has not been dialed before
        dialAttemptsForPeerHasStub.returns(false);
      });

      afterEach(function () {
        dialPeerStub.restore();
        getTagNamesForPeerStub.restore();
        getConnectionsStub.restore();
        peerStoreHasStub.restore();
        dialAttemptsForPeerHasStub.restore();
      });

      describe("For bootstrap peers", function () {
        it("should be called for bootstrap peers", async function () {
          this.timeout(TEST_TIMEOUT);

          const bootstrapPeer = await createSecp256k1PeerId();

          // emit a peer:discovery event
          waku.libp2p.dispatchEvent(
            new CustomEvent<PeerInfo>("peer:discovery", {
              detail: { id: bootstrapPeer, multiaddrs: [], protocols: [] }
            })
          );

          // wait for the async function calls within attemptDial to finish
          await delay(DELAY_MS);

          // check that dialPeer was called once
          expect(dialPeerStub.callCount).to.equal(
            1,
            "dialPeer should be called for bootstrap peers"
          );
        });

        it("should not be called more than DEFAULT_MAX_BOOTSTRAP_PEERS_ALLOWED times for bootstrap peers", async function () {
          this.timeout(TEST_TIMEOUT);

          // emit first peer:discovery event
          waku.libp2p.dispatchEvent(
            new CustomEvent<PeerInfo>("peer:discovery", {
              detail: {
                id: await createSecp256k1PeerId(),
                multiaddrs: [],
                protocols: []
              }
            })
          );
          await delay(500);

          // simulate that the peer is connected
          getConnectionsStub.returns([{ tags: [{ name: Tags.BOOTSTRAP }] }]);

          // emit multiple peer:discovery events
          const totalBootstrapPeers = 5;
          for (let i = 1; i <= totalBootstrapPeers; i++) {
            await delay(500);
            waku.libp2p.dispatchEvent(
              new CustomEvent<PeerInfo>("peer:discovery", {
                detail: {
                  id: await createSecp256k1PeerId(),
                  multiaddrs: [],
                  protocols: []
                }
              })
            );
          }

          // check that dialPeer was called only once
          expect(dialPeerStub.callCount).to.equal(
            1,
            "dialPeer should not be called more than once for bootstrap peers"
          );
        });
      });

      describe("For peer-exchange peers", function () {
        it("should be called for peers with PEER_EXCHANGE tags", async function () {
          this.timeout(TEST_TIMEOUT);

          const pxPeer = await createSecp256k1PeerId();

          // emit a peer:discovery event
          waku.libp2p.dispatchEvent(
            new CustomEvent<PeerInfo>("peer:discovery", {
              detail: {
                id: pxPeer,
                multiaddrs: [],
                protocols: []
              }
            })
          );

          // wait for the async function calls within attemptDial to finish
          await delay(DELAY_MS);

          // check that dialPeer was called once
          expect(dialPeerStub.callCount).to.equal(
            1,
            "dialPeer should be called for peers with PEER_EXCHANGE tags"
          );
        });

        it("should be called for every peer with PEER_EXCHANGE tags", async function () {
          this.timeout(TEST_TIMEOUT);

          // emit multiple peer:discovery events
          const totalPxPeers = 5;
          for (let i = 0; i < totalPxPeers; i++) {
            waku.libp2p.dispatchEvent(
              new CustomEvent<PeerInfo>("peer:discovery", {
                detail: {
                  id: await createSecp256k1PeerId(),
                  multiaddrs: [],
                  protocols: []
                }
              })
            );
            await delay(500);
          }

          // check that dialPeer was called for each peer with PEER_EXCHANGE tags
          expect(dialPeerStub.callCount).to.equal(totalPxPeers);
        });
      });
    });
  });

  describe("Connection state", () => {
    this.timeout(20_000);
    let nwaku1: NimGoNode;
    let nwaku2: NimGoNode;
    let nwaku1PeerId: Multiaddr;
    let nwaku2PeerId: Multiaddr;

    beforeEach(async () => {
      this.timeout(20_000);
      nwaku1 = new NimGoNode(makeLogFileName(this.ctx) + "1");
      nwaku2 = new NimGoNode(makeLogFileName(this.ctx) + "2");
      await nwaku1.start({
        filter: true
      });

      await nwaku2.start({
        filter: true
      });

      nwaku1PeerId = await nwaku1.getMultiaddrWithId();
      nwaku2PeerId = await nwaku2.getMultiaddrWithId();
    });

    afterEach(async () => {
      this.timeout(15000);
      await tearDownNodes([nwaku1, nwaku2], []);
    });

    it("should emit `waku:online` event only when first peer is connected", async function () {
      this.timeout(20_000);

      let eventCount = 0;
      const connectionStatus = new Promise<boolean>((resolve) => {
        waku.connectionManager.addEventListener(
          EConnectionStateEvents.CONNECTION_STATUS,
          ({ detail: status }) => {
            eventCount++;
            resolve(status);
          }
        );
      });

      // await waku.start();
      await waku.dial(nwaku1PeerId, [Protocols.Filter]);
      await waku.dial(nwaku2PeerId, [Protocols.Filter]);

      await delay(250);

      expect(await connectionStatus).to.eq(true);
      expect(eventCount).to.be.eq(1);
    });

    it("isConnected should return true after first peer connects", async function () {
      this.timeout(20_000);
      expect(waku.isConnected()).to.be.false;

      // await waku.start();
      await waku.dial(nwaku1PeerId, [Protocols.Filter]);
      await waku.dial(nwaku2PeerId, [Protocols.Filter]);

      await delay(250);

      expect(waku.isConnected()).to.be.true;
    });

    it("should emit `waku:offline` event only when all peers disconnect", async function () {
      this.timeout(20_000);
      expect(waku.isConnected()).to.be.false;

      await waku.dial(nwaku1PeerId, [Protocols.Filter]);
      await waku.dial(nwaku2PeerId, [Protocols.Filter]);

      await delay(250);

      let eventCount = 0;
      const connectionStatus = new Promise<boolean>((resolve) => {
        waku.connectionManager.addEventListener(
          EConnectionStateEvents.CONNECTION_STATUS,
          ({ detail: status }) => {
            eventCount++;
            resolve(status);
          }
        );
      });

      await waku.libp2p.hangUp(nwaku1PeerId);
      await waku.libp2p.hangUp(nwaku2PeerId);
      expect(await connectionStatus).to.eq(false);
      expect(eventCount).to.be.eq(1);
    });

    it("isConnected should return false after all peers disconnect", async function () {
      this.timeout(20_000);
      expect(waku.isConnected()).to.be.false;

      await waku.dial(nwaku1PeerId, [Protocols.Filter]);
      await waku.dial(nwaku2PeerId, [Protocols.Filter]);

      await delay(250);
      expect(waku.isConnected()).to.be.true;

      await waku.libp2p.hangUp(nwaku1PeerId);
      await waku.libp2p.hangUp(nwaku2PeerId);
      expect(waku.isConnected()).to.be.false;
    });
  });
});
