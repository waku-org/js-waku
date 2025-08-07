import tests from "@libp2p/interface-compliance-tests/peer-discovery";
import { PeerExchangeDiscovery } from "@waku/discovery";
import type { LightNode } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";

import {
  beforeEachCustom,
  DefaultTestNetworkConfig,
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

describe.only("Peer Exchange", function () {
  describe("Compliance Test", function () {
    this.timeout(100_000);

    let waku: LightNode;
    let nwaku1: ServiceNode;
    let nwaku2: ServiceNode;

    beforeEachCustom(this, async () => {
      nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1");
      nwaku2 = new ServiceNode(makeLogFileName(this.ctx) + "2");

      await nwaku1.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true
      });
      const enr = (await nwaku1.info()).enrUri;

      await nwaku2.start({
        relay: true,
        discv5Discovery: true,
        peerExchange: true,
        discv5BootstrapNode: enr
      });
    });

    tests({
      async setup() {
        waku = await createLightNode({
          networkConfig: DefaultTestNetworkConfig
        });
        await waku.start();

        const nwaku1Ma = await nwaku1.getMultiaddrWithId();
        // const nwaku2Ma = await nwaku2.getMultiaddrWithId();

        const peerExchange = new PeerExchangeDiscovery(waku.libp2p.components);

        peerExchange.addEventListener("peer", (event) => {
          console.log("DEBUG: peer event", event);
        });

        // // @ts-expect-error
        // peerExchange.addEventListener("waku:peer-exchange:started", (event) => {
        //   // @ts-expect-error
        //   if (event.detail === true) {
        //     void waku.libp2p.dialProtocol(
        //       nwaku1Ma,
        //       "/vac/waku/peer-exchange/2.0.0-alpha1"
        //     );
        //   }
        // });
        await waku.libp2p.dial(nwaku1Ma);

        return peerExchange;
      },
      teardown: async () => {
        this.timeout(15_000);
        await tearDownNodes([nwaku1, nwaku2], waku);
      }
    });
  });
});
