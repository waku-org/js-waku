import { createDecoder, createEncoder } from "@waku/core";
import {
  AutoSharding,
  ContentTopic,
  NetworkConfig,
  Protocols,
  RelayNode,
  type ShardId
} from "@waku/interfaces";
import { createRelayNode } from "@waku/relay";
import { createRoutingInfo, Logger } from "@waku/utils";
import { Context } from "mocha";

import {
  NOISE_KEY_1,
  NOISE_KEY_2,
  runNodes,
  ServiceNode
} from "../../src/index.js";

export const TestClusterId = 4;
export const messageText = "Relay works!";
export const TestContentTopic = "/test/0/waku-relay/utf8";

export const TestNetworkConfig: AutoSharding = {
  clusterId: TestClusterId,
  numShardsInCluster: 8
};
export const TestRoutingInfo = createRoutingInfo(TestNetworkConfig, {
  contentTopic: TestContentTopic
});
export const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  routingInfo: TestRoutingInfo
});
export const TestDecoder = createDecoder(TestContentTopic, TestRoutingInfo);
export const TestExpectOptions = {
  expectedContentTopic: TestContentTopic,
  expectedPubsubTopic: TestRoutingInfo.pubsubTopic
};
export const log = new Logger("test:relay");

const RELAY_PROTOCOLS = [Protocols.Relay];

export async function waitForAllRemotePeers(
  ...nodes: RelayNode[]
): Promise<void> {
  log.info("Wait for mutual pubsub subscription");
  await Promise.all(
    nodes.map((node): Promise<void> => node.waitForPeers(RELAY_PROTOCOLS))
  );
}

export const runRelayNodes = (
  context: Context,
  networkConfig: NetworkConfig,
  relayShards?: ShardId[], // Only for static sharding
  contentTopics?: ContentTopic[] // Only for auto sharding
): Promise<[ServiceNode, RelayNode]> =>
  runNodes<RelayNode>({
    networkConfig,
    relayShards,
    contentTopics,
    context,
    protocols: RELAY_PROTOCOLS,
    createNode: createRelayNode
  });

export async function runJSNodes(): Promise<[RelayNode, RelayNode]> {
  log.info("Starting JS Waku instances");
  const [waku1, waku2] = await Promise.all([
    createRelayNode({
      routingInfos: [TestRoutingInfo],
      staticNoiseKey: NOISE_KEY_1,
      networkConfig: TestNetworkConfig
    }).then((waku) => waku.start().then(() => waku)),
    createRelayNode({
      routingInfos: [TestRoutingInfo],
      staticNoiseKey: NOISE_KEY_2,
      networkConfig: TestNetworkConfig,
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
    }).then((waku) => waku.start().then(() => waku))
  ]);
  log.info("Instances started, adding waku2 to waku1's address book");
  await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
    multiaddrs: waku2.libp2p.getMultiaddrs()
  });
  await waku1.dial(waku2.libp2p.peerId);
  log.info("before each hook done");
  await waitForAllRemotePeers(waku1, waku2);

  return [waku1, waku2];
}
