import { CustomEvent } from "@libp2p/interfaces/events";
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory";
import { EPeersByDiscoveryEvents, LightNode, Tags } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";
import sinon, { SinonSpy, SinonStub } from "sinon";

import { delay } from "../dist/delay";

const TEST_TIMEOUT = 10_000;
const DELAY_MS = 1_000;

describe("ConnectionManager", function () {
  let waku: LightNode;

  beforeEach(async function () {
    waku = await createLightNode();
  });

  afterEach(async () => {
    await waku.stop();
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
          new CustomEvent("peer", { detail: await createSecp256k1PeerId() })
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
          new CustomEvent("peer", { detail: peerIdPx })
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
          new CustomEvent("peer:connect", { detail: peerIdBootstrap })
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
          new CustomEvent("peer:connect", { detail: peerIdPx })
        );

        expect(await peerConnectedPeerExchange).to.eq(true);
      });
    });
  });

  describe("Dials", () => {
    let dialPeerStub: SinonStub;
    let getConnectionsStub: SinonStub;
    let getTagNamesForPeerStub: SinonStub;
    let waku: LightNode;

    this.beforeEach(async function () {
      waku = await createLightNode();
    });

    afterEach(async () => {
      await waku.stop();
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

      it("should be called on all `peer:discovery` events", async function () {
        this.timeout(TEST_TIMEOUT);

        const totalPeerIds = 5;
        for (let i = 1; i <= totalPeerIds; i++) {
          waku.libp2p.dispatchEvent(
            new CustomEvent("peer:discovery", { detail: `peer-id-${i}` })
          );
        }

        // add delay to allow async function calls within attemptDial to finish
        await delay(100);

        expect(attemptDialSpy.callCount).to.equal(
          totalPeerIds,
          "attemptDial should be called once for each peer:discovery event"
        );
      });
    });

    describe("dialPeer method", function () {
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
      });

      afterEach(function () {
        dialPeerStub.restore();
        getTagNamesForPeerStub.restore();
        getConnectionsStub.restore();
      });

      describe("For bootstrap peers", function () {
        it("should be called for bootstrap peers", async function () {
          this.timeout(TEST_TIMEOUT);

          // simulate that the peer is not connected
          getConnectionsStub.returns([]);

          // simulate that the peer is a bootstrap peer
          getTagNamesForPeerStub.resolves([Tags.BOOTSTRAP]);

          const bootstrapPeer = await createSecp256k1PeerId();

          // emit a peer:discovery event
          waku.libp2p.dispatchEvent(
            new CustomEvent("peer:discovery", { detail: bootstrapPeer })
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

          // simulate that the peer is not connected
          getConnectionsStub.returns([]);

          // simulate that the peer is a bootstrap peer
          getTagNamesForPeerStub.resolves([Tags.BOOTSTRAP]);

          // emit first peer:discovery event
          waku.libp2p.dispatchEvent(
            new CustomEvent("peer:discovery", { detail: "bootstrap-peer" })
          );
          await delay(500);

          // simulate that the peer is connected
          getConnectionsStub.returns([{ tags: [{ name: Tags.BOOTSTRAP }] }]);

          // emit multiple peer:discovery events
          const totalBootstrapPeers = 5;
          for (let i = 1; i <= totalBootstrapPeers; i++) {
            await delay(500);
            waku.libp2p.dispatchEvent(
              new CustomEvent("peer:discovery", {
                detail: await createSecp256k1PeerId()
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

          // simulate that the peer is not connected
          getConnectionsStub.returns([]);

          // simulate that the peer has a PEER_EXCHANGE tag
          getTagNamesForPeerStub.resolves([Tags.PEER_EXCHANGE]);

          const pxPeer = await createSecp256k1PeerId();

          // emit a peer:discovery event
          waku.libp2p.dispatchEvent(
            new CustomEvent("peer:discovery", { detail: pxPeer })
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

          // simulate that the peer is not connected
          getConnectionsStub.returns([]);

          // simulate that the peer has a PEER_EXCHANGE tag
          getTagNamesForPeerStub.resolves([Tags.PEER_EXCHANGE]);

          // emit multiple peer:discovery events
          const totalPxPeers = 5;
          for (let i = 0; i < totalPxPeers; i++) {
            waku.libp2p.dispatchEvent(
              new CustomEvent("peer:discovery", {
                detail: await createSecp256k1PeerId()
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
});
