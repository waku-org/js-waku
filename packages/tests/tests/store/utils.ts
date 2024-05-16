import { waitForRemotePeer } from "@waku/core";
import {
  createLightNode,
  LightNode,
  ProtocolCreateOptions,
  Protocols,
  ShardingParams
} from "@waku/sdk";
import { Logger, shardInfoToPubsubTopics } from "@waku/utils";
import { Context } from "mocha";

import {
  NOISE_KEY_1,
  ServiceNode,
  ServiceNodesFleet,
  waitForConnections
} from "../../src";

import { sendMessages, sendMessagesAutosharding } from "./single_node/utils";

export const log = new Logger("test:store:multiple-nodes");

export async function sendMessagesToMultipleNodes(
  nodes: ServiceNode[],
  numMessages: number,
  contentTopic: string,
  pubsubTopic: string
): Promise<void> {
  const timestamp = new Date();
  const promises = nodes.map((node) =>
    sendMessages(node, numMessages, contentTopic, pubsubTopic, timestamp)
  );
  await Promise.all(promises);
}

export async function sendMessagesToMultipleNodesAutosharding(
  nodes: ServiceNode[],
  numMessages: number,
  contentTopic: string
): Promise<void> {
  const promises = nodes.map((node) =>
    sendMessagesAutosharding(node, numMessages, contentTopic)
  );
  await Promise.all(promises);
}

export async function startAndConnectLightNodeWithMultipleServiceNodes(
  instances: ServiceNode[],
  shardInfo: ShardingParams
): Promise<LightNode> {
  const waku = await createLightNode({
    staticNoiseKey: NOISE_KEY_1,
    libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
    shardInfo: shardInfo
  });
  await waku.start();
  await Promise.all(
    instances.map(async (instance) => {
      await waku.dial(await instance.getMultiaddrWithId());
    })
  );
  await waitForRemotePeer(waku, [Protocols.Store]);

  const wakuConnections = waku.libp2p.getConnections();
  if (wakuConnections.length !== instances.length) {
    throw new Error(
      `Expected ${instances.length} connections. Got ${wakuConnections.length}`
    );
  }

  const serviceNodesPeers = await Promise.all(
    instances.map((instance) => instance.peers())
  );

  for (const peers of serviceNodesPeers) {
    if (peers.length < 1) {
      throw new Error(
        `Expected at least 1 peer in each node. Got ${peers.length}`
      );
    }
  }

  log.info("Waku node created");
  return waku;
}

export async function runMultipleNodes(
  context: Context,
  shardInfo: ShardingParams,
  numServiceNodes = 3
): Promise<[ServiceNodesFleet, LightNode]> {
  const pubsubTopics = shardInfoToPubsubTopics(shardInfo);
  // create numServiceNodes nodes
  const serviceNodes = await ServiceNodesFleet.createAndRun(
    context,
    pubsubTopics,
    numServiceNodes,
    undefined,
    shardInfo,
    { store: true }
  );

  const waku_options: ProtocolCreateOptions = {
    staticNoiseKey: NOISE_KEY_1,
    libp2p: {
      addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] }
    },
    pubsubTopics,
    shardInfo
  };

  log.info("Starting js waku node with :", JSON.stringify(waku_options));
  let waku: LightNode | undefined;
  try {
    waku = await createLightNode(waku_options);
    await waku.start();
  } catch (error) {
    log.error("jswaku node failed to start:", error);
  }

  if (!waku) {
    throw new Error("Failed to initialize waku");
  }

  for (const node of serviceNodes.nodes) {
    await waku.dial(await node.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Filter, Protocols.LightPush]);
    await node.ensureSubscriptions(pubsubTopics);

    const wakuConnections = waku.libp2p.getConnections();
    const nodePeers = await node.peers();

    if (wakuConnections.length < 1 || nodePeers.length < 1) {
      throw new Error(
        `Expected at least 1 peer in each node. Got waku connections: ${wakuConnections.length} and service nodes: ${nodePeers.length}`
      );
    }
  }

  await waitForConnections(numServiceNodes, waku);

  return [serviceNodes, waku];
}
