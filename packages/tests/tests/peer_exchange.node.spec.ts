import { waitForRemotePeer } from "@waku/core/lib/wait_for_remote_peer";
import { createFullNode } from "@waku/create";
import type { WakuFull } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";

import { NOISE_KEY_1, Nwaku } from "../src";
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
    nwaku1 = new Nwaku("node1");
    nwaku2 = new Nwaku("node2");
    nwaku3 = new Nwaku("node3");

    await nwaku1.start({
      discv5Discovery: true,
      peerExchange: true,
      manualArgs: [`--discv5-udp-port:9007`],
    });
    console.log("nwaku1 started");

    const enr = (await nwaku1.info()).enrUri;
    console.log({ enr });

    await nwaku2.start({
      discv5Discovery: true,
      manualArgs: [`--discv5-bootstrap-node:${enr}`, `--discv5-udp-port:9043`],
    });
    console.log("nwaku2 started");

    await nwaku3.start({
      discv5Discovery: true,
      manualArgs: [`--discv5-bootstrap-node:${enr}`, `--discv5-udp-port:9062`],
    });
    console.log("nwaku3 started");

    await delay(40000);

    waku = await createFullNode({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
    });

    console.log("created light node");
    await waku.start();
    console.log("started light node");

    await delay(1000);

    const mulltiaddr = await nwaku1.getMultiaddrWithId();

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
