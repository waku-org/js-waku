import { waitForRemotePeer } from "@waku/core";
import {
  ContentTopicInfo,
  DefaultPubsubTopic,
  LightNode,
  ProtocolCreateOptions,
  Protocols,
  ShardingParams
} from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { Logger } from "@waku/utils";
import { Context } from "mocha";

import {
  makeLogFileName,
  NOISE_KEY_1,
  ServiceNode
} from "../../../src/index.js";

export const log = new Logger("test:filter:single_node");

export async function runNodes(
  context: Context,
  //TODO: change this to use `ShardInfo` instead of `string[]`
  pubsubTopics: string[],
  shardInfo?: ShardingParams
): Promise<[ServiceNode, LightNode]> {
  const nwaku = new ServiceNode(makeLogFileName(context));

  function isContentTopicInfo(info: ShardingParams): info is ContentTopicInfo {
    return (info as ContentTopicInfo).contentTopics !== undefined;
  }

  await nwaku.start(
    {
      filter: true,
      lightpush: true,
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
  const waku_options: ProtocolCreateOptions = {
    staticNoiseKey: NOISE_KEY_1,
    libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
    pubsubTopics: shardInfo ? undefined : pubsubTopics,
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
