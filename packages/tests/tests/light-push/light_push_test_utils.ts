import {
  createEncoder,
  DefaultPubSubTopic,
  waitForRemotePeer
} from "@waku/core";
import { LightNode, Protocols } from "@waku/interfaces";
import { createLightNode, utf8ToBytes } from "@waku/sdk";
import { AssertionError, expect } from "chai";
import debug from "debug";
import pRetry from "p-retry";

import {
  base64ToUtf8,
  delay,
  makeLogFileName,
  NimGoNode,
  NOISE_KEY_1
} from "../../src/index.js";
import { MessageRpcResponse } from "../../src/node/interfaces.js";

// Constants for test configuration.
export const log = debug("waku:test:lightpush");
export const TestContentTopic = "/test/1/waku-light-push/utf8";
export const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
export const messageText = "Light Push works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };

export async function waitForMessages(
  nwaku: NimGoNode,
  msgCount = 0,
  pubSubTopic = DefaultPubSubTopic,
  maxRetries = 100
): Promise<MessageRpcResponse[]> {
  const msgs: MessageRpcResponse[] = [];
  let retries = 0;
  while (retries < maxRetries) {
    if (msgs.length !== msgCount) {
      return await nwaku.messages(pubSubTopic);
    }
    await delay(10);
    retries++;
  }
  throw new Error("Could not find messages in the nwaku node");
}

export function verifyReceivedMessage(
  message: MessageRpcResponse,
  options: {
    expectedContentTopic?: string;
    expectedMessageText?: string | Uint8Array;
    expectedVersion?: number;
    expectedEphemeral?: boolean;
    expectedTimestamp?: bigint;
  }
): void {
  expect(message.contentTopic).to.eq(
    options.expectedContentTopic || TestContentTopic,
    `Message content topic mismatch. Expected: ${
      options.expectedContentTopic || TestContentTopic
    }. Got: ${message.contentTopic}`
  );

  expect(base64ToUtf8(message.payload)).to.eq(
    options.expectedMessageText,
    `Message text mismatch. Expected: ${
      options.expectedMessageText
    }. Got: ${base64ToUtf8(message.payload)}`
  );

  expect(message.version).to.eq(
    options.expectedVersion || 0,
    `Message version mismatch. Expected: ${
      options.expectedVersion || 0
    }. Got: ${message.version}`
  );

  if (message.timestamp) {
    // In we send timestamp in the request we assert that it matches the timestamp in the response +- 1 sec
    // We take the 1s deviation because there are some ms diffs in timestamps, probably because of conversions
    if (options.expectedTimestamp !== undefined) {
      const lowerBound = BigInt(options.expectedTimestamp) - BigInt(1000000000);
      const upperBound = BigInt(options.expectedTimestamp) + BigInt(1000000000);

      if (message.timestamp < lowerBound || message.timestamp > upperBound) {
        throw new AssertionError(
          `Message timestamp not within the expected range. Expected between: ${lowerBound} and ${upperBound}. Got: ${message.timestamp}`
        );
      }
    }
    // In we don't send timestamp in the request we assert that the timestamp in the response is between now and (now-10s)
    else {
      const now = BigInt(Date.now()) * BigInt(1_000_000);
      const tenSecondsAgo = now - BigInt(10_000_000_000);

      if (message.timestamp < tenSecondsAgo || message.timestamp > now) {
        throw new AssertionError(
          `Message timestamp not within the expected range. Expected between: ${tenSecondsAgo} and ${now}. Got: ${message.timestamp}`
        );
      }
    }
  }

  expect(message.ephemeral).to.eq(
    options.expectedEphemeral !== undefined ? options.expectedEphemeral : false,
    `Message ephemeral value mismatch. Expected: ${
      options.expectedEphemeral !== undefined
        ? options.expectedEphemeral
        : false
    }. Got: ${message.ephemeral}`
  );
}

export async function runNodes(
  context: Mocha.Context,
  pubSubTopic?: string
): Promise<[NimGoNode, LightNode]> {
  const nwakuOptional = pubSubTopic ? { topic: pubSubTopic } : {};
  const nwaku = new NimGoNode(makeLogFileName(context));
  await pRetry(
    async () => {
      try {
        await nwaku.start({
          lightpush: true,
          relay: true,
          ...nwakuOptional
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
      pubSubTopic,
      staticNoiseKey: NOISE_KEY_1
    });
    await waku.start();
  } catch (error) {
    log("jswaku node failed to start:", error);
  }

  if (waku) {
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    return [nwaku, waku];
  } else {
    throw new Error("Failed to initialize waku");
  }
}

export function tearDownNodes(nwaku: NimGoNode, waku: LightNode): void {
  !!nwaku && nwaku.stop().catch((e) => log("Nwaku failed to stop", e));
  !!waku && waku.stop().catch((e) => log("Waku failed to stop", e));
}
