import {
  createDecoder,
  createEncoder,
  DecodedMessage,
  Decoder
} from "@waku/core";
import {
  type AutoSharding,
  ContentTopic,
  LightNode,
  type NetworkConfig,
  Protocols,
  ShardId
} from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { createRoutingInfo, Logger, RoutingInfo } from "@waku/utils";
import { expect } from "chai";
import { Context } from "mocha";

import { delay, NOISE_KEY_1, runNodes, ServiceNode } from "../../src/index.js";
import { MessageRpcQuery } from "../../src/types.js";

export const log = new Logger("test:store");

export const TestClusterId = 5;
export const TestNetworkConfig: AutoSharding = {
  clusterId: TestClusterId,
  numShardsInCluster: 8
};

export const TestContentTopic = "/test/1/waku-store/utf8";
export const TestRoutingInfo = createRoutingInfo(TestNetworkConfig, {
  contentTopic: TestContentTopic
});

export const TestPubsubTopic = TestRoutingInfo.pubsubTopic;

export const TestEncoder = createEncoder({
  contentTopic: TestContentTopic,
  routingInfo: TestRoutingInfo
});
export const TestDecoder = createDecoder(TestContentTopic, TestRoutingInfo);

export const TestContentTopic2 = "/test/12/waku-store/utf8";
export const TestRoutingInfo2 = createRoutingInfo(TestNetworkConfig, {
  contentTopic: TestContentTopic2
});

export const TestDecoder2 = createDecoder(TestContentTopic2, TestRoutingInfo2);

export const totalMsgs = 20;
export const messageText = "Store Push works!";

export async function sendMessages(
  instance: ServiceNode,
  numMessages: number,
  contentTopic: string,
  routingInfo: RoutingInfo,
  timestamp: boolean = false
): Promise<MessageRpcQuery[]> {
  const messages: MessageRpcQuery[] = new Array<MessageRpcQuery>(numMessages);
  for (let i = 0; i < numMessages; i++) {
    messages[i] = ServiceNode.toMessageRpcQuery({
      payload: new Uint8Array([i]),
      contentTopic: contentTopic,
      timestamp: timestamp ? new Date() : undefined
    });
    expect(await instance.sendMessage(messages[i], routingInfo)).to.eq(true);
    await delay(1); // to ensure each timestamp is unique.
  }
  return messages;
}

export async function processQueriedMessages(
  instance: LightNode,
  decoders: Array<Decoder>,
  expectedTopic?: string
): Promise<DecodedMessage[]> {
  const localMessages: DecodedMessage[] = [];
  for await (const query of instance.store.queryGenerator(decoders)) {
    for await (const msg of query) {
      if (msg) {
        expect(msg.pubsubTopic).to.eq(expectedTopic);
        localMessages.push(msg as DecodedMessage);
      }
    }
  }
  return localMessages;
}

export async function startAndConnectLightNode(
  instance: ServiceNode,
  networkConfig: NetworkConfig
): Promise<LightNode> {
  const waku = await createLightNode({
    staticNoiseKey: NOISE_KEY_1,
    libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
    networkConfig: networkConfig
  });
  await waku.start();
  await waku.dial(await instance.getMultiaddrWithId());
  await waku.waitForPeers([Protocols.Store]);

  const wakuConnections = waku.libp2p.getConnections();

  if (wakuConnections.length < 1) {
    throw new Error(`Expected at least 1 connection for js-waku.`);
  }

  await instance.waitForLog(waku.libp2p.peerId.toString(), 100);

  log.info("Waku node created");
  return waku;
}

export const adjustDate = (baseDate: Date, adjustMs: number): Date => {
  const adjusted = new Date(baseDate);
  adjusted.setTime(adjusted.getTime() + adjustMs);
  return adjusted;
};

export const runStoreNodes = (
  context: Context,
  networkConfig: NetworkConfig,
  shardIds?: ShardId[],
  contentTopics?: ContentTopic[]
): Promise<[ServiceNode, LightNode]> =>
  runNodes({
    context,
    networkConfig,
    createNode: createLightNode,
    relayShards: shardIds,
    contentTopics,
    protocols: [Protocols.Store]
  });
