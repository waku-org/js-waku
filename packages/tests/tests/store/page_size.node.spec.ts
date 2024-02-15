import { DefaultPubsubTopic } from "@waku/interfaces";
import type { LightNode } from "@waku/interfaces";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

import {
  sendMessages,
  startAndConnectLightNode,
  TestContentTopic,
  TestDecoder
} from "./utils.js";

describe("Waku Store, page size", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    nwaku = new ServiceNode(makeLogFileName(this.ctx));
    await nwaku.start({ store: true, lightpush: true, relay: true });
    await nwaku.ensureSubscriptions();
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
        TestContentTopic,
        DefaultPubsubTopic
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

      waku = await startAndConnectLightNode(nwaku);
      let messagesRetrieved = 0;
      for await (const query of waku.store.queryGenerator([TestDecoder], {
        pageSize: pageSize
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
    await sendMessages(nwaku, 20, TestContentTopic, DefaultPubsubTopic);
    waku = await startAndConnectLightNode(nwaku);

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
