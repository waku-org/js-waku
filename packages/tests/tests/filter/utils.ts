import {
  createDecoder,
  createEncoder,
  Decoder,
  Encoder,
  waitForRemotePeer
} from "@waku/core";
import { IFilterSubscription, LightNode, Protocols } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { utf8ToBytes } from "@waku/utils/bytes";
import debug from "debug";
import { Context } from "mocha";

import { makeLogFileName, NimGoNode, NOISE_KEY_1 } from "../../src/index.js";

// Constants for test configuration.
export const log = debug("waku:test:filter");
export const TestContentTopic = "/test/1/waku-filter";
export const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
export const TestDecoder = createDecoder(TestContentTopic);
export const messageText = "Filtering works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };

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

export async function runNodes(
  context: Context,
  pubSubTopics: string[]
): Promise<[NimGoNode, LightNode]> {
  const nwakuOptional = pubSubTopics[0] ? { topic: pubSubTopics[0] } : {};
  const nwaku = new NimGoNode(makeLogFileName(context));

  await nwaku.startWithRetries(
    { filter: true, lightpush: true, relay: true, ...nwakuOptional },
    { retries: 3 }
  );

  let waku: LightNode | undefined;
  try {
    waku = await createLightNode({
      pubSubTopics: pubSubTopics,
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
    return [nwaku, waku];
  } else {
    throw new Error("Failed to initialize waku");
  }
}
