import { CreateNodeOptions, NetworkConfig, Protocols } from "@waku/interfaces";
import { createRelayNode } from "@waku/relay";
import { createLightNode, WakuNode } from "@waku/sdk";
import {
  derivePubsubTopicsFromNetworkConfig,
  Logger,
  pubsubTopicsToShardInfo
} from "@waku/utils";
import { Context } from "mocha";

import { NOISE_KEY_1 } from "../constants.js";
import { makeLogFileName } from "../utils/index.js";

import { ServiceNode } from "./service_node.js";

export const log = new Logger("test:runNodes");

type RunNodesOptions = {
  context: Context;
  networkConfig: NetworkConfig;
  protocols: Protocols[];
  createNode: typeof createLightNode | typeof createRelayNode;
};

export async function runNodes<T>(
  options: RunNodesOptions
): Promise<[ServiceNode, T]> {
  const { context, networkConfig, createNode, protocols } = options;

  const nwaku = new ServiceNode(makeLogFileName(context));
  const pubsubTopics = derivePubsubTopicsFromNetworkConfig(networkConfig);
  const shardInfo = pubsubTopicsToShardInfo(pubsubTopics);

  await nwaku.start(
    {
      filter: true,
      lightpush: true,
      relay: true,
      store: true,
      pubsubTopic: pubsubTopics,
      clusterId: shardInfo.clusterId
    },
    { retries: 3 }
  );
  const waku_options: CreateNodeOptions = {
    staticNoiseKey: NOISE_KEY_1,
    libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
    networkConfig: shardInfo
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
    await waku.waitForPeers(protocols);
    await nwaku.ensureSubscriptions(pubsubTopics);
    return [nwaku, waku as T];
  } else {
    throw new Error("Failed to initialize waku");
  }
}
