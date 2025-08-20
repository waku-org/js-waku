import { createEncoder } from "@waku/core";
import { LightNode, Protocols } from "@waku/interfaces";
import { createLightNode, utf8ToBytes } from "@waku/sdk";
import { createRoutingInfo } from "@waku/utils";
import { expect } from "chai";

import {
  DefaultTestContentTopic,
  DefaultTestNetworkConfig
} from "../../src/constants.js";
import { applyDefaultArgs, ServiceNode } from "../../src/index.js";
import { waitForConnections } from "../../src/utils/waitForConnections.js";

const routingInfo = createRoutingInfo(DefaultTestNetworkConfig, {
  contentTopic: DefaultTestContentTopic
});

const testMatrix: Array<{ name: string; versions: ("v2" | "v3")[] }> = [
  { name: "all-v2", versions: ["v2", "v2"] },
  { name: "all-v3", versions: ["v3", "v3"] },
  { name: "mixed-v2-v3", versions: ["v2", "v3"] }
];

const encoder = createEncoder({
  routingInfo,
  contentTopic: DefaultTestContentTopic
});
const payloadText = "Hello test";

describe("LightPush compatibility with v2/v3 nwaku versions", function () {
  this.timeout(20_000);

  let waku: LightNode;

  describe("LightPush compatibility with v2/v3 nwaku versions", function () {
    testMatrix.forEach(({ versions }) => {
      it(`sends to nodes with versions: ${versions}`, async () => {
        const imageMap: Record<"v2" | "v3", string> = {
          v2: process.env.NWAKU_IMAGE_V2 || "wakuorg/nwaku:v0.35.0",
          v3: process.env.NWAKU_IMAGE_V3 || "wakuorg/nwaku:v0.35.1"
        };

        const nodes: ServiceNode[] = [];

        for (const ver of versions) {
          const node = new ServiceNode(
            `lp_${ver}_${Math.random().toString(36).substring(7)}`,
            imageMap[ver]
          );
          let addr: string | undefined;
          if (nodes[0]) {
            addr = await nodes[0].getExternalMultiaddr();
          }
          const args = applyDefaultArgs(routingInfo, {
            staticnode: addr
          });
          await node.start(args, { retries: 3 });
          nodes.push(node);
        }

        waku = await createLightNode({
          libp2p: {
            addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] }
          },
          networkConfig: DefaultTestNetworkConfig,
          staticNoiseKey: new Uint8Array(32)
        });
        await waku.start();

        // Dial all service nodes
        for (const n of nodes) {
          await n.ensureSubscriptions([routingInfo.pubsubTopic]);
          await waku.dial(await n.getMultiaddrWithId());
        }

        await waitForConnections(nodes.length, waku);
        await waku.waitForPeers([Protocols.LightPush]);

        const result = await waku.lightPush.send(encoder, {
          payload: utf8ToBytes(payloadText)
        });
        expect(result.failures.length).to.equal(0);
        expect(result.successes.length).to.be.at.least(1);
      });
    });
  });
});
