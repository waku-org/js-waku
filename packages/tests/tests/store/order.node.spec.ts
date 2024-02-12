import { DecodedMessage, PageDirection } from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";
import { DefaultPubsubTopic } from "@waku/interfaces";
import { expect } from "chai";

import {
  makeLogFileName,
  MOCHA_HOOK_MAX_TIMEOUT,
  ServiceNode,
  tearDownNodes,
  withGracefulTimeout
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

  this.beforeEach(function (done) {
    this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
    const runAllNodes: () => Promise<void> = async () => {
      nwaku = new ServiceNode(makeLogFileName(this));
      await nwaku.start({ store: true, lightpush: true, relay: true });
      await nwaku.ensureSubscriptions();
    };
    withGracefulTimeout(runAllNodes, 20000, done);
  });

  this.afterEach(function (done) {
    this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
    const teardown: () => Promise<void> = async () => {
      await tearDownNodes(nwaku, waku);
    };
    withGracefulTimeout(teardown, 20000, done);
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
