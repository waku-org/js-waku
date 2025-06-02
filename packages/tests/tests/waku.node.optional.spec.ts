import { enrTree, wakuDnsDiscovery } from "@waku/discovery";
import { LightNode } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";

describe("Use static and several ENR trees for bootstrap", function () {
  let waku: LightNode;

  it("", async function () {
    this.timeout(10_000);

    waku = await createLightNode({
      libp2p: {
        peerDiscovery: [wakuDnsDiscovery([enrTree["SANDBOX"]])]
      }
    });
    await waku.start();

    const peersDiscovered = await waku.libp2p.peerStore.all();

    // 3 from DNS Disc
    expect(peersDiscovered.length).to.eq(3);
  });
});
