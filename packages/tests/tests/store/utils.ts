import { Decoder, waitForRemotePeer } from "@waku/core";
import { IMessage, LightNode, Protocols } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";

import { delay, NimGoNode, NOISE_KEY_1 } from "../../src";

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
  }
  await delay(1); // to ensure each timestamp is unique.
}

export async function processMessages(
  instance: LightNode,
  decoders: Array<Decoder>,
  expectedTopic: string
): Promise<IMessage[]> {
  const localMessages: IMessage[] = [];
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
  instance: NimGoNode
): Promise<LightNode> {
  const waku = await createLightNode({
    staticNoiseKey: NOISE_KEY_1
  });
  await waku.start();
  await waku.dial(await instance.getMultiaddrWithId());
  await waitForRemotePeer(waku, [Protocols.Store]);
  return waku;
}
