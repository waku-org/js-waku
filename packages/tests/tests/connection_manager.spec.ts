import { CustomEvent } from "@libp2p/interfaces/events";
import { ConnectionManager, KeepAliveOptions } from "@waku/core";
import { LightNode, Tags } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";
import sinon, { SinonSpy, SinonStub } from "sinon";

import { delay } from "../dist/delay.js";

const KEEP_ALIVE_OPTIONS: KeepAliveOptions = {
  pingKeepAlive: 0,
  relayKeepAlive: 5 * 1000,
};
const TEST_TIMEOUT = 10_000;
const DELAY_MS = 1_000;

describe("ConnectionManager", function () {
  let connectionManager: ConnectionManager | undefined;
  let waku: LightNode;
  let peerId: string;
  let getConnectionsStub: SinonStub;
  let getTagNamesForPeerStub: SinonStub;
  let dialPeerStub: SinonStub;

  beforeEach(async function () {
    waku = await createLightNode();
    peerId = Math.random().toString(36).substring(7);
    connectionManager = ConnectionManager.create(
      peerId,
      waku.libp2p,
      KEEP_ALIVE_OPTIONS
    );
  });

  afterEach(async () => {
    await waku.stop();
    sinon.restore();
  });

  describe("attemptDial method", function () {
    let attemptDialSpy: SinonSpy;

    beforeEach(function () {
      attemptDialSpy = sinon.spy(connectionManager as any, "attemptDial");
    });

    afterEach(function () {
      attemptDialSpy.restore();
    });

    it("should be called on all `peer:discovery` events", async function () {
      this.timeout(TEST_TIMEOUT);

      const totalPeerIds = 1;
      for (let i = 1; i <= totalPeerIds; i++) {
        waku.libp2p.dispatchEvent(
          new CustomEvent("peer:discovery", { detail: `peer-id-${i}` })
        );
      }

      expect(attemptDialSpy.callCount).to.equal(
        totalPeerIds,
        "attemptDial should be called once for each peer:discovery event"
      );
    });
  });

  describe("dialPeer method", function () {
    beforeEach(function () {
      getConnectionsStub = sinon.stub(
        (connectionManager as any).libp2pComponents,
        "getConnections"
      );
      getTagNamesForPeerStub = sinon.stub(
        connectionManager as any,
        "getTagNamesForPeer"
      );
      dialPeerStub = sinon.stub(connectionManager as any, "dialPeer");
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

        // emit a peer:discovery event
        waku.libp2p.dispatchEvent(
          new CustomEvent("peer:discovery", { detail: "bootstrap-peer" })
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

        // simulate that the peer is connected
        getConnectionsStub.returns([{ tags: [{ name: Tags.BOOTSTRAP }] }]);

        // emit multiple peer:discovery events
        const totalBootstrapPeers = 5;
        for (let i = 1; i <= totalBootstrapPeers; i++) {
          await delay(500);
          waku.libp2p.dispatchEvent(
            new CustomEvent("peer:discovery", {
              detail: `bootstrap-peer-id-${i}`,
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

        // emit a peer:discovery event
        waku.libp2p.dispatchEvent(
          new CustomEvent("peer:discovery", { detail: "px-peer" })
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
            new CustomEvent("peer:discovery", { detail: `px-peer-id-${i}` })
          );
          await delay(500);
        }

        // check that dialPeer was called for each peer with PEER_EXCHANGE tags
        expect(dialPeerStub.callCount).to.equal(totalPxPeers);
      });
    });
  });
});
