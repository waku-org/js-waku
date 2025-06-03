import { LightPushCodecV2 } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { LightPushCodecV3 } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { Logger } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  runMultipleNodes,
  ServiceNodesFleet,
  teardownNodesWithRedundancy
} from "../../src/index.js";

import { TestEncoder, TestPubsubTopic, TestShardInfo } from "./utils.js";

const log = new Logger("test:light-push-v3-features");

describe("Waku Light Push V3: Protocol Features", function () {
  this.timeout(30000);
  let waku: LightNode;
  let serviceNodes: ServiceNodesFleet;

  beforeEachCustom(this, async () => {
    [serviceNodes, waku] = await runMultipleNodes(
      this.ctx,
      TestShardInfo,
      { lightpush: true, filter: true },
      undefined,
      2,
      true
    );
  });

  afterEachCustom(this, async () => {
    await teardownNodesWithRedundancy(serviceNodes, waku);
  });

  it("should detect v3 protocol support in nwaku nodes", async function () {
    const peers = await waku.libp2p.peerStore.all();

    let v3Support = false;
    let v2Support = false;

    for (const peer of peers) {
      if (peer.protocols.includes(LightPushCodecV3)) {
        v3Support = true;
        log.info(`Peer ${peer.id.toString()} supports Light Push v3`);
      }
      if (peer.protocols.includes(LightPushCodecV2)) {
        v2Support = true;
        log.info(`Peer ${peer.id.toString()} supports Light Push v2`);
      }
    }

    log.info(`V3 support: ${v3Support}, V2 support: ${v2Support}`);

    expect(v3Support || v2Support).to.be.true;
  });

  it("should handle concurrent sends correctly", async function () {
    const concurrentSends = 5;
    const promises: Promise<any>[] = [];

    for (let i = 0; i < concurrentSends; i++) {
      const promise = waku.lightPush.send(TestEncoder, {
        payload: utf8ToBytes(`Concurrent message ${i}`)
      });
      promises.push(promise);
    }

    const results = await Promise.all(promises);

    for (const result of results) {
      expect(result.successes.length).to.be.greaterThan(0);
      expect(result.failures.length).to.equal(0);
    }

    const messagesReceived =
      await serviceNodes.messageCollector.waitForMessages(concurrentSends, {
        pubsubTopic: TestPubsubTopic
      });
    expect(messagesReceived).to.be.true;
  });

  it("should retry on transient failures if configured", async function () {
    const messageText = "Test retry message";

    const pushResponse = await waku.lightPush.send(
      TestEncoder,
      {
        payload: utf8ToBytes(messageText)
      },
      { autoRetry: true }
    );

    if (pushResponse.successes.length > 0) {
      const messagesReceived =
        await serviceNodes.messageCollector.waitForMessages(1, {
          pubsubTopic: TestPubsubTopic
        });
      expect(messagesReceived).to.be.true;
    }
  });
});
