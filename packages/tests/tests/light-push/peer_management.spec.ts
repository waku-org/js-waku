import { DefaultPubsubTopic, LightNode } from "@waku/interfaces";
import { createEncoder, utf8ToBytes } from "@waku/sdk";
import { expect } from "chai";
import { describe } from "mocha";

import {
  afterEachCustom,
  beforeEachCustom,
  DefaultTestShardInfo,
  ServiceNodesFleet
} from "../../src/index.js";
import {
  runMultipleNodes,
  teardownNodesWithRedundancy
} from "../filter/utils.js";

describe("Waku Light Push: Peer Management: E2E", function () {
  this.timeout(15000);
  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;

  beforeEachCustom(this, async () => {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      DefaultTestShardInfo,
      undefined,
      5
    );
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  const encoder = createEncoder({
    pubsubTopic: DefaultPubsubTopic,
    contentTopic: "/test"
  });

  it("Number of peers are maintained correctly", async function () {
    const { successes, failures } = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello_World")
    });

    expect(successes.length).to.be.greaterThan(0);
    expect(successes.length).to.be.equal(waku.lightPush.numPeersToUse);

    if (failures) {
      expect(failures.length).to.equal(0);
    }
  });

  it("Failed peers are renewed", async function () {
    // send a lightpush request -- should have all successes
    const response1 = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello_World")
    });

    expect(response1.successes.length).to.be.equal(
      waku.lightPush.numPeersToUse
    );
    if (response1.failures) {
      expect(response1.failures.length).to.equal(0);
    }

    // disconnect from one peer to force a failure
    const peerToDisconnect = response1.successes[0];
    await waku.connectionManager.dropConnection(peerToDisconnect);

    // send another lightpush request -- should have all successes except the one that was disconnected
    const response2 = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello_World")
    });

    // check that the peer that was disconnected is not in the new successes
    expect(response2.successes).to.not.include(peerToDisconnect);
    expect(response2.failures).to.have.length(1);
    expect(response2.failures?.[0].peerId).to.equal(peerToDisconnect);

    // send another lightpush request -- renewal should have triggerred and new peer should be used instead of the disconnected one
    const response3 = await waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello_World")
    });

    expect(response3.successes.length).to.be.equal(
      waku.lightPush.numPeersToUse
    );

    expect(response3.successes).to.not.include(peerToDisconnect);
    if (response3.failures) {
      expect(response3.failures.length).to.equal(0);
    }
  });
});
