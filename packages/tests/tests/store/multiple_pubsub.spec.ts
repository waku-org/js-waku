import { createDecoder, waitForRemotePeer } from "@waku/core";
import type { IMessage, LightNode } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";

import {
  makeLogFileName,
  NimGoNode,
  NOISE_KEY_1,
  tearDownNodes
} from "../../src/index.js";

const customPubSubTopic = "/waku/2/custom-dapp/proto";
const TestContentTopic = "/test/1/waku-store/utf8";
const CustomPubSubTestDecoder = createDecoder(
  TestContentTopic,
  customPubSubTopic
);

describe("Waku Store, custom pubsub topic", () => {
  let waku: LightNode;
  let nwaku: NimGoNode;

  beforeEach(async function () {
    this.timeout(15000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.startWithRetries({
      store: true,
      topic: customPubSubTopic,
      relay: true
    });
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([nwaku], [waku]);
  });

  it("Generator, custom pubsub topic", async function () {
    this.timeout(15000);

    const totalMsgs = 20;
    for (let i = 0; i < totalMsgs; i++) {
      expect(
        await nwaku.sendMessage(
          NimGoNode.toMessageRpcQuery({
            payload: new Uint8Array([i]),
            contentTopic: TestContentTopic
          }),
          customPubSubTopic
        )
      ).to.be.true;
    }

    waku = await createLightNode({
      staticNoiseKey: NOISE_KEY_1,
      pubSubTopics: [customPubSubTopic]
    });
    await waku.start();
    await waku.dial(await nwaku.getMultiaddrWithId());
    await waitForRemotePeer(waku, [Protocols.Store]);

    const messages: IMessage[] = [];
    let promises: Promise<void>[] = [];
    for await (const msgPromises of waku.store.queryGenerator([
      CustomPubSubTestDecoder
    ])) {
      const _promises = msgPromises.map(async (promise) => {
        const msg = await promise;
        if (msg) {
          messages.push(msg);
          expect(msg.pubSubTopic).to.eq(customPubSubTopic);
        }
      });

      promises = promises.concat(_promises);
    }
    await Promise.all(promises);

    expect(messages?.length).eq(totalMsgs);
    const result = messages?.findIndex((msg) => {
      return msg.payload![0]! === 0;
    });
    expect(result).to.not.eq(-1);
  });
});
