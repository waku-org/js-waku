import { waitForRemotePeer } from "@waku/core/lib/wait_for_remote_peer";
import { createLightNode } from "@waku/create";
import type { WakuLight } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";

import { makeLogFileName, Nwaku } from "../src";
import { delay } from "../src/delay";

describe("Peer Exchange: Node", () => {
  let waku: WakuLight;
  let nwaku1: Nwaku;
  let nwaku2: Nwaku;
  let nwaku3: Nwaku;

  afterEach(async function () {
    !!nwaku1 && nwaku1.stop();
    !!nwaku2 && nwaku2.stop();
    !!nwaku3 && nwaku3.stop();
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Queries successfully", async function () {
    this.timeout(15_000);

    console.log("starting");
    nwaku1 = new Nwaku(makeLogFileName(this));
    nwaku2 = new Nwaku(makeLogFileName(this));
    nwaku3 = new Nwaku(makeLogFileName(this));

    await nwaku2.start({ discv5Discovery: true, peerExchange: true });
    console.log("nwaku2 started");

    const nwaku2Enr = (await nwaku2.info()).enrUri;

    if (!nwaku2Enr) {
      throw new Error("No ENR");
    }

    await nwaku1.start({
      discv5Discovery: true,
      discv5BootstrapNode: nwaku2Enr,
    });
    console.log("nwaku1 started");

    await nwaku3.start({
      discv5Discovery: true,
      discv5BootstrapNode: nwaku2Enr,
    });

    waku = await createLightNode();
    console.log("created light node");
    await waku.start();
    console.log("started light node");

    await delay(1000);

    const multiaddr = await nwaku2.getMultiaddrWithId();

    await waku.dial(multiaddr, [Protocols.PeerExchange]);
    console.log("dialed");

    await waitForRemotePeer(waku, [Protocols.PeerExchange]);
    console.log("waited");

    await delay(3000);

    try {
      const queryResponse = await waku.peerExchange.query({
        numPeers: 1,
      });
      console.log({ queryResponse });
    } catch (error) {
      console.error(error);
    }
  });
});
