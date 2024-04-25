import { createEncoder } from "@waku/core";
import { utf8ToBytes } from "@waku/sdk";
import { contentTopicToPubsubTopic, Logger } from "@waku/utils";

import { runNodes } from "../filter/single_node/utils.js";

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

export { runNodes };
