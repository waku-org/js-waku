import { createEncoder, DefaultPubsubTopic } from "@waku/core";
import { IRateLimitProof, RelayNode, SendError } from "@waku/interfaces";
import { createRelayNode } from "@waku/sdk";
import { utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  delay,
  MessageCollector,
  NOISE_KEY_1,
  NOISE_KEY_2,
  tearDownNodes,
  TEST_STRING
} from "../../src/index.js";
import { generateRandomUint8Array } from "../../src/random_array.js";

import {
  log,
  messageText,
  TestContentTopic,
  TestDecoder,
  TestEncoder,
  waitForAllRemotePeers
} from "./utils.js";

describe("Waku Relay, Publish", function () {
  this.timeout(15000);
  let waku1: RelayNode;
  let waku2: RelayNode;
  let messageCollector: MessageCollector;

  beforeEach(async function () {
    this.timeout(10000);
    log.info("Starting JS Waku instances");
    [waku1, waku2] = await Promise.all([
      createRelayNode({
        pubsubTopics: [DefaultPubsubTopic],
        staticNoiseKey: NOISE_KEY_1
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        pubsubTopics: [DefaultPubsubTopic],
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      }).then((waku) => waku.start().then(() => waku))
    ]);
    log.info("Instances started, adding waku2 to waku1's address book");
    await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await waku1.dial(waku2.libp2p.peerId);
    log.info("before each hook done");
    await waitForAllRemotePeers(waku1, waku2);
    messageCollector = new MessageCollector();
    await waku2.relay.subscribe([TestDecoder], messageCollector.callback);
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([], [waku1, waku2]);
  });

  TEST_STRING.forEach((testItem) => {
    it(`Check publish message containing ${testItem.description}`, async function () {
      const pushResponse = await waku1.relay.send(TestEncoder, {
        payload: utf8ToBytes(testItem.value)
      });
      expect(pushResponse.recipients.length).to.eq(1);
      expect(pushResponse.recipients[0].toString()).to.eq(
        waku2.libp2p.peerId.toString()
      );
      expect(await messageCollector.waitForMessages(1)).to.eq(true);
      messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: testItem.value,
        expectedContentTopic: TestContentTopic
      });
    });
  });

  [
    new Date("1995-12-17T03:24:00"),
    new Date(Date.now() - 3600000 * 24 * 356),
    new Date(Date.now() - 3600000),
    new Date(Date.now() + 3600000)
  ].forEach((testItem) => {
    it(`Publish message with custom timestamp: ${testItem}`, async function () {
      const pushResponse = await waku1.relay.send(TestEncoder, {
        payload: utf8ToBytes(messageText),
        timestamp: testItem
      });

      expect(pushResponse.recipients.length).to.eq(1);
      expect(pushResponse.recipients[0].toString()).to.eq(
        waku2.libp2p.peerId.toString()
      );

      expect(await messageCollector.waitForMessages(1)).to.eq(true);

      messageCollector.verifyReceivedMessage(0, {
        expectedMessageText: messageText,
        expectedContentTopic: TestContentTopic,
        expectedTimestamp: testItem.valueOf()
      });
    });
  });

  it("Fails to publish duplicate message", async function () {
    await waku1.relay.send(TestEncoder, { payload: utf8ToBytes("m1") });
    try {
      await waku1.relay.send(TestEncoder, { payload: utf8ToBytes("m1") });
      await waku1.relay.send(TestEncoder, { payload: utf8ToBytes("m1") });
      expect.fail("Expected an error but didn't get one");
    } catch (error) {
      expect((error as Error).message).to.include("PublishError.Duplicate");
    }
  });

  it("Fails to publish message with empty text", async function () {
    await waku1.relay.send(TestEncoder, { payload: utf8ToBytes("") });
    await delay(400);
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Fails to publish message with wrong content topic", async function () {
    const wrong_encoder = createEncoder({ contentTopic: "wrong" });
    await waku1.relay.send(wrong_encoder, {
      payload: utf8ToBytes("")
    });
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  it("Fails to publish message with wrong pubsubtopic", async function () {
    const wrong_encoder = createEncoder({
      pubsubTopic: "wrong",
      contentTopic: TestContentTopic
    });
    const pushResponse = await waku1.relay.send(wrong_encoder, {
      payload: utf8ToBytes("")
    });
    expect(pushResponse.errors?.[0]).to.eq("Topic not configured");
    await delay(400);
    expect(await messageCollector.waitForMessages(1)).to.eq(false);
  });

  [1024 ** 2 + 65536, 2 * 1024 ** 2].forEach((testItem) => {
    it("Fails to publish message with size larger than 1 MB", async function () {
      const pushResponse = await waku1.relay.send(TestEncoder, {
        payload: generateRandomUint8Array(testItem)
      });
      expect(pushResponse.recipients.length).to.eq(0);
      expect(pushResponse.errors).to.include(SendError.SIZE_TOO_BIG);
      await delay(400);
      expect(await messageCollector.waitForMessages(1)).to.eq(false);
    });
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
  it.skip("Check publish message after service node is restarted", async function () {
    await waku1.relay.send(TestEncoder, {
      payload: utf8ToBytes("m1")
    });

    // Restart js-waku node
    await waku1.stop();
    expect(waku1.isStarted()).to.eq(false);
    await waku1.start();
    expect(waku1.isStarted()).to.eq(true);
    await waku1.dial(waku2.libp2p.peerId);

    // Redo the connection and create a new subscription
    await waitForAllRemotePeers(waku1, waku2);
    const pushResponse = await waku1.relay.send(TestEncoder, {
      payload: utf8ToBytes("m2")
    });
    expect(pushResponse.recipients.length).to.eq(1);
    expect(pushResponse.recipients[0].toString()).to.eq(
      waku2.libp2p.peerId.toString()
    );
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
  });

  // Will be skipped until https://github.com/waku-org/js-waku/issues/1464 si done
  it.skip("Check publish message after client node is restarted", async function () {
    await waku1.relay.send(TestEncoder, {
      payload: utf8ToBytes("m1")
    });

    // Restart js-waku node
    await waku2.stop();
    expect(waku2.isStarted()).to.eq(false);
    await waku2.start();
    expect(waku2.isStarted()).to.eq(true);
    await waku1.dial(waku2.libp2p.peerId);

    // Redo the connection and create a new subscription
    await waitForAllRemotePeers(waku1, waku2);
    const pushResponse = await waku1.relay.send(TestEncoder, {
      payload: utf8ToBytes("m2")
    });
    expect(pushResponse.recipients.length).to.eq(1);
    expect(pushResponse.recipients[0].toString()).to.eq(
      waku2.libp2p.peerId.toString()
    );
    expect(await messageCollector.waitForMessages(2)).to.eq(true);
  });

  it("Publish message with large meta", async function () {
    const customTestEncoder = createEncoder({
      contentTopic: TestContentTopic,
      metaSetter: () => new Uint8Array(10 ** 6)
    });

    const pushResponse = await waku1.relay.send(customTestEncoder, {
      payload: utf8ToBytes(messageText)
    });
    expect(pushResponse.recipients.length).to.eq(1);
    expect(pushResponse.recipients[0].toString()).to.eq(
      waku2.libp2p.peerId.toString()
    );
    expect(await messageCollector.waitForMessages(1)).to.eq(true);
  });

  it("Publish message with rate limit", async function () {
    const rateLimitProof: IRateLimitProof = {
      proof: utf8ToBytes("proofData"),
      merkleRoot: utf8ToBytes("merkleRootData"),
      epoch: utf8ToBytes("epochData"),
      shareX: utf8ToBytes("shareXData"),
      shareY: utf8ToBytes("shareYData"),
      nullifier: utf8ToBytes("nullifierData"),
      rlnIdentifier: utf8ToBytes("rlnIdentifierData")
    };

    const pushResponse = await waku1.relay.send(TestEncoder, {
      payload: utf8ToBytes(messageText),
      rateLimitProof: rateLimitProof
    });
    expect(pushResponse.recipients.length).to.eq(1);

    expect(await messageCollector.waitForMessages(1)).to.eq(true);
    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic
    });
  });
});
