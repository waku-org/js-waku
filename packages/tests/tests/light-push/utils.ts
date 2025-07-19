import { createEncoder } from "@waku/core";
import { utf8ToBytes } from "@waku/sdk";
import { createRoutingInfo, Logger } from "@waku/utils";

// Constants for test configuration.
export const log = new Logger("test:lightpush");
export const TestContentTopic = "/test/1/waku-light-push/utf8";
export const TestClusterId = 3;
export const TestNumShardsInCluster = 8;
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
export const messageText = "Light Push works!";
export const messagePayload = { payload: utf8ToBytes(messageText) };
