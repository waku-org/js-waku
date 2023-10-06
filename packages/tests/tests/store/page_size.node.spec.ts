import { DefaultPubSubTopic } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { expect } from "chai";

import { makeLogFileName, NimGoNode, tearDownNodes } from "../../src/index.js";

import {
  sendMessages,
  startAndConnectLightNode,
  TestContentTopic,
  TestDecoder
} from "./utils.js";

describe("Waku Store, page size", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: NimGoNode;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.startWithRetries({ store: true, lightpush: true, relay: true });
    await nwaku.ensureSubscriptions();
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([nwaku], [waku]);
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
        DefaultPubSubTopic
      );

      // Determine effectivePageSize for test expectations
      let effectivePageSize = pageSize;
      if (pageSize === 0) {
        if (nwaku.type() == "go-waku") {
          effectivePageSize = 100;
        } else {
          effectivePageSize = 20;
        }
      } else if (pageSize > 100) {
        effectivePageSize = 100;
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

  it("Default pageSize", async function () {
    await sendMessages(nwaku, 20, TestContentTopic, DefaultPubSubTopic);
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
