import {
  createDecoder,
  createEncoder,
  DecodedMessage,
  Decoder,
  DefaultPubsubTopic,
  waitForRemotePeer
} from "@waku/core";
import { LightNode, Protocols, ShardInfo } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { Logger, singleTopicShardInfoToPubsubTopic } from "@waku/utils";
import { expect } from "chai";

import { delay, NimGoNode, NOISE_KEY_1 } from "../../src";

export const log = new Logger("test:store");

export const TestContentTopic = "/test/1/waku-store/utf8";
export const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
export const TestDecoder = createDecoder(TestContentTopic);
export const customShardedPubsubTopic1 = singleTopicShardInfoToPubsubTopic({
  cluster: 3,
  index: 1
});
export const customShardedPubsubTopic2 = singleTopicShardInfoToPubsubTopic({
  cluster: 3,
  index: 2
});
export const shardInfo1: ShardInfo = { cluster: 3, indexList: [1] };
export const customContentTopic1 = "/test/2/waku-store/utf8";
export const customContentTopic2 = "/test/3/waku-store/utf8";
export const customDecoder1 = createDecoder(customContentTopic1, {
  cluster: 3,
  index: 1
});
export const customDecoder2 = createDecoder(customContentTopic2, {
  cluster: 3,
  index: 2
});
export const shardInfoBothShards: ShardInfo = { cluster: 3, indexList: [1, 2] };
export const totalMsgs = 20;
export const messageText = "Store Push works!";

export async function sendMessages(
  instance: NimGoNode,
  numMessages: number,
  contentTopic: string,
  pubsubTopic: string
): Promise<void> {
  for (let i = 0; i < numMessages; i++) {
    expect(
      await instance.sendMessage(
        NimGoNode.toMessageRpcQuery({
          payload: new Uint8Array([i]),
          contentTopic: contentTopic
        }),
        pubsubTopic
      )
    ).to.eq(true);
    await delay(1); // to ensure each timestamp is unique.
  }
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
  instance: NimGoNode,
  pubsubTopics: string[] = [DefaultPubsubTopic],
  shardInfo?: ShardInfo
): Promise<LightNode> {
  const waku = await createLightNode({
    ...((pubsubTopics.length !== 1 ||
      pubsubTopics[0] !== DefaultPubsubTopic) && {
      shardInfo: shardInfo
    }),
    staticNoiseKey: NOISE_KEY_1
  });
  await waku.start();
  await waku.dial(await instance.getMultiaddrWithId());
  await waitForRemotePeer(waku, [Protocols.Store]);
  log.info("Waku node created");
  return waku;
}

export function chunkAndReverseArray(
  arr: number[],
  chunkSize: number
): number[] {
  const result: number[] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(...arr.slice(i, i + chunkSize).reverse());
  }
  return result.reverse();
}

export const adjustDate = (baseDate: Date, adjustMs: number): Date => {
  const adjusted = new Date(baseDate);
  adjusted.setTime(adjusted.getTime() + adjustMs);
  return adjusted;
};
