import { waitForRemotePeer } from "@waku/core";
import {
  ContentTopicInfo,
  ProtocolCreateOptions,
  Protocols,
  ShardingParams
} from "@waku/interfaces";
import { createLightNode, WakuNode } from "@waku/sdk";
import { createRelayNode } from "@waku/sdk/relay";
import { Logger, shardInfoToPubsubTopics } from "@waku/utils";
import { Context } from "mocha";

import { NOISE_KEY_1 } from "../constants.js";
import { makeLogFileName } from "../utils/index.js";

import { ServiceNode } from "./service_node.js";

export const log = new Logger("test:runNodes");

type RunNodesOptions = {
  context: Context;
  shardInfo: ShardingParams;
  protocols: Protocols[];
  createNode: typeof createLightNode | typeof createRelayNode;
};

export async function runNodes<T>(
  options: RunNodesOptions
): Promise<[ServiceNode, T]> {
  const { context, shardInfo, createNode, protocols } = options;

  const nwaku = new ServiceNode(makeLogFileName(context));
  const pubsubTopics = shardInfoToPubsubTopics(shardInfo);

  function isContentTopicInfo(info: ShardingParams): info is ContentTopicInfo {
    return (info as ContentTopicInfo).contentTopics !== undefined;
  }

  await nwaku.start(
    {
      filter: true,
      lightpush: true,
      relay: true,
      store: true,
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
    shardInfo
  };

  log.info("Starting js waku node with :", JSON.stringify(waku_options));
  let waku: WakuNode | undefined;
  try {
    waku = (await createNode(waku_options)) as WakuNode;
    await waku.start();
  } catch (error) {
    log.error("jswaku node failed to start:", error);
  }

  if (waku) {
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, protocols);
    await nwaku.ensureSubscriptions(pubsubTopics);
    return [nwaku, waku as T];
  } else {
    throw new Error("Failed to initialize waku");
  }
}
