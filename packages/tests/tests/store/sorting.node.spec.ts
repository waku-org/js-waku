import { DecodedMessage, PageDirection } from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";
import { DefaultPubsubTopic } from "@waku/interfaces";

import {
  makeLogFileName,
  MOCHA_HOOK_MAX_TIMEOUT,
  ServiceNode,
  tearDownNodes,
  withGracefulTimeout
} from "../../src/index.js";

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
    it(`Query Generator sorting by timestamp while page direction is ${pageDirection}`, async function () {
      await sendMessages(
        nwaku,
        totalMsgs,
        TestContentTopic,
        DefaultPubsubTopic
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
