import type { IMessage, LightNode } from "@waku/interfaces";
import { expect } from "chai";

import { makeLogFileName, NimGoNode, tearDownNodes } from "../../src/index.js";

import {
  adjustDate,
  startAndConnectLightNode,
  TestContentTopic,
  TestDecoder
} from "./utils.js";

describe("Waku Store, time filter", function () {
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

  [
    [-19000, -10, 10],
    [-19000, 1, 4],
    [-19000, -2, -1],
    // [-19000, 0, 1000], // skipped for now because it fails on gowaku which returns messages > startTime
    [-19000, -1000, 0],
    [19000, -10, 10], // message in the future
    [-19000, 10, -10] // startTime is newer than endTime
  ].forEach(([msgTime, startTime, endTime]) => {
    it(`msgTime: ${msgTime} ms from now, startTime: ${
      msgTime + startTime
    }, endTime: ${msgTime + endTime}`, async function () {
      const msgTimestamp = adjustDate(new Date(), msgTime);
      expect(
        await nwaku.sendMessage(
          NimGoNode.toMessageRpcQuery({
            payload: new Uint8Array([0]),
            contentTopic: TestContentTopic,
            timestamp: msgTimestamp
          })
        )
      ).to.be.true;

      waku = await startAndConnectLightNode(nwaku);

      const messages: IMessage[] = [];
      await waku.store.queryWithOrderedCallback(
        [TestDecoder],
        (msg) => {
          if (msg) {
            messages.push(msg);
          }
        },
        {
          timeFilter: {
            startTime: adjustDate(msgTimestamp, startTime),
            endTime: adjustDate(msgTimestamp, endTime)
          }
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
          NimGoNode.toMessageRpcQuery({
            payload: new Uint8Array([0]),
            contentTopic: TestContentTopic,
            timestamp: msgTimestamp
          })
        )
      ).to.be.true;

      waku = await startAndConnectLightNode(nwaku);

      const messages: IMessage[] = [];
      await waku.store.queryWithOrderedCallback(
        [TestDecoder],
        (msg) => {
          if (msg) {
            messages.push(msg);
          }
        },
        {
          timeFilter: {
            startTime: adjustDate(msgTimestamp, -1000),
            endTime: adjustDate(msgTimestamp, 1000)
          }
        }
      );

      expect(messages.length).eq(0);
    });
  });
});
