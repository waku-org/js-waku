import type { LightNode } from "@waku/interfaces";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

import {
  runStoreNodes,
  sendMessages,
  TestDecoder,
  TestShardInfo
} from "./utils.js";

describe("Waku Store, page size", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(this.ctx, TestShardInfo);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  [
    [0, 110],
    [1, 4],
    [3, 20],
    [10, 10],
    [11, 10],
    [19, 20],
    [110, 120]
  ].forEach(([pageSize, messageCount]) => {
    it(`Passing page size ${pageSize} when there are ${messageCount} messages`, async function () {
      await sendMessages(
        nwaku,
        messageCount,
        TestDecoder.contentTopic,
        TestDecoder.pubsubTopic
      );

      // Determine effectivePageSize for test expectations
      let effectivePageSize = pageSize;
      if (pageSize === 0) {
        effectivePageSize = 20;
      } else if (pageSize > 100) {
        if (nwaku.type == "go-waku") {
          effectivePageSize = 20;
        } else {
          effectivePageSize = 100;
        }
      }

      let messagesRetrieved = 0;
      for await (const query of waku.store.queryGenerator([TestDecoder], {
        paginationLimit: pageSize
      })) {
        // Calculate expected page size
        const expectedPageSize = Math.min(
          effectivePageSize,
          messageCount - messagesRetrieved
        );
        expect(query.length).eq(expectedPageSize);

        for await (const msg of query) {
          if (msg) {
            messagesRetrieved++;
          }
        }
      }

      expect(messagesRetrieved).eq(messageCount);
    });
  });

  // Possible issue here because pageSize differs across implementations
  it("Default pageSize", async function () {
    await sendMessages(
      nwaku,
      20,
      TestDecoder.contentTopic,
      TestDecoder.pubsubTopic
    );

    let messagesRetrieved = 0;
    for await (const query of waku.store.queryGenerator([TestDecoder])) {
      expect(query.length).eq(10);
      for await (const msg of query) {
        if (msg) {
          messagesRetrieved++;
        }
      }
    }
    expect(messagesRetrieved).eq(20);
  });
});
