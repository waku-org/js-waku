import { DecodedMessage, DefaultPubSubTopic, PageDirection } from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";
import { expect } from "chai";

import { makeLogFileName, NimGoNode, tearDownNodes } from "../../src/index.js";

import {
  chunkAndReverseArray,
  sendMessages,
  startAndConnectLightNode,
  TestContentTopic,
  TestDecoder,
  totalMsgs
} from "./utils.js";

describe("Waku Store, order", function () {
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
    await tearDownNodes(nwaku, waku);
  });

  [PageDirection.FORWARD, PageDirection.BACKWARD].forEach((pageDirection) => {
    it(`Query Generator  - ${pageDirection}`, async function () {
      await sendMessages(
        nwaku,
        totalMsgs,
        TestContentTopic,
        DefaultPubSubTopic
      );
      waku = await startAndConnectLightNode(nwaku);

      const messages: IMessage[] = [];
      for await (const query of waku.store.queryGenerator([TestDecoder], {
        pageDirection: pageDirection
      })) {
        for await (const msg of query) {
          if (msg) {
            messages.push(msg as DecodedMessage);
          }
        }
      }

      let expectedPayloads = Array.from(Array(totalMsgs).keys());
      if (pageDirection === PageDirection.BACKWARD) {
        expectedPayloads = chunkAndReverseArray(expectedPayloads, 10);
      }

      expect(messages?.length).eq(totalMsgs);
      const payloads = messages.map((msg) => msg.payload[0]!);
      expect(payloads).to.deep.eq(expectedPayloads);
    });
  });

  [PageDirection.FORWARD, PageDirection.BACKWARD].forEach((pageDirection) => {
    it(`Promise Callback  - ${pageDirection}`, async function () {
      await sendMessages(
        nwaku,
        totalMsgs,
        TestContentTopic,
        DefaultPubSubTopic
      );
      waku = await startAndConnectLightNode(nwaku);

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
          pageDirection: pageDirection
        }
      );

      let expectedPayloads = Array.from(Array(totalMsgs).keys());
      if (pageDirection === PageDirection.BACKWARD) {
        expectedPayloads = chunkAndReverseArray(expectedPayloads, 10);
      }

      expect(messages?.length).eq(totalMsgs);
      const payloads = messages.map((msg) => msg.payload[0]!);
      expect(payloads).to.deep.eq(expectedPayloads);
    });
  });

  [PageDirection.FORWARD, PageDirection.BACKWARD].forEach((pageDirection) => {
    it(`Ordered Callback - ${pageDirection}`, async function () {
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

      if (pageDirection === PageDirection.BACKWARD) {
        messages.reverse();
      }
      expect(messages?.length).eq(totalMsgs);
      const payloads = messages.map((msg) => msg.payload[0]!);
      expect(payloads).to.deep.eq(Array.from(Array(totalMsgs).keys()));
    });
  });
});
