import {
  createEncoder,
  DefaultPubsubTopic,
  waitForRemotePeer
} from "@waku/core";
import { LightNode, Protocols, ShardInfo } from "@waku/interfaces";
import { createLightNode, utf8ToBytes } from "@waku/sdk";
import { Logger } from "@waku/utils";

import { makeLogFileName, NimGoNode, NOISE_KEY_1 } from "../../src/index.js";

// Constants for test configuration.
export const log = new Logger("test:lightpush");
export const TestContentTopic = "/test/1/waku-light-push/utf8";
export const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
export const messageText = "Light Push works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };

export async function runNodes(
  context: Mocha.Context,
  pubsubTopics: string[],
  shardInfo?: ShardInfo
): Promise<[NimGoNode, LightNode]> {
  const nwaku = new NimGoNode(makeLogFileName(context));
  await nwaku.start(
    {
      lightpush: true,
      relay: true,
      pubsubTopic: pubsubTopics,
      clusterId: shardInfo?.clusterId
    },
    { retries: 3 }
  );

  let waku: LightNode | undefined;
  try {
    waku = await createLightNode({
      ...((pubsubTopics.length !== 1 ||
        pubsubTopics[0] !== DefaultPubsubTopic) && {
        shardInfo: shardInfo
      }),
      staticNoiseKey: NOISE_KEY_1
    });
    await waku.start();
  } catch (error) {
    log.error("jswaku node failed to start:", error);
  }

  if (waku) {
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);
    await nwaku.ensureSubscriptions(pubsubTopics);
    return [nwaku, waku];
  } else {
    throw new Error("Failed to initialize waku");
  }
}
