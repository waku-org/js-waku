import { DefaultPubSubTopic } from "@waku/core";
import { IMessage, type LightNode } from "@waku/interfaces";
import { expect } from "chai";

import { makeLogFileName, NimGoNode, tearDownNodes } from "../../src/index.js";

import {
  customPubSubTopic,
  customTestDecoder,
  processQueriedMessages,
  startAndConnectLightNode,
  TestDecoder
} from "./utils.js";

describe("Waku Store, error handling", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: NimGoNode;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.startWithRetries({ store: true, lightpush: true, relay: true });
    await nwaku.ensureSubscriptions();
    waku = await startAndConnectLightNode(nwaku);
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([nwaku], [waku]);
  });

  it("Query Generator, Wrong PubSubTopic", async function () {
    try {
      for await (const msgPromises of waku.store.queryGenerator([
        customTestDecoder
      ])) {
        msgPromises;
      }
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          `PubSub topic ${customPubSubTopic} has not been configured on this instance. Configured topics are: ${DefaultPubSubTopic}`
        )
      ) {
        throw err;
      }
    }
  });

  it("Query Generator, Multiple PubSubTopics", async function () {
    try {
      for await (const msgPromises of waku.store.queryGenerator([
        TestDecoder,
        customTestDecoder
      ])) {
        msgPromises;
      }
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          "API does not support querying multiple pubsub topics at once"
        )
      ) {
        throw err;
      }
    }
  });

  it("Query Generator, No Decoder", async function () {
    try {
      for await (const msgPromises of waku.store.queryGenerator([])) {
        msgPromises;
      }
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes("No decoders provided")
      ) {
        throw err;
      }
    }
  });

  it("Query Generator, No message returned", async function () {
    const messages = await processQueriedMessages(
      waku,
      [TestDecoder],
      DefaultPubSubTopic
    );
    expect(messages?.length).eq(0);
  });

  it("Query with Ordered Callback, Wrong PubSubTopic", async function () {
    try {
      await waku.store.queryWithOrderedCallback(
        [customTestDecoder],
        async () => {}
      );
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          `PubSub topic ${customPubSubTopic} has not been configured on this instance. Configured topics are: ${DefaultPubSubTopic}`
        )
      ) {
        throw err;
      }
    }
  });

  it("Query with Ordered Callback, Multiple PubSubTopics", async function () {
    try {
      await waku.store.queryWithOrderedCallback(
        [TestDecoder, customTestDecoder],
        async () => {}
      );
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          "API does not support querying multiple pubsub topics at once"
        )
      ) {
        throw err;
      }
    }
  });

  it("Query with Ordered Callback, No Decoder", async function () {
    try {
      await waku.store.queryWithOrderedCallback([], async () => {});
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes("No decoders provided")
      ) {
        throw err;
      }
    }
  });

  it("Query with Ordered Callback, No message returned", async function () {
    const messages: IMessage[] = [];
    await waku.store.queryWithOrderedCallback([TestDecoder], async (msg) => {
      messages.push(msg);
    });
    expect(messages?.length).eq(0);
  });

  it("Query with Promise Callback, Wrong PubSubTopic", async function () {
    try {
      await waku.store.queryWithPromiseCallback(
        [customTestDecoder],
        async () => {}
      );
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          `PubSub topic ${customPubSubTopic} has not been configured on this instance. Configured topics are: ${DefaultPubSubTopic}`
        )
      ) {
        throw err;
      }
    }
  });

  it("Query with Promise Callback, Multiple PubSubTopics", async function () {
    try {
      await waku.store.queryWithPromiseCallback(
        [TestDecoder, customTestDecoder],
        async () => {}
      );
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          "API does not support querying multiple pubsub topics at once"
        )
      ) {
        throw err;
      }
    }
  });

  it("Query with Promise Callback, No Decoder", async function () {
    try {
      await waku.store.queryWithPromiseCallback([], async () => {});
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes("No decoders provided")
      ) {
        throw err;
      }
    }
  });

  it("Query with Promise Callback, No message returned", async function () {
    const messages: IMessage[] = [];
    await waku.store.queryWithPromiseCallback(
      [TestDecoder],
      async (msgPromise) => {
        const msg = await msgPromise;
        if (msg) {
          messages.push(msg);
        }
      }
    );
    expect(messages?.length).eq(0);
  });
});
