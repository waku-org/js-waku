import { generateKeyPair } from "@libp2p/crypto/keys";
import { peerIdFromPrivateKey } from "@libp2p/peer-id";
import { multiaddr } from "@multiformats/multiaddr";
import { ENR } from "@waku/enr";
import { EnrCreator } from "@waku/enr";
import { expect } from "chai";

import { fetchNodes } from "./fetch_nodes.js";

async function createEnr(): Promise<ENR> {
  const peerId = await generateKeyPair("secp256k1").then(peerIdFromPrivateKey);
  const enr = await EnrCreator.fromPeerId(peerId);
  enr.setLocationMultiaddr(multiaddr("/ip4/18.223.219.100/udp/9000"));
  enr.multiaddrs = [
    multiaddr("/dns4/node-01.do-ams3.waku.test.status.im/tcp/443/wss"),
    multiaddr("/dns6/node-01.ac-cn-hongkong-c.waku.test.status.im/tcp/443/wss"),
    multiaddr(
      "/onion3/vww6ybal4bd7szmgncyruucpgfkqahzddi37ktceo3ah7ngmcopnpyyd:1234/wss"
    )
  ];

  enr.waku2 = { lightPush: true, filter: true, relay: false, store: false };
  return enr;
}

describe("Fetch nodes", function () {
  it("Get Nodes", async function () {
    const retrievedNodes = [await createEnr(), await createEnr()];

    let fetchCount = 0;
    const getNode = (): Promise<ENR> => {
      const node = retrievedNodes[fetchCount];
      fetchCount++;
      return Promise.resolve(node);
    };

    const res = [];
    for await (const node of fetchNodes(getNode, 5)) {
      res.push(node);
    }

    expect(res.length).to.eq(2);
    expect(res[0].peerId!.toString()).to.not.eq(res[1].peerId!.toString());
  });

  it("Stops search when maxGet is reached", async function () {
    const retrievedNodes = [
      await createEnr(),
      await createEnr(),
      await createEnr()
    ];

    let fetchCount = 0;
    const getNode = (): Promise<ENR> => {
      const node = retrievedNodes[fetchCount];
      fetchCount++;
      return Promise.resolve(node);
    };

    const res = [];
    for await (const node of fetchNodes(getNode, 2)) {
      res.push(node);
    }

    expect(res.length).to.eq(2);
  });

  it("Stops search when 2 null results are returned", async function () {
    const retrievedNodes = [await createEnr(), null, null, await createEnr()];

    let fetchCount = 0;
    const getNode = (): Promise<ENR | null> => {
      const node = retrievedNodes[fetchCount];
      fetchCount++;
      return Promise.resolve(node);
    };

    const res = [];
    for await (const node of fetchNodes(getNode, 10, 2)) {
      res.push(node);
    }

    expect(res.length).to.eq(1);
  });
});
