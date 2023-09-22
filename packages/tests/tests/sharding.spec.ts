import { createLightNode, LightNode, utf8ToBytes } from "@waku/sdk";
import { createEncoder } from "@waku/sdk";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";

import { makeLogFileName } from "../src/log_file.js";
import { NimGoNode } from "../src/node/node.js";

const PubSubTopic1 = "/waku/1/test1";
const PubSubTopic2 = "/waku/1/test2";

const ContentTopic = "/waku/1/content/test";

chai.use(chaiAsPromised);

describe("Static Sharding", () => {
  let waku: LightNode;
  let nwaku: NimGoNode;

  beforeEach(async function () {
    this.timeout(15_000);
    nwaku = new NimGoNode(makeLogFileName(this));
    await nwaku.start({ store: true, lightpush: true, relay: true });
  });

  afterEach(async function () {
    !!nwaku &&
      nwaku.stop().catch((e) => console.log("Nwaku failed to stop", e));
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("configure the node with multiple pubsub topics", async function () {
    this.timeout(15_000);
    waku = await createLightNode({
      pubSubTopics: [PubSubTopic1, PubSubTopic2]
    });

    const encoder1 = createEncoder({
      contentTopic: ContentTopic,
      pubSubTopic: PubSubTopic1
    });

    const encoder2 = createEncoder({
      contentTopic: ContentTopic,
      pubSubTopic: PubSubTopic2
    });

    const request1 = waku.lightPush.send(encoder1, {
      payload: utf8ToBytes("Hello World")
    });

    const request2 = waku.lightPush.send(encoder2, {
      payload: utf8ToBytes("Hello World")
    });

    await expect(request1).to.be.fulfilled;
    await expect(request2).to.be.fulfilled;
  });

  it("using a protocol with unconfigured pubsub topic should fail", async function () {
    this.timeout(15_000);
    waku = await createLightNode({
      pubSubTopics: [PubSubTopic1]
    });

    // use a pubsub topic that is not configured
    const encoder = createEncoder({
      contentTopic: ContentTopic,
      pubSubTopic: PubSubTopic2
    });

    // the following request should throw an error
    const request = waku.lightPush.send(encoder, {
      payload: utf8ToBytes("Hello World")
    });

    await expect(request).to.be.rejectedWith(Error);
  });
});
