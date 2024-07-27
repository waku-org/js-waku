import { waitForRemotePeer } from "@waku/core";
import {
  LightNode,
  ProtocolCreateOptions,
  Protocols,
  ShardingParams,
  Waku
} from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { isDefined, shardInfoToPubsubTopics } from "@waku/utils";
import { Context } from "mocha";
import pRetry from "p-retry";

import { DefaultTestPubsubTopic, NOISE_KEY_1 } from "../constants";
import { ServiceNodesFleet } from "../lib";
import { Args } from "../types";

import { waitForConnections } from "./waitForConnections";

export async function runMultipleNodes(
  context: Context,
  shardInfo?: ShardingParams,
  customArgs?: Args,
  strictChecking: boolean = false,
  numServiceNodes = 3,
  withoutFilter = false
): Promise<[ServiceNodesFleet, LightNode]> {
  const pubsubTopics = shardInfo
    ? shardInfoToPubsubTopics(shardInfo)
    : [DefaultTestPubsubTopic];
  // create numServiceNodes nodes
  const serviceNodes = await ServiceNodesFleet.createAndRun(
    context,
    pubsubTopics,
    numServiceNodes,
    strictChecking,
    shardInfo,
    customArgs,
    withoutFilter
  );

  const wakuOptions: ProtocolCreateOptions = {
    staticNoiseKey: NOISE_KEY_1,
    libp2p: {
      addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] }
    }
  };

  if (shardInfo) {
    wakuOptions.shardInfo = shardInfo;
  } else {
    wakuOptions.pubsubTopics = pubsubTopics;
  }

  const waku = await createLightNode(wakuOptions);
  await waku.start();

  if (!waku) {
    throw new Error("Failed to initialize waku");
  }

  for (const node of serviceNodes.nodes) {
    await waku.dial(await node.getMultiaddrWithId());
    await waitForRemotePeer(
      waku,
      [
        !customArgs?.filter ? undefined : Protocols.Filter,
        !customArgs?.lightpush ? undefined : Protocols.LightPush
      ].filter(isDefined)
    );
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

export async function teardownNodesWithRedundancy(
  serviceNodes: ServiceNodesFleet,
  wakuNodes: Waku | Waku[]
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
