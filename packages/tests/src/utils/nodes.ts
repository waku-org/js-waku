import {
  CreateNodeOptions,
  IWaku,
  LightNode,
  Protocols,
  RelayNode
} from "@waku/interfaces";
import { createRelayNode, RelayCreateOptions } from "@waku/relay";
import { createLightNode } from "@waku/sdk";
import {
  contentTopicToPubsubTopic,
  formatPubsubTopic,
  isAutoShardingRoutingInfo,
  RoutingInfo
} from "@waku/utils";
import { Context } from "mocha";
import pRetry from "p-retry";

import {
  DefaultTestNetworkConfig,
  DefaultTestRoutingInfo,
  NOISE_KEY_1
} from "../constants.js";
import { ServiceNodesFleet } from "../lib/index.js";
import { DEFAULT_DISCOVERIES_ENABLED } from "../lib/runNodes.js";
import { ServiceNode } from "../lib/service_node.js";
import { Args } from "../types.js";

import { makeLogFileName } from "./log_file.js";
import { waitForConnections } from "./waitForConnections.js";

export async function startServiceNode(
  context: Context,
  options: Args = {}
): Promise<ServiceNode> {
  const node = new ServiceNode(makeLogFileName(context));
  await node.start({ filter: true, store: true, lightpush: true, ...options });
  return node;
}

export async function startLightNode(
  options: CreateNodeOptions = {}
): Promise<LightNode> {
  const node = await createLightNode({
    staticNoiseKey: NOISE_KEY_1,
    networkConfig: DefaultTestNetworkConfig,
    ...options
  });
  await node.start();
  return node;
}

export async function startRelayNode(
  options: Partial<RelayCreateOptions> = {}
): Promise<RelayNode> {
  const relayOptions: RelayCreateOptions = {
    staticNoiseKey: NOISE_KEY_1,
    networkConfig: DefaultTestNetworkConfig,
    routingInfos: [DefaultTestRoutingInfo],
    ...options
  } as RelayCreateOptions;

  const node = await createRelayNode(relayOptions);
  if (relayOptions.autoStart === false) {
    await node.start();
  }
  return node;
}

/**
 * Runs both js-waku and nwaku nodes.
 *
 * @param context
 * @param routingInfo
 * @param customArgs passed to nwaku service nodes
 * @param strictChecking
 * @param numServiceNodes
 * @param withoutFilter
 * @param jsWakuParams
 */
export async function runMultipleNodes(
  context: Context,
  routingInfo: RoutingInfo,
  customArgs?: Args,
  strictChecking: boolean = false,
  numServiceNodes = 2,
  withoutFilter = false,
  jsWakuParams: CreateNodeOptions = {}
): Promise<[ServiceNodesFleet, LightNode]> {
  // create numServiceNodes nodes
  const serviceNodes = await ServiceNodesFleet.createAndRun(
    context,
    numServiceNodes,
    strictChecking,
    routingInfo,
    customArgs,
    withoutFilter
  );

  const wakuOptions: CreateNodeOptions = {
    staticNoiseKey: NOISE_KEY_1,
    libp2p: {
      addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] }
    },
    networkConfig: routingInfo.networkConfig,
    lightPush: { numPeersToUse: numServiceNodes },
    discovery: DEFAULT_DISCOVERIES_ENABLED,
    ...jsWakuParams
  };

  const waku = await createLightNode(wakuOptions);

  if (!waku) {
    throw new Error("Failed to initialize waku");
  }

  const pubsubTopics = [];

  pubsubTopics.push(routingInfo.pubsubTopic);

  if (customArgs?.shard) {
    const shards = customArgs?.shard ?? [];
    for (const s of shards) {
      pubsubTopics.push(formatPubsubTopic(routingInfo.clusterId, s));
    }
  }

  if (customArgs?.contentTopic && isAutoShardingRoutingInfo(routingInfo)) {
    const contentTopics = customArgs?.contentTopic ?? [];
    for (const ct of contentTopics) {
      pubsubTopics.push(
        contentTopicToPubsubTopic(
          ct,
          routingInfo.clusterId,
          routingInfo.networkConfig.numShardsInCluster
        )
      );
    }
  }

  for (const node of serviceNodes.nodes) {
    await waku.dial(await node.getMultiaddrWithId());
    await waku.waitForPeers([Protocols.Filter, Protocols.LightPush]);

    if (pubsubTopics.length > 0) {
      await node.ensureSubscriptions(pubsubTopics);
    }

    const wakuConnections = waku.libp2p.getConnections();

    if (wakuConnections.length < 1) {
      throw new Error(`Expected at least 1 connection for js-waku.`);
    }

    await node.waitForLog(waku.libp2p.peerId.toString(), 100);
  }

  await waitForConnections(numServiceNodes, waku);

  for (let i = 0; i < serviceNodes.nodes.length; i++) {
    const node = serviceNodes.nodes[i];
    const peers = await node.peers();

    if (peers.length < 1) {
      throw new Error(`Expected at least 1 connection for nwaku.`);
    }
  }

  return [serviceNodes, waku];
}

export async function teardownNodesWithRedundancy(
  serviceNodes: ServiceNodesFleet,
  wakuNodes: IWaku | IWaku[]
): Promise<void> {
  const wNodes = Array.isArray(wakuNodes) ? wakuNodes : [wakuNodes];

  const stopNwakuNodes = serviceNodes.nodes.map(async (node) => {
    await pRetry(
      async () => {
        await node.stop();
      },
      { retries: 3 }
    );
  });

  const stopWakuNodes = wNodes.map(async (waku) => {
    if (waku) {
      await pRetry(
        async () => {
          await waku.stop();
        },
        { retries: 3 }
      );
    }
  });

  await Promise.all([...stopNwakuNodes, ...stopWakuNodes]);
}
