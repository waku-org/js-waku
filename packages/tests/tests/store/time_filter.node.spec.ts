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
    [-19000, -1000, 1], // Changed from 0 to 1 to include the message timestamp
    [19000, -10, 10], // message in the future
    [-19000, 10, -10], // startTime is newer than endTime
    [0, Date.now() - 3 * 24 * 60 * 60 * 1000, Date.now()], // range longer than 24 hours
    [0, Date.now() - 24 * 60 * 60 * 1000, Date.now()] // range is 24 hours
  ].forEach(([msgTime, startTime, endTime]) => {
    it(`msgTime: ${msgTime} ms from now, startTime: ${
      msgTime + startTime
    }, endTime: ${msgTime + endTime}`, async function () {
      const msgTimestamp = adjustDate(new Date(), msgTime);
      const timeStart = adjustDate(msgTimestamp, startTime);
      const timeEnd = adjustDate(msgTimestamp, endTime);

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

      // Add a delay to ensure the message is stored before querying
      await new Promise((resolve) => setTimeout(resolve, 200));

      const messages: IMessage[] = [];
      await waku.store.queryWithOrderedCallback(
        [TestDecoder],
        (msg) => {
          if (msg) {
            messages.push(msg);
          }
        },
        {
          timeStart: timeStart,
          timeEnd: timeEnd
        }
      );

      const messageTime = msgTimestamp.getTime();
      const startTimeMs = timeStart.getTime();
      const endTimeMs = timeEnd.getTime();

      if (startTime > endTime) {
        expect(messages.length).eq(0);
      } else if (messageTime >= startTimeMs && messageTime < endTimeMs) {
        expect(messages.length).eq(1);
        expect(messages[0].payload![0]!).eq(0);
      } else {
        expect(messages.length).eq(0);
      }
    });
  });

  // Test case for messages with timestamps too far in the past
  it("Timestamp too far from node time: -20000 ms from now", async function () {
    const msgTimestamp = adjustDate(new Date(), -20000);
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

    // Add a delay to ensure the message is stored before querying
    await new Promise((resolve) => setTimeout(resolve, 200));

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

  // Test case for messages with timestamps too far in the future
  it("Timestamp too far from node time: 40000 ms from now", async function () {
    const msgTimestamp = adjustDate(new Date(), 40000);
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

    // Add a delay to ensure the message is stored before querying
    await new Promise((resolve) => setTimeout(resolve, 200));

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
