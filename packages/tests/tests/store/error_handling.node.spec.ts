import { IMessage, type LightNode } from "@waku/interfaces";
import { formatPubsubTopic } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

import {
  processQueriedMessages,
  runStoreNodes,
  TestDecoder,
  TestDecoder2,
  TestNetworkConfig
} from "./utils.js";

describe("Waku Store, error handling", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;

  beforeEachCustom(this, async () => {
    [nwaku, waku] = await runStoreNodes(this.ctx, TestNetworkConfig);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  it("Query Generator, Multiple PubsubTopics", async function () {
    try {
      for await (const msgPromises of waku.store.queryGenerator([
        TestDecoder,
        TestDecoder2
      ])) {
        void msgPromises;
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
        void msgPromises;
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
    const WrongTestPubsubTopic = formatPubsubTopic(43, 53);
    const messages = await processQueriedMessages(
      waku,
      [TestDecoder],
      WrongTestPubsubTopic
    );
    expect(messages?.length).eq(0);
  });

  it("Query with Ordered Callback, Multiple PubsubTopics", async function () {
    try {
      await waku.store.queryWithOrderedCallback(
        [TestDecoder, TestDecoder2],
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

  it("Query with Promise Callback, Multiple PubsubTopics", async function () {
    try {
      await waku.store.queryWithPromiseCallback(
        [TestDecoder, TestDecoder2],
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
