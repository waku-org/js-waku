import { createDecoder, createEncoder } from "@waku/core";
import { utf8ToBytes } from "@waku/sdk";
import { contentTopicToPubsubTopic } from "@waku/utils";

export const TestContentTopic = "/test/1/waku-filter/default";
export const ClusterId = 2;
export const TestShardInfo = {
  contentTopics: [TestContentTopic],
  clusterId: ClusterId
};
export const TestPubsubTopic = contentTopicToPubsubTopic(
  TestContentTopic,
  ClusterId
);
export const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  pubsubTopic: TestPubsubTopic
});
export const TestDecoder = createDecoder(TestContentTopic, TestPubsubTopic);
export const messageText = "Filtering works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };
