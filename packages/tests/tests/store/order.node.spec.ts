import { DecodedMessage, PageDirection } from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";
import { DefaultPubsubTopic } from "@waku/interfaces";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

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
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    nwaku = new ServiceNode(makeLogFileName(this.ctx));
    await nwaku.start({ store: true, lightpush: true, relay: true });
    await nwaku.ensureSubscriptions();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  [PageDirection.FORWARD, PageDirection.BACKWARD].forEach((pageDirection) => {
    it(`Query Generator  - ${pageDirection}`, async function () {
      await sendMessages(
        nwaku,
        totalMsgs,
        TestContentTopic,
        DefaultPubsubTopic
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
        DefaultPubsubTopic
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
        DefaultPubsubTopic
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
