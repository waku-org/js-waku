import { LightNode } from "@waku/interfaces";
import { createLightNode, utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  NOISE_KEY_2,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";
import { DEFAULT_DISCOVERIES_ENABLED } from "../../src/lib/runNodes.js";

import { TestContentTopic, TestEncoder, TestRoutingInfo } from "./utils.js";

describe(`Waku Light Push V2 and V3 interop`, function () {
  this.timeout(15000);
  let waku: LightNode;
  let waku2: LightNode;
  let serviceNodes: ServiceNodesFleet;

  beforeEachCustom(this, async () => {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      TestRoutingInfo,
      { lightpush: true, filter: true, relay: true },
      true,
      2,
      true
    );

    waku2 = await createLightNode({
      staticNoiseKey: NOISE_KEY_2,
      libp2p: {
        addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] }
      },
      networkConfig: TestRoutingInfo.networkConfig,
      lightPush: { numPeersToUse: 1 },
      discovery: DEFAULT_DISCOVERIES_ENABLED
    });

    await waku2.dial(await serviceNodes.nodes[1].getMultiaddrWithId());
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, [waku, waku2]);
  });

  it(`Push messages througth V2 and V3 from 2 js-waku and receives`, async function () {
    let pushResponse = await waku.lightPush.send(
      TestEncoder,
      {
        payload: utf8ToBytes("v2")
      },
      { useLegacy: true }
    );
    expect(pushResponse.successes.length).to.eq(2);

    expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(true);
    serviceNodes.messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "v2",
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestRoutingInfo.pubsubTopic
    });

    pushResponse = await waku2.lightPush.send(
      TestEncoder,
      {
        payload: utf8ToBytes("v3")
      },
      { useLegacy: false }
    );
    expect(pushResponse.successes.length).to.eq(1);

    expect(await serviceNodes.messageCollector.waitForMessages(1)).to.eq(true);
    serviceNodes.messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: "v3",
      expectedContentTopic: TestContentTopic,
      expectedPubsubTopic: TestRoutingInfo.pubsubTopic
    });
  });
});
