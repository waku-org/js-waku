import {
  createDecoder,
  createEncoder,
  DefaultPubsubTopic,
  waitForRemotePeer
} from "@waku/core";
import {
  IFilterSubscription,
  LightNode,
  Protocols,
  ShardInfo
} from "@waku/interfaces";
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
  //TODO: change this to use `ShardInfo` instead of `string[]`
  pubsubTopics: string[],
  shardInfo?: ShardInfo
): Promise<[NimGoNode, LightNode]> {
  const nwaku = new NimGoNode(makeLogFileName(context));

  await nwaku.start(
    {
      filter: true,
      lightpush: true,
      relay: true,
      pubsubTopic: pubsubTopics,
      clusterId: shardInfo?.clusterId
    },
    { retries: 3 }
  );

  const waku_options = {
    staticNoiseKey: NOISE_KEY_1,
    libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
    ...((pubsubTopics.length !== 1 ||
      pubsubTopics[0] !== DefaultPubsubTopic) && {
      shardInfo: shardInfo
    })
  };

  log.info("Starting js waku node with :", JSON.stringify(waku_options));
  let waku: LightNode | undefined;
  try {
    waku = await createLightNode(waku_options);
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
