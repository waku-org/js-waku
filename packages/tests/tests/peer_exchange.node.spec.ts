import { waitForRemotePeer } from "@waku/core/lib/wait_for_remote_peer";
import { createFullNode } from "@waku/create";
import type { PeerExchangeResponse, WakuFull } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";

import { makeLogFileName, NOISE_KEY_1, Nwaku } from "../src";
import { delay } from "../src/delay";

describe("Peer Exchange: Node", () => {
  let waku: WakuFull;
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
    nwaku1 = new Nwaku(`node1_${makeLogFileName(this)}`);
    nwaku2 = new Nwaku(`node2_${makeLogFileName(this)}`);
    nwaku3 = new Nwaku(`node3_${makeLogFileName(this)}`);

    await nwaku1.start({
      discv5Discovery: true,
      peerExchange: true,
    });
    console.log("nwaku1 started");

    await delay(10000);

    const enr = (await nwaku1.info()).enrUri;
    console.log({ enr });

    await nwaku2.start({
      discv5Discovery: true,
    });
    console.log("nwaku2 started");

    await delay(10000);

    await nwaku3.start({
      discv5Discovery: true,
    });
    console.log("nwaku3 started");

    await delay(40000);

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
    });

    console.log("created light node");
    await waku.start();
    console.log("started light node");

    await delay(1000);

    const multiaddr = await nwaku1.getMultiaddrWithId();

    await waku.dial(multiaddr, [Protocols.PeerExchange]);
    console.log("dialed");

    await waitForRemotePeer(waku, [Protocols.PeerExchange]);
    console.log("waited");

    await delay(3000);

    try {
      const callback = (response: PeerExchangeResponse): void => {
        console.log("callback", response);
      };
      await waku.peerExchange.query(
        {
          numPeers: 1n,
        },
        callback
      );
    } catch (error) {
      console.error(error);
    }
  });
});
