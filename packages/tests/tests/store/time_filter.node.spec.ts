import type { IMessage, LightNode } from "@waku/interfaces";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

import {
  adjustDate,
  runStoreNodes,
  TestDecoder,
  TestNetworkConfig,
  TestRoutingInfo
} from "./utils.js";

describe("Waku Store, time filter", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(this.ctx, TestNetworkConfig);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  [
    [-19000, -10, 10],
    [-19000, 1, 4],
    [-19000, -2, -1],
    [-19000, 0, 1000],
    [-19000, -1000, 0],
    [19000, -10, 10], // message in the future
    [-19000, 10, -10], // startTime is newer than endTime
    [0, Date.now() - 3 * 24 * 60 * 60 * 1000, Date.now()], // range longer than 24 hours
    [0, Date.now() - 24 * 60 * 60 * 1000, Date.now()] // range is 24 hours
  ].forEach(([msgTime, startTime, endTime]) => {
    it(`msgTime: ${msgTime} ms from now, startTime: ${
      msgTime + startTime
    }, endTime: ${msgTime + endTime}`, async function () {
      const msgTimestamp = adjustDate(new Date(), msgTime);
      expect(
        await nwaku.sendMessage(
          ServiceNode.toMessageRpcQuery({
            payload: new Uint8Array([0]),
            contentTopic: TestDecoder.contentTopic,
            timestamp: msgTimestamp
          }),
          TestRoutingInfo
        )
      ).to.eq(true);

      const messages: IMessage[] = [];
      await waku.store.queryWithOrderedCallback(
        [TestDecoder],
        (msg) => {
          if (msg) {
            messages.push(msg);
          }
        },
        {
          timeStart: adjustDate(msgTimestamp, startTime),
          timeEnd: adjustDate(msgTimestamp, endTime)
        }
      );

      // in this context 0 is the messageTimestamp
      if (
        (startTime > 0 && endTime > 0) ||
        (startTime < 0 && endTime < 0) ||
        startTime > endTime
      ) {
        expect(messages.length).eq(0);
      } else {
        expect(messages.length).eq(1);
        expect(messages[0].payload![0]!).eq(0);
      }
    });
  });

  [-20000, 40000].forEach((msgTime) => {
    it(`Timestamp too far from node time: ${msgTime} ms from now`, async function () {
      const msgTimestamp = adjustDate(new Date(), msgTime);
      expect(
        await nwaku.sendMessage(
          ServiceNode.toMessageRpcQuery({
            payload: new Uint8Array([0]),
            contentTopic: TestDecoder.contentTopic,
            timestamp: msgTimestamp
          }),
          TestRoutingInfo
        )
      ).to.eq(true);

      const messages: IMessage[] = [];
      await waku.store.queryWithOrderedCallback(
        [TestDecoder],
        (msg) => {
          if (msg) {
            messages.push(msg);
          }
        },
        {
          timeStart: adjustDate(msgTimestamp, -1000),
          timeEnd: adjustDate(msgTimestamp, 1000)
        }
      );

      expect(messages.length).eq(0);
    });
  });
});
