import { DecodedMessage, DefaultPubSubTopic, PageDirection } from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";

import { makeLogFileName, NimGoNode, tearDownNodes } from "../../src/index.js";

import {
  sendMessages,
  startAndConnectLightNode,
  TestContentTopic,
  TestDecoder,
  totalMsgs
} from "./utils.js";

describe("Waku Store, sorting", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: NimGoNode;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.start({ store: true, lightpush: true, relay: true });
    await nwaku.ensureSubscriptions();
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes(nwaku, waku);
  });

  [PageDirection.FORWARD, PageDirection.BACKWARD].forEach((pageDirection) => {
    it(`Query Generator sorting by timestamp while page direction is ${pageDirection}`, async function () {
      await sendMessages(
        nwaku,
        totalMsgs,
        TestContentTopic,
        DefaultPubSubTopic
      );
      waku = await startAndConnectLightNode(nwaku);

      for await (const query of waku.store.queryGenerator([TestDecoder], {
        pageDirection: PageDirection.FORWARD
      })) {
        const page: IMessage[] = [];
        for await (const msg of query) {
          if (msg) {
            page.push(msg as DecodedMessage);
          }
        }
        // Extract timestamps
        const timestamps = page.map(
          (msg) => msg.timestamp as unknown as bigint
        );
        // Check if timestamps are sorted
        for (let i = 1; i < timestamps.length; i++) {
          if (timestamps[i] < timestamps[i - 1]) {
            throw new Error(
              `Messages are not sorted by timestamp. Found out of order at index ${i}`
            );
          }
        }
      }
    });
  });

  [PageDirection.FORWARD, PageDirection.BACKWARD].forEach((pageDirection) => {
    it(`Ordered Callback sorting by timestamp while page direction is ${pageDirection}`, async function () {
      await sendMessages(
        nwaku,
        totalMsgs,
        TestContentTopic,
        DefaultPubSubTopic
      );
      waku = await startAndConnectLightNode(nwaku);

      const messages: IMessage[] = [];
      await waku.store.queryWithOrderedCallback(
        [TestDecoder],
        async (msg) => {
          messages.push(msg);
        },
        {
          pageDirection: pageDirection
        }
      );
      // Extract timestamps
      const timestamps = messages.map(
        (msg) => msg.timestamp as unknown as bigint
      );
      // Check if timestamps are sorted
      for (let i = 1; i < timestamps.length; i++) {
        if (
          pageDirection === PageDirection.FORWARD &&
          timestamps[i] < timestamps[i - 1]
        ) {
          throw new Error(
            `Messages are not sorted by timestamp in FORWARD direction. Found out of order at index ${i}`
          );
        } else if (
          pageDirection === PageDirection.BACKWARD &&
          timestamps[i] > timestamps[i - 1]
        ) {
          throw new Error(
            `Messages are not sorted by timestamp in BACKWARD direction. Found out of order at index ${i}`
          );
        }
      }
    });
  });
});
