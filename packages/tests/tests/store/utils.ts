import {
  createDecoder,
  createEncoder,
  DecodedMessage,
  Decoder,
  DefaultPubSubTopic,
  waitForRemotePeer
} from "@waku/core";
import { LightNode, Protocols } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";
import debug from "debug";

import { delay, NimGoNode, NOISE_KEY_1 } from "../../src";

export const log = debug("waku:test:store");

export const TestContentTopic = "/test/1/waku-store/utf8";
export const TestEncoder = createEncoder({ contentTopic: TestContentTopic });
export const TestDecoder = createDecoder(TestContentTopic);
export const customContentTopic = "/test/2/waku-store/utf8";
export const customPubSubTopic = "/waku/2/custom-dapp/proto";
export const customTestDecoder = createDecoder(
  customContentTopic,
  customPubSubTopic
);
export const totalMsgs = 20;
export const messageText = "Store Push works!";

export async function sendMessages(
  instance: NimGoNode,
  numMessages: number,
  contentTopic: string,
  pubSubTopic: string
): Promise<void> {
  for (let i = 0; i < numMessages; i++) {
    expect(
      await instance.sendMessage(
        NimGoNode.toMessageRpcQuery({
          payload: new Uint8Array([i]),
          contentTopic: contentTopic
        }),
        pubSubTopic
      )
    ).to.be.true;
    await delay(1); // to ensure each timestamp is unique.
  }
}

export async function processMessages(
  instance: LightNode,
  decoders: Array<Decoder>,
  expectedTopic: string
): Promise<DecodedMessage[]> {
  const localMessages: DecodedMessage[] = [];
  let localPromises: Promise<void>[] = [];
  for await (const msgPromises of instance.store.queryGenerator(decoders)) {
    const _promises = msgPromises.map(async (promise) => {
      const msg = await promise;
      if (msg) {
        localMessages.push(msg);
        expect(msg.pubSubTopic).to.eq(expectedTopic);
      }
    });

    localPromises = localPromises.concat(_promises);
  }
  await Promise.all(localPromises);
  return localMessages;
}

export async function startAndConnectLightNode(
  instance: NimGoNode,
  pubSubTopics: string[] = [DefaultPubSubTopic]
): Promise<LightNode> {
  const waku = await createLightNode({
    pubSubTopics: pubSubTopics,
    staticNoiseKey: NOISE_KEY_1
  });
  await waku.start();
  await waku.dial(await instance.getMultiaddrWithId());
  await waitForRemotePeer(waku, [Protocols.Store]);
  log("Waku node created");
  return waku;
}
