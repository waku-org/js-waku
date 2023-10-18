import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { bootstrap } from "@libp2p/bootstrap";
import type { LightNode } from "@waku/interfaces";
import { wakuPeerExchangeDiscovery } from "@waku/peer-exchange";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";

import { delay } from "../src/delay.js";
import { makeLogFileName } from "../src/log_file.js";
import { NimGoNode } from "../src/node/node.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const keyFilePath = resolve(__dirname, "../src/certs/key.pem");
const certFilePath = resolve(__dirname, "../src/certs/cert.pem");

describe("circuit relay", () => {
  let waku: LightNode;
  let serviceNode1: NimGoNode;
  let serviceNode2: NimGoNode;

  beforeEach(function () {
    serviceNode1 = new NimGoNode(makeLogFileName(this) + "1");
    serviceNode2 = new NimGoNode(makeLogFileName(this) + "2");
  });

  afterEach(async function () {
    this.timeout(10_000);
    await serviceNode1?.stop();
    await serviceNode2.stop();
    await waku?.stop();
  });

  it("test dial: light node", async function () {
    this.timeout(100_000);

    await serviceNode1.start({
      discv5Discovery: true,
      peerExchange: true,
      wssCert: certFilePath,
      wssKey: keyFilePath
    });

    const enr = (await serviceNode1.info()).enrUri;

    await serviceNode2.start({
      forceReachability: "private",
      peerExchange: true,
      discv5Discovery: true,
      discv5BootstrapNode: enr,
      staticnode:
        "/dns4/node-01.do-ams3.status.prod.statusim.net/tcp/443/wss/p2p/16Uiu2HAm6HZZr7aToTvEBPpiys4UxajCTU97zj5v7RNR2gbniy1D",
      wssCert: certFilePath,
      wssKey: keyFilePath
    });

    const serviceNode2PeerId = await serviceNode2.getPeerId();

    // TODO: improvement from go-waku to watch for a log line instead
    // time it takes for go-waku to populate circuit relay addresses in the ENR
    await delay(25_000);

    waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          bootstrap({
            list: [(await serviceNode1.getMultiaddrWithId()).toString()]
          }),
          wakuPeerExchangeDiscovery()
        ]
      }
    });

    let connectedPeersStr = waku.libp2p
      .getConnections()
      .map((conn) => conn.remotePeer.toString());

    // check until we are able to form a connection with a private node (serviceNode2)
    while (!connectedPeersStr.includes(serviceNode2PeerId.toString())) {
      connectedPeersStr = waku.libp2p
        .getConnections()
        .map((conn) => conn.remotePeer.toString());

      await delay(2000);
    }

    expect(connectedPeersStr).includes(serviceNode2PeerId.toString());

    // check that the expected circuit relay connection is transient
    const circuitRelayConnection = waku.libp2p
      .getConnections()
      .find(
        (conn) => conn.remotePeer.toString() === serviceNode2PeerId.toString()
      );
    expect(circuitRelayConnection?.transient).to.eq(true);
  });
});
