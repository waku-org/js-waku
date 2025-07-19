import { createDecoder, createEncoder } from "@waku/core";
import {
  contentTopicToShardIndex,
  createRoutingInfo,
  Logger
} from "@waku/utils";
import { utf8ToBytes } from "@waku/utils/bytes";

// Constants for test configuration.
export const log = new Logger("test:filter");
export const TestContentTopic = "/test/1/waku-filter/default";
export const TestClusterId = 2;
export const TestNumShardsInCluster = 8;
export const TestShardIndex = contentTopicToShardIndex(
  TestContentTopic,
  TestNumShardsInCluster
);
export const TestNetworkConfig = {
  clusterId: TestClusterId,
  numShardsInCluster: TestNumShardsInCluster
};
export const TestRoutingInfo = createRoutingInfo(TestNetworkConfig, {
  contentTopic: TestContentTopic
});
export const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  routingInfo: TestRoutingInfo
});
export const TestDecoder = createDecoder(TestContentTopic, TestRoutingInfo);
export const messageText = "Filtering works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };
