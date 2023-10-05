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
    await tearDownNodes([nwaku], [waku]);
  });

  [
    [-10000, -10, 10],
    [-10000, 1, 4],
    [-10000, -2, -1],
    [-10000, 0, 1000],
    [-10000, -1000, 0],
    [10000, 4, 1],
    [10000, -10, 10]
  ].forEach(([msgTimeAdjustment, startTime, endTime]) => {
    it(`msgTime: ${adjustDate(
      new Date(),
      msgTimeAdjustment
    )}, startTime: ${adjustDate(
      adjustDate(new Date(), msgTimeAdjustment),
      startTime
    )}, endTime: ${adjustDate(
      adjustDate(new Date(), msgTimeAdjustment),
      endTime
    )}`, async function () {
      const msgTimestamp = adjustDate(new Date(), msgTimeAdjustment);

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
      if ((startTime > 0 && endTime > 0) || (startTime < 0 && endTime < 0)) {
        expect(messages.length).eq(0);
      } else {
        expect(messages.length).eq(1);
        expect(messages[0].payload![0]!).eq(0);
      }
    });
  });
});
