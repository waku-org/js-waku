import { createDecoder, createEncoder, waitForRemotePeer } from "@waku/core";
import { IFilterSubscription, LightNode, Protocols } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { Logger } from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";
import { Context } from "mocha";

import { makeLogFileName, NimGoNode, NOISE_KEY_1 } from "../../src/index.js";

// Constants for test configuration.
export const log = new Logger("test:filter");
export const TestContentTopic = "/test/1/waku-filter";
export const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
export const TestDecoder = createDecoder(TestContentTopic);
export const messageText = "Filtering works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };

// Utility to validate errors related to pings in the subscription.
export async function validatePingError(
  subscription: IFilterSubscription
): Promise<void> {
  try {
    const { statusCode } = await subscription.ping();
    if (statusCode === 200) {
      throw new Error(
        "Ping was successful but was expected to fail with a specific error."
      );
    } else {
      return;
    }
  } catch (error) {
    throw new Error(
      `Ping failed with an unexpected error. ` + `Error: ${error}`
    );
  }
}

export async function runNodes(
  context: Context,
  pubsubTopics: string[]
): Promise<[NimGoNode, LightNode]> {
  const nwaku = new NimGoNode(makeLogFileName(context));

  await nwaku.start(
    {
      filter: true,
      lightpush: true,
      relay: true,
      topic: pubsubTopics
    },
    { retries: 3 }
  );

  let waku: LightNode | undefined;
  try {
    waku = await createLightNode({
      pubsubTopics: pubsubTopics,
      staticNoiseKey: NOISE_KEY_1,
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
    });
    await waku.start();
  } catch (error) {
    log.error("jswaku node failed to start:", error);
  }

  if (waku) {
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    await nwaku.ensureSubscriptions(pubsubTopics);
    return [nwaku, waku];
  } else {
    throw new Error("Failed to initialize waku");
  }
}
