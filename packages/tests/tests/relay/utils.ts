import { createDecoder, createEncoder, waitForRemotePeer } from "@waku/core";
import {
  Protocols,
  RelayNode,
  ShardInfo,
  ShardingParams
} from "@waku/interfaces";
import { createRelayNode } from "@waku/sdk/relay";
import { contentTopicToPubsubTopic, Logger } from "@waku/utils";
import { Context } from "mocha";

import {
  NOISE_KEY_1,
  NOISE_KEY_2,
  runNodes,
  ServiceNode
} from "../../src/index.js";

export const messageText = "Relay works!";
export const TestContentTopic = "/test/1/waku-relay/utf8";
export const TestShardInfo: ShardInfo = {
  clusterId: 2,
  shards: [4]
};
export const TestPubsubTopic = contentTopicToPubsubTopic(
  TestContentTopic,
  TestShardInfo.clusterId
);
export const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  pubsubTopic: TestPubsubTopic
});
export const TestDecoder = createDecoder(TestContentTopic, TestPubsubTopic);
export const TestWaitMessageOptions = { pubsubTopic: TestPubsubTopic };
export const TestExpectOptions = {
  expectedContentTopic: TestContentTopic,
  expectedPubsubTopic: TestPubsubTopic
};
export const log = new Logger("test:relay");

const RELAY_PROTOCOLS = [Protocols.Relay];

export async function waitForAllRemotePeers(
  ...nodes: RelayNode[]
): Promise<void> {
  log.info("Wait for mutual pubsub subscription");
  await Promise.all(
    nodes.map((node): Promise<void> => waitForRemotePeer(node, RELAY_PROTOCOLS))
  );
}

export const runRelayNodes = (
  context: Context,
  shardInfo: ShardingParams
): Promise<[ServiceNode, RelayNode]> =>
  runNodes<RelayNode>({
    shardInfo,
    context,
    protocols: RELAY_PROTOCOLS,
    createNode: createRelayNode
  });

export async function runJSNodes(): Promise<[RelayNode, RelayNode]> {
  log.info("Starting JS Waku instances");
  const [waku1, waku2] = await Promise.all([
    createRelayNode({
      staticNoiseKey: NOISE_KEY_1,
      shardInfo: TestShardInfo
    }).then((waku) => waku.start().then(() => waku)),
    createRelayNode({
      staticNoiseKey: NOISE_KEY_2,
      shardInfo: TestShardInfo,
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
