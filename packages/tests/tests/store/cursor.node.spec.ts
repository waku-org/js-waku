import { DecodedMessage } from "@waku/core";
import type { LightNode } from "@waku/interfaces";
import { bytesToUtf8 } from "@waku/utils/bytes";
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
  startAndConnectLightNode,
  TestContentTopic,
  TestDecoder,
  TestNetworkConfig,
  TestRoutingInfo,
  TestRoutingInfo2,
  totalMsgs
} from "./utils.js";

describe("Waku Store, cursor", function () {
  this.timeout(15000);
  let waku: LightNode;
  let waku2: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(
      this.ctx,
      TestNetworkConfig,
      [],
      [TestContentTopic]
    );
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, [waku, waku2]);
  });

  [
    [2, 4],
    [0, 20],
    [10, 40],
    [19, 20],
    [19, 50],
    [110, 120]
  ].forEach(([cursorIndex, messageCount]) => {
    it(`Passing a valid cursor at ${cursorIndex} index when there are ${messageCount} messages`, async function () {
      console.log(nwaku);
      await sendMessages(
        nwaku,
        messageCount,
        TestDecoder.contentTopic,
        TestRoutingInfo
      );

      // messages in reversed order (first message at last index)
      const messages: DecodedMessage[] = [];
      for await (const page of waku.store.queryGenerator([TestDecoder])) {
        for await (const msg of page) {
          messages.push(msg as DecodedMessage);
        }
      }

      // create cursor to extract messages after the cursorIndex
      const cursor = waku.store.createCursor(messages[cursorIndex]);

      const messagesAfterCursor: DecodedMessage[] = [];
      for await (const page of waku.store.queryGenerator([TestDecoder], {
        paginationCursor: cursor
      })) {
        for await (const msg of page) {
          if (msg) {
            messagesAfterCursor.push(msg as DecodedMessage);
          }
        }
      }

      expect(messages.length).be.eql(messageCount);
      expect(messagesAfterCursor.length).be.eql(messageCount - cursorIndex - 1);
      if (cursorIndex == messages.length - 1) {
        // in this case the cursor will return nothin because it points at the end of the list
        expect(messagesAfterCursor).be.eql([]);
      } else {
        expect(bytesToUtf8(messagesAfterCursor[0].payload)).to.be.eq(
          bytesToUtf8(messages[cursorIndex + 1].payload)
        );
        expect(
          bytesToUtf8(
            messagesAfterCursor[messagesAfterCursor.length - 1].payload
          )
        ).to.be.eq(bytesToUtf8(messages[messages.length - 1].payload));
      }
    });
  });

  it("Reusing cursor across nodes", async function () {
    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestRoutingInfo
    );
    waku2 = await startAndConnectLightNode(nwaku, TestNetworkConfig);

    // messages in reversed order (first message at last index)
    const messages: DecodedMessage[] = [];
    for await (const page of waku.store.queryGenerator([TestDecoder])) {
      for await (const msg of page) {
        messages.push(msg as DecodedMessage);
      }
    }

    // create cursor to extract messages after the cursorIndex
    const cursor = waku.store.createCursor(messages[5]);

    // query node2 with the cursor from node1
    const messagesAfterCursor: DecodedMessage[] = [];
    for await (const page of waku2.store.queryGenerator([TestDecoder], {
      paginationCursor: cursor
    })) {
      for await (const msg of page) {
        if (msg) {
          messagesAfterCursor.push(msg as DecodedMessage);
        }
      }
    }

    expect(messages.length).be.eql(totalMsgs);
    expect(messagesAfterCursor.length).be.eql(totalMsgs - 6);
    expect(bytesToUtf8(messagesAfterCursor[0].payload)).to.be.eq(
      bytesToUtf8(messages[6].payload)
    );
    expect(
      bytesToUtf8(messagesAfterCursor[messagesAfterCursor.length - 1].payload)
    ).to.be.eq(bytesToUtf8(messages[messages.length - 1].payload));
  });

  it("Passing invalid cursor for nwaku > 0.35.1", async function () {
    if (nwaku.version && nwaku.version.minor < 36) {
      this.skip();
    }

    await sendMessages(nwaku, totalMsgs, TestContentTopic, TestRoutingInfo);

    const messages: DecodedMessage[] = [];
    for await (const page of waku.store.queryGenerator([TestDecoder])) {
      for await (const msg of page) {
        messages.push(msg as DecodedMessage);
      }
    }

    // setting an invalid cursor
    const cursor = new Uint8Array([2, 3]);

    const messagesAfterCursor: DecodedMessage[] = [];
    try {
      for await (const page of waku.store.queryGenerator([TestDecoder], {
        paginationCursor: cursor
      })) {
        for await (const msg of page) {
          if (msg) {
            messagesAfterCursor.push(msg as DecodedMessage);
          }
        }
      }
      expect(messagesAfterCursor.length).to.eql(0);
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          "Store query failed with status code: 300, description: BAD_RESPONSE: archive error: DIRVER_ERROR: cursor not found"
        )
      ) {
        throw err;
      }
    }
  });

  it("Passing cursor with wrong pubsubTopic for nwaku > 0.35.1", async function () {
    if (nwaku.version && nwaku.version.minor < 36) {
      this.skip();
    }

    await sendMessages(
      nwaku,
      totalMsgs,
      TestDecoder.contentTopic,
      TestRoutingInfo
    );

    const messages: DecodedMessage[] = [];
    for await (const page of waku.store.queryGenerator([TestDecoder])) {
      for await (const msg of page) {
        messages.push(msg as DecodedMessage);
      }
    }
    messages[5].pubsubTopic = TestRoutingInfo2.pubsubTopic;
    const cursor = waku.store.createCursor(messages[5]);

    try {
      for await (const page of waku.store.queryGenerator([TestDecoder], {
        paginationCursor: cursor
      })) {
        void page;
      }
      throw new Error("Cursor with wrong pubsubtopic was accepted");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          "Store query failed with status code: 300, description: BAD_RESPONSE: archive error: DIRVER_ERROR: cursor not found"
        )
      ) {
        throw err;
      }
    }
  });
});
