import type { PeerId } from "@libp2p/interface-peer-id";
import { createLightNode } from "@waku/create";
import type { WakuLight } from "@waku/interfaces";
import { expect } from "chai";

describe("Waku Dial", function () {
  describe("Bootstrap [live data]", function () {
    let waku: WakuLight;

    afterEach(function () {
      !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
    });

    before(function () {
      if (process.env.CI) {
        this.skip();
      }
    });

    it("Enabling default [live data]", async function () {
      // This test depends on fleets.status.im being online.
      // This dependence must be removed once DNS discovery is implemented
      this.timeout(20_000);

      waku = await createLightNode({
        defaultBootstrap: true,
      });
      await waku.start();

      const connectedPeerID: PeerId = await new Promise((resolve) => {
        waku.libp2p.connectionManager.addEventListener(
          "peer:connect",
          (evt) => {
            resolve(evt.detail.remotePeer);
          }
        );
      });

      expect(connectedPeerID).to.not.be.undefined;
    });
  });
});
