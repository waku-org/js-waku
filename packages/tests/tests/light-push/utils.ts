import { createEncoder, waitForRemotePeer } from "@waku/core";
import {
  ContentTopicInfo,
  DefaultPubsubTopic,
  LightNode,
  Protocols,
  ShardingParams
} from "@waku/interfaces";
import { createLightNode, utf8ToBytes } from "@waku/sdk";
import { Logger } from "@waku/utils";

import { makeLogFileName, NOISE_KEY_1, ServiceNode } from "../../src/index.js";

// Constants for test configuration.
export const log = new Logger("test:lightpush");
export const TestContentTopic = "/test/1/waku-light-push/utf8";
export const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
export const messageText = "Light Push works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };

export async function runNodes(
  context: Mocha.Context,
  pubsubTopics: string[],
  shardInfo?: ShardingParams
): Promise<[ServiceNode, LightNode]> {
  const nwaku = new ServiceNode(makeLogFileName(context));

  function isContentTopicInfo(info: ShardingParams): info is ContentTopicInfo {
    return (info as ContentTopicInfo).contentTopics !== undefined;
  }

  await nwaku.start(
    {
      lightpush: true,
      filter: true,
      relay: true,
      pubsubTopic: pubsubTopics,
      // Conditionally include clusterId if shardInfo exists
      ...(shardInfo && { clusterId: shardInfo.clusterId }),
      // Conditionally include contentTopic if shardInfo exists and clusterId is 1
      ...(shardInfo &&
        isContentTopicInfo(shardInfo) &&
        shardInfo.clusterId === 1 && { contentTopic: shardInfo.contentTopics })
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
      pubsubTopics: shardInfo ? undefined : pubsubTopics,
      staticNoiseKey: NOISE_KEY_1
    });
    await waku.start();
  } catch (error) {
    log.error("jswaku node failed to start:", error);
  }

  if (waku) {
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.LightPush]);
    if (
      shardInfo &&
      "contentTopics" in shardInfo &&
      shardInfo.contentTopics.length > 0
    ) {
      await nwaku.ensureSubscriptionsAutosharding(shardInfo.contentTopics);
    }
    await nwaku.ensureSubscriptions(pubsubTopics);
    return [nwaku, waku];
  } else {
    throw new Error("Failed to initialize waku");
  }
}
