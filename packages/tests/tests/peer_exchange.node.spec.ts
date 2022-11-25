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

  it.only("Queries successfully", async function () {
    this.timeout(150_000);

    console.log("starting");
    nwaku1 = new Nwaku(makeLogFileName(this));
    nwaku2 = new Nwaku(makeLogFileName(this));
    nwaku3 = new Nwaku(makeLogFileName(this));

    await nwaku2.start({ discv5Discovery: true, peerExchange: true });
    console.log("nwaku2 started");

    const enr = (await nwaku2.info()).enrUri;
    console.log({ enr });

    await nwaku1.start({
      discv5Discovery: true,
      manualArgs: [
        `--discv5-bootstrap-node:${(await nwaku2.info()).enrUri}`,
        `--ports-shift=5`,
      ],
    });
    console.log("nwaku1 started");

    await nwaku3.start({
      discv5Discovery: true,
      manualArgs: [
        `--discv5-bootstrap-node:${(await nwaku2.info()).enrUri}`,
        `--ports-shift=10`,
      ],
    });

    waku = await createLightNode();
    console.log("created light node");
    await waku.start();
    console.log("started light node");

    await delay(1000);

    const mulltiaddr = await nwaku2.getMultiaddrWithId();

    await waku.dial(mulltiaddr, [Protocols.PeerExchange]);
    console.log("dialed");

    await waitForRemotePeer(waku, [Protocols.PeerExchange]);
    console.log("waited");

    await delay(3000);

    try {
      const queryResponse = await waku.peerExchange.query({
        numPeers: BigInt(1),
      });
      console.log({ queryResponse });
    } catch (error) {
      console.error(error);
    }
  });
});
