import { waitForRemotePeer } from "@waku/core/lib/wait_for_remote_peer";
import { createFullNode } from "@waku/create";
import type { WakuFull } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";

import { NOISE_KEY_1 } from "../src";
import { LogLevel, Nwaku } from "../src";
import { delay } from "../src/delay";

describe("Peer Exchange: Node", () => {
  let waku: WakuFull; // use a full node instead of light node (see filter test)
  let nwaku1: Nwaku;
  let nwaku2: Nwaku;
  let nwaku3: Nwaku;

  afterEach(async function () {
    !!nwaku1 && nwaku1.stop();
    !!nwaku2 && nwaku2.stop();
    !!nwaku3 && nwaku3.stop();
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  beforeEach(async function () {
    // init nodes in beforeEach
    this.timeout(50000);

    nwaku1 = new Nwaku("node1"); // split logs into separate files
    nwaku2 = new Nwaku("node2");
    nwaku3 = new Nwaku("node3");

    await nwaku1.start({
      // nwaku1 is the node that runs PX (aligned with my nwaku only setup)
      discv5Discovery: true,
      peerExchange: true,
      logLevel: LogLevel.Trace,
      manualArgs: [
        `--discv5-udp-port:9007`, // the UDP port is not shifted automatically
      ],
    });
    console.log("nwaku1 started");

    const enr = (await nwaku1.info()).enrUri;
    console.log({ enr });

    await nwaku2.start({
      discv5Discovery: true,
      // portsShift: 5,     // port shift is not fully supported for nwaku within js-waku, we need to manually shift the UDP port
      // peerExchange: true,
      logLevel: LogLevel.Debug,
      manualArgs: [
        `--discv5-bootstrap-node:${(await nwaku1.info()).enrUri}`,
        `--discv5-udp-port:9043`,
      ],
    });
    console.log("nwaku2 started");

    await nwaku3.start({
      discv5Discovery: true,
      // portsShift: 5,     // port shift is not fully supported for nwaku within js-waku, we need to manually shift the UDP port
      // peerExchange: true,
      logLevel: LogLevel.Debug,
      manualArgs: [
        `--discv5-bootstrap-node:${(await nwaku1.info()).enrUri}`,
        `--discv5-udp-port:9089`,
      ],
    });
    console.log("nwaku3 started");

    await delay(40000); // node1 needs time to fill its px-peer cache

    waku = await createFullNode({
      // took this init from the filter test
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
    });

    await waku.start();
    console.log("js-waku started");
    await waku.dial(await nwaku1.getMultiaddrWithId());
    console.log("dialed");

    await waitForRemotePeer(waku, [Protocols.PeerExchange]);
    console.log("waited");

    await delay(2000);
  });

  it("Queries successfully", async function () {
    this.timeout(15_000);

    try {
      console.log("sending PX query");
      await waku.peerExchange.query({
        numPeers: BigInt(1),
      });
    } catch (error) {
      console.error(error);
    }
  });
});
