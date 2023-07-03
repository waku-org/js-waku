import { CustomEvent } from "@libp2p/interfaces/events";
import { ConnectionManager, KeepAliveOptions } from "@waku/core";
import { LightNode } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";
import sinon, { SinonSpy } from "sinon";

const KEEP_ALIVE_OPTIONS: KeepAliveOptions = {
  pingKeepAlive: 0,
  relayKeepAlive: 5 * 1000,
};
const TEST_TIMEOUT = 10_000;

describe("ConnectionManager", function () {
  let connectionManager: ConnectionManager | undefined;
  let waku: LightNode;
  let peerId: string;

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
});
