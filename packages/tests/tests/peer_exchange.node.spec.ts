import { waitForRemotePeer } from "@waku/core/lib/wait_for_remote_peer";
import { createLightNode } from "@waku/create";
import type { WakuLight } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";

import { makeLogFileName, Nwaku } from "../src";

describe("Peer Exchange: Node", () => {
  let waku: WakuLight;
  let nwaku: Nwaku;

  afterEach(async function () {
    !!nwaku && nwaku.stop();
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Queries successfully", async function () {
    this.timeout(55_000);

    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ peerExchange: true, discv5Discovery: true });

    waku = await createLightNode();
    await waku.start();

    const mulltiaddr = await nwaku.getMultiaddrWithId();
    await waku.dial(mulltiaddr, [Protocols.PeerExchange]);

    try {
      await waitForRemotePeer(waku, [Protocols.PeerExchange]);
      console.log("waited");
    } catch (error) {
      console.error(error);
    }
    console.log("remote peer found");
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
