import { createDecoder, createEncoder, waitForRemotePeer } from "@waku/core";
import { Protocols, RelayNode, ShardInfo } from "@waku/interfaces";
import { contentTopicToPubsubTopic, Logger } from "@waku/utils";

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

export async function waitForAllRemotePeers(
  ...nodes: RelayNode[]
): Promise<void> {
  log.info("Wait for mutual pubsub subscription");
  await Promise.all(
    nodes.map((node) => waitForRemotePeer(node, [Protocols.Relay]))
  );
}
