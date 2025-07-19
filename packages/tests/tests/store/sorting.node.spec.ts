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
  TestNetworkConfig,
  TestRoutingInfo,
  totalMsgs
} from "./utils.js";

describe("Waku Store, sorting", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(this.ctx, TestNetworkConfig);
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
        TestRoutingInfo
      );

      const pages: IMessage[][] = [];

      for await (const query of waku.store.queryGenerator([TestDecoder], {
        paginationForward: pageDirection
      })) {
        const page: IMessage[] = [];
        for await (const msg of query) {
          if (msg) {
            page.push(msg as DecodedMessage);
          }
        }
        pages.push(page);

        // Check order within the current page
        const timestamps = page.map(
          (msg) => msg.timestamp as unknown as bigint
        );
        for (let i = 1; i < timestamps.length; i++) {
          if (timestamps[i] < timestamps[i - 1]) {
            throw new Error(
              `Messages within page ${pages.length - 1} are not in sequential order. Found out of order at index ${i}`
            );
          }
        }
      }

      // Check order between pages
      for (let i = 1; i < pages.length; i++) {
        const prevPageLastTimestamp = pages[i - 1][pages[i - 1].length - 1]
          .timestamp as unknown as bigint;
        const currentPageFirstTimestamp = pages[i][0]
          .timestamp as unknown as bigint;

        if (
          pageDirection === true &&
          prevPageLastTimestamp < currentPageFirstTimestamp
        ) {
          throw new Error(
            `Pages are not in reversed order for FORWARD direction. Issue found between page ${i - 1} and ${i}`
          );
        } else if (
          pageDirection === false &&
          prevPageLastTimestamp > currentPageFirstTimestamp
        ) {
          throw new Error(
            `Pages are not in reversed order for BACKWARD direction. Issue found between page ${i - 1} and ${i}`
          );
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
        TestRoutingInfo
      );

      const messages: IMessage[] = [];
      const pageSize = 5;
      // receive 4 pages, 5 messages each (20/4)
      await waku.store.queryWithOrderedCallback(
        [TestDecoder],
        async (msg) => {
          messages.push(msg);
        },
        { paginationLimit: pageSize, paginationForward: pageDirection }
      );

      // Split messages into pages
      const pages: IMessage[][] = [];
      for (let i = 0; i < messages.length; i += pageSize) {
        pages.push(messages.slice(i, i + pageSize));
      }

      // Check order within each page
      pages.forEach((page, pageIndex) => {
        const pageTimestamps = page.map(
          (msg) => msg.timestamp as unknown as bigint
        );
        for (let i = 1; i < pageTimestamps.length; i++) {
          if (pageTimestamps[i] < pageTimestamps[i - 1]) {
            throw new Error(
              `Messages within page ${pageIndex} are not in sequential order. Found out of order at index ${i}`
            );
          }
        }
      });

      // Check order between pages
      for (let i = 1; i < pages.length; i++) {
        const prevPageLastTimestamp = pages[i - 1][pages[i - 1].length - 1]
          .timestamp as unknown as bigint;
        const currentPageFirstTimestamp = pages[i][0]
          .timestamp as unknown as bigint;

        if (
          pageDirection === true &&
          prevPageLastTimestamp > currentPageFirstTimestamp
        ) {
          throw new Error(
            `Pages are not in reversed order for FORWARD direction. Issue found between page ${i - 1} and ${i}`
          );
        } else if (
          pageDirection === false &&
          prevPageLastTimestamp < currentPageFirstTimestamp
        ) {
          throw new Error(
            `Pages are not in reversed order for BACKWARD direction. Issue found between page ${i - 1} and ${i}`
          );
        }
      }
    });
  });
});
