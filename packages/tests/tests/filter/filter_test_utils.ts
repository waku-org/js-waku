import {
  createDecoder,
  createEncoder,
  DecodedMessage,
  Decoder,
  DefaultPubSubTopic,
  Encoder,
  waitForRemotePeer
} from "@waku/core";
import { IFilterSubscription, LightNode, Protocols } from "@waku/interfaces";
// import { createLightNode } from "@waku/sdk";
import { createLightNode } from "@waku/sdk";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import debug from "debug";
import { Context } from "mocha";
import pRetry from "p-retry";

import {
  delay,
  makeLogFileName,
  NimGoNode,
  NOISE_KEY_1
} from "../../src/index.js";

// Constants for test configuration.
export const log = debug("waku:test:filter");
export const TestContentTopic = "/test/1/waku-filter";
export const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
export const TestDecoder = createDecoder(TestContentTopic);
export const messageText = "Filtering works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };

/**
 * Class responsible for collecting messages.
 * It provides utility methods to interact with the collected messages,
 * and offers a way to wait for incoming messages.
 */
export class MessageCollector {
  list: Array<DecodedMessage> = [];

  // Callback to handle incoming messages.
  callback = (msg: DecodedMessage): void => {
    log("Got a message");
    this.list.push(msg);
  };

  get count(): number {
    return this.list.length;
  }

  getMessage(index: number): DecodedMessage {
    return this.list[index];
  }

  async waitForMessages(
    numMessages: number,
    timeoutDuration: number = 400
  ): Promise<boolean> {
    const startTime = Date.now();

    while (this.count < numMessages) {
      if (Date.now() - startTime > timeoutDuration * numMessages) {
        return false;
      }
      await delay(10);
    }

    return true;
  }

  // Verifies a received message against expected values.
  verifyReceivedMessage(options: {
    index: number;
    expectedContentTopic?: string;
    expectedPubSubTopic?: string;
    expectedMessageText?: string | Uint8Array;
    expectedVersion?: number;
    expectedMeta?: Uint8Array;
    expectedEphemeral?: boolean;
    checkTimestamp?: boolean; // Used to determine if we need to check the timestamp
  }): void {
    expect(this.list.length).to.be.greaterThan(
      options.index,
      `The message list does not have a message at index ${options.index}`
    );

    const message = this.getMessage(options.index);
    expect(message.contentTopic).to.eq(
      options.expectedContentTopic || TestContentTopic,
      `Message content topic mismatch. Expected: ${
        options.expectedContentTopic || TestContentTopic
      }. Got: ${message.contentTopic}`
    );

    expect(message.pubSubTopic).to.eq(
      options.expectedPubSubTopic || DefaultPubSubTopic,
      `Message pub/sub topic mismatch. Expected: ${
        options.expectedPubSubTopic || DefaultPubSubTopic
      }. Got: ${message.pubSubTopic}`
    );

    expect(bytesToUtf8(message.payload)).to.eq(
      options.expectedMessageText || messageText,
      `Message text mismatch. Expected: ${
        options.expectedMessageText || messageText
      }. Got: ${bytesToUtf8(message.payload)}`
    );

    expect(message.version).to.eq(
      options.expectedVersion || 0,
      `Message version mismatch. Expected: ${
        options.expectedVersion || 0
      }. Got: ${message.version}`
    );

    const shouldCheckTimestamp =
      options.checkTimestamp !== undefined ? options.checkTimestamp : true;
    if (shouldCheckTimestamp && message.timestamp) {
      const now = Date.now();
      const tenSecondsAgo = now - 10000;
      expect(message.timestamp.getTime()).to.be.within(
        tenSecondsAgo,
        now,
        `Message timestamp not within the expected range. Expected between: ${tenSecondsAgo} and ${now}. Got: ${message.timestamp.getTime()}`
      );
    }

    expect([
      options.expectedMeta,
      undefined,
      new Uint8Array(0)
    ]).to.deep.include(
      message.meta,
      `Message meta mismatch. Expected: ${
        options.expectedMeta
          ? JSON.stringify(options.expectedMeta)
          : "undefined or " + JSON.stringify(new Uint8Array(0))
      }. Got: ${JSON.stringify(message.meta)}`
    );

    expect(message.ephemeral).to.eq(
      options.expectedEphemeral !== undefined
        ? options.expectedEphemeral
        : false,
      `Message ephemeral value mismatch. Expected: ${
        options.expectedEphemeral !== undefined
          ? options.expectedEphemeral
          : false
      }. Got: ${message.ephemeral}`
    );
  }
}

// Utility to generate test data for multiple topics tests.
export function generateTestData(topicCount: number): {
  contentTopics: string[];
  encoders: Encoder[];
  decoders: Decoder[];
} {
  const contentTopics = Array.from(
    { length: topicCount },
    (_, i) => `/test/${i + 1}/waku-multi`
  );
  const encoders = contentTopics.map((topic) =>
    createEncoder({ contentTopic: topic })
  );
  const decoders = contentTopics.map((topic) => createDecoder(topic));
  return {
    contentTopics,
    encoders,
    decoders
  };
}

// Utility to validate errors related to pings in the subscription.
export async function validatePingError(
  subscription: IFilterSubscription
): Promise<void> {
  try {
    await subscription.ping();
    throw new Error(
      "Ping was successful but was expected to fail with a specific error."
    );
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("peer has no subscriptions")
    ) {
      return;
    } else {
      throw err;
    }
  }
}

interface SetupReturn {
  nwaku: NimGoNode;
  waku: LightNode;
  subscription: IFilterSubscription;
  messageCollector: MessageCollector;
}

// Setup before each test to initialize nodes and message collector.
export async function setupNodes(currentTest: Context): Promise<SetupReturn> {
  const nwaku = new NimGoNode(makeLogFileName(currentTest));
  // Sometimes the node setup fails, when that happens we retry it max 3 times.
  await pRetry(
    async () => {
      try {
        await nwaku.start({
          filter: true,
          lightpush: true,
          relay: true
        });
      } catch (error) {
        log("nwaku node failed to start:", error);
        throw error;
      }
    },
    { retries: 3 }
  );

  let waku: LightNode | undefined;
  try {
    waku = await createLightNode({
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
    });
    await waku.start();
  } catch (error) {
    log("jswaku node failed to start:", error);
  }
  if (waku) {
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    const subscription = await waku.filter.createSubscription();
    const messageCollector = new MessageCollector();

    return { nwaku, waku, subscription, messageCollector };
  } else {
    throw new Error("Failed to initialize waku");
  }
}

export function tearDownNodes(
  nwaku: NimGoNode,
  waku: LightNode,
  nwaku2?: NimGoNode
): void {
  !!nwaku && nwaku.stop().catch((e) => log("Nwaku failed to stop", e));
  !!nwaku2 && nwaku2.stop().catch((e) => log("Nwaku2 failed to stop", e));
  !!waku && waku.stop().catch((e) => log("Waku failed to stop", e));
}
