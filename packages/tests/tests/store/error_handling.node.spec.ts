import { DefaultPubsubTopic } from "@waku/interfaces";
import { IMessage, type LightNode } from "@waku/interfaces";
import { expect } from "chai";

import {
  makeLogFileName,
  MOCHA_HOOK_MAX_TIMEOUT,
  ServiceNode,
  tearDownNodes,
  withGracefulTimeout
} from "../../src/index.js";

import {
  customDecoder1,
  customShardedPubsubTopic1,
  processQueriedMessages,
  startAndConnectLightNode,
  TestDecoder
} from "./utils.js";

describe("Waku Store, error handling", function () {
  this.timeout(15000);
  let waku: LightNode;
  let nwaku: ServiceNode;

  this.beforeEach(function (done) {
    this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
    const runAllNodes: () => Promise<void> = async () => {
      nwaku = new ServiceNode(makeLogFileName(this));
      await nwaku.start({ store: true, lightpush: true, relay: true });
      await nwaku.ensureSubscriptions();
      waku = await startAndConnectLightNode(nwaku);
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

  it("Query Generator, Wrong PubsubTopic", async function () {
    try {
      for await (const msgPromises of waku.store.queryGenerator([
        customDecoder1
      ])) {
        msgPromises;
      }
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          `Pubsub topic ${customShardedPubsubTopic1} has not been configured on this instance. Configured topics are: ${DefaultPubsubTopic}`
        )
      ) {
        throw err;
      }
    }
  });

  it("Query Generator, Multiple PubsubTopics", async function () {
    try {
      for await (const msgPromises of waku.store.queryGenerator([
        TestDecoder,
        customDecoder1
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
      DefaultPubsubTopic
    );
    expect(messages?.length).eq(0);
  });

  it("Query with Ordered Callback, Wrong PubsubTopic", async function () {
    try {
      await waku.store.queryWithOrderedCallback(
        [customDecoder1],
        async () => {}
      );
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          `Pubsub topic ${customShardedPubsubTopic1} has not been configured on this instance. Configured topics are: ${DefaultPubsubTopic}`
        )
      ) {
        throw err;
      }
    }
  });

  it("Query with Ordered Callback, Multiple PubsubTopics", async function () {
    try {
      await waku.store.queryWithOrderedCallback(
        [TestDecoder, customDecoder1],
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

  it("Query with Promise Callback, Wrong PubsubTopic", async function () {
    try {
      await waku.store.queryWithPromiseCallback(
        [customDecoder1],
        async () => {}
      );
      throw new Error("QueryGenerator was successful but was expected to fail");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          `Pubsub topic ${customShardedPubsubTopic1} has not been configured on this instance. Configured topics are: ${DefaultPubsubTopic}`
        )
      ) {
        throw err;
      }
    }
  });

  it("Query with Promise Callback, Multiple PubsubTopics", async function () {
    try {
      await waku.store.queryWithPromiseCallback(
        [TestDecoder, customDecoder1],
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
