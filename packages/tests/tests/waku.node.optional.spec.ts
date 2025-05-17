import { enrTree, wakuDnsDiscovery } from "@waku/discovery";
import { LightNode } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";

describe("Use static and several ENR trees for bootstrap", function () {
  let waku: LightNode;

  it("", async function () {
    this.timeout(10_000);

    const NODE_REQUIREMENTS = {
      store: 3,
      lightPush: 3,
      filter: 3
    };

    waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          wakuDnsDiscovery([enrTree["SANDBOX"]], NODE_REQUIREMENTS)
        ]
      }
    });
    await waku.start();

    const peersDiscovered = await waku.libp2p.peerStore.all();

    // 3 from DNS Disc
    expect(peersDiscovered.length).to.eq(3);
  });
});
