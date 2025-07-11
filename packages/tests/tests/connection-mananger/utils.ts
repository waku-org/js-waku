import { createRoutingInfo } from "@waku/utils";

export const TestContentTopic = "/test/1/waku-light-push/utf8";
export const TestClusterId = 2;
export const TestNetworkConfig = {
  clusterId: TestClusterId,
  numShardsInCluster: 8 // Cannot be under 8 for nwaku 0.36.0 and below
};
export const TestRoutingInfo = createRoutingInfo(TestNetworkConfig, {
  contentTopic: TestContentTopic
});
