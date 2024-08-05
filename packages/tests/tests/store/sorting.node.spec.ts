import { DecodedMessage } from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";

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
  TestShardInfo,
  totalMsgs
} from "./utils.js";

describe("Waku Store, sorting", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(this.ctx, TestShardInfo);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  [true, false].forEach((pageDirection) => {
    it(`Query Generator sorting by timestamp while page direction is ${pageDirection}`, async function () {
      await sendMessages(
        nwaku,
        totalMsgs,
        TestDecoder.contentTopic,
        TestDecoder.pubsubTopic
      );

      for await (const query of waku.store.queryGenerator([TestDecoder], {
        paginationForward: pageDirection
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

  [true, false].forEach((pageDirection) => {
    it(`Ordered Callback sorting by timestamp while page direction is ${pageDirection}`, async function () {
      await sendMessages(
        nwaku,
        totalMsgs,
        TestDecoder.contentTopic,
        TestDecoder.pubsubTopic
      );

      const messages: IMessage[] = [];
      await waku.store.queryWithOrderedCallback(
        [TestDecoder],
        async (msg) => {
          messages.push(msg);
        },
        {
          paginationForward: pageDirection
        }
      );
      // Extract timestamps
      const timestamps = messages.map(
        (msg) => msg.timestamp as unknown as bigint
      );
      // Check if timestamps are sorted
      for (let i = 1; i < timestamps.length; i++) {
        if (pageDirection === true && timestamps[i] < timestamps[i - 1]) {
          throw new Error(
            `Messages are not sorted by timestamp in FORWARD direction. Found out of order at index ${i}`
          );
        } else if (
          pageDirection === false &&
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
