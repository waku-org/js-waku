import { DecodedMessage } from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";
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
  TestShardInfo,
  totalMsgs
} from "./utils.js";

describe("Waku Store, order", function () {
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
    it(`Query Generator  - ${pageDirection}`, async function () {
      await sendMessages(
        nwaku,
        totalMsgs,
        TestDecoder.contentTopic,
        TestDecoder.pubsubTopic
      );

      const messages: IMessage[] = [];
      for await (const query of waku.store.queryGenerator([TestDecoder], {
        paginationForward: pageDirection
      })) {
        for await (const msg of query) {
          if (msg) {
            messages.push(msg as DecodedMessage);
          }
        }
      }

      const expectedPayloads = Array.from(Array(totalMsgs).keys());

      expect(messages?.length).eq(totalMsgs);
      const payloads = messages.map((msg) => msg.payload[0]!);
      expect(payloads).to.deep.eq(expectedPayloads);
    });
  });

  [true, false].forEach((pageDirection) => {
    it(`Promise Callback  - ${pageDirection}`, async function () {
      await sendMessages(
        nwaku,
        totalMsgs,
        TestDecoder.contentTopic,
        TestDecoder.pubsubTopic
      );

      const messages: IMessage[] = [];
      await waku.store.queryWithPromiseCallback(
        [TestDecoder],
        async (msgPromise) => {
          const msg = await msgPromise;
          if (msg) {
            messages.push(msg);
          }
        },
        {
          paginationForward: pageDirection
        }
      );

      const expectedPayloads = Array.from(Array(totalMsgs).keys());

      expect(messages?.length).eq(totalMsgs);
      const payloads = messages.map((msg) => msg.payload[0]!);
      expect(payloads).to.deep.eq(expectedPayloads);
    });
  });

  [true, false].forEach((pageDirection) => {
    it(`Ordered Callback - ${pageDirection}`, async function () {
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

      expect(messages?.length).eq(totalMsgs);
      const payloads = messages.map((msg) => msg.payload[0]!);
      expect(payloads).to.deep.eq(Array.from(Array(totalMsgs).keys()));
    });
  });
});
