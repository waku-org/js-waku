import { createEncoder } from "@waku/core";
import { LightNode, NetworkConfig, Protocols } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/sdk";
import { createLightNode } from "@waku/sdk";
import { contentTopicToPubsubTopic, Logger } from "@waku/utils";
import { Context } from "mocha";

import { runNodes as runNodesBuilder, ServiceNode } from "../../src/index.js";

// Constants for test configuration.
export const log = new Logger("test:lightpush");
export const TestContentTopic = "/test/1/waku-light-push/utf8";
export const ClusterId = 3;
export const TestPubsubTopic = contentTopicToPubsubTopic(
  TestContentTopic,
  ClusterId
);
export const TestShardInfo = {
  contentTopics: [TestContentTopic],
  clusterId: ClusterId
};
export const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  pubsubTopic: TestPubsubTopic
});
export const messageText = "Light Push works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };

export const runNodes = (
  context: Context,
  shardInfo: NetworkConfig
): Promise<[ServiceNode, LightNode]> =>
  runNodesBuilder<LightNode>({
    context,
    createNode: createLightNode,
    protocols: [Protocols.LightPush, Protocols.Filter],
    networkConfig: shardInfo
  });
