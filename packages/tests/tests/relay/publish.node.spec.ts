import {
  createDecoder,
  createEncoder,
  DecodedMessage,
  DefaultPubSubTopic
} from "@waku/core";
import { RelayNode } from "@waku/interfaces";
import { createRelayNode } from "@waku/sdk";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  delay,
  MessageCollector,
  NOISE_KEY_1,
  NOISE_KEY_2,
  tearDownNodes
} from "../../src/index.js";

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

  beforeEach(async function () {
    this.timeout(10000);
    log("Starting JS Waku instances");
    [waku1, waku2] = await Promise.all([
      createRelayNode({
        pubsubTopics: [DefaultPubSubTopic],
        staticNoiseKey: NOISE_KEY_1
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        pubsubTopics: [DefaultPubSubTopic],
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      }).then((waku) => waku.start().then(() => waku))
    ]);
    log("Instances started, adding waku2 to waku1's address book");
    await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await waku1.dial(waku2.libp2p.peerId);
    log("before each hook done");
    await waitForAllRemotePeers(waku1, waku2);
  });

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([], [waku1, waku2]);
  });

  it("Publish", async function () {
    const messageTimestamp = new Date("1995-12-17T03:24:00");
    const message = {
      payload: utf8ToBytes(messageText),
      timestamp: messageTimestamp
    };

    const messageCollector = new MessageCollector();
    await waku2.relay.subscribe([TestDecoder], messageCollector.callback);

    await waku1.relay.send(TestEncoder, message);

    expect(await messageCollector.waitForMessages(1)).to.eq(true);

    messageCollector.verifyReceivedMessage(0, {
      expectedMessageText: messageText,
      expectedContentTopic: TestContentTopic,
      expectedTimestamp: messageTimestamp.valueOf()
    });
  });

  it("Filter on content topics", async function () {
    const fooMessageText = "Published on content topic foo";
    const barMessageText = "Published on content topic bar";

    const fooContentTopic = "foo";
    const barContentTopic = "bar";

    const fooEncoder = createEncoder({ contentTopic: fooContentTopic });
    const barEncoder = createEncoder({ contentTopic: barContentTopic });

    const fooDecoder = createDecoder(fooContentTopic);
    const barDecoder = createDecoder(barContentTopic);

    const fooMessages: DecodedMessage[] = [];
    void waku2.relay.subscribe([fooDecoder], (msg) => {
      fooMessages.push(msg);
    });

    const barMessages: DecodedMessage[] = [];
    void waku2.relay.subscribe([barDecoder], (msg) => {
      barMessages.push(msg);
    });

    await waku1.relay.send(barEncoder, {
      payload: utf8ToBytes(barMessageText)
    });
    await waku1.relay.send(fooEncoder, {
      payload: utf8ToBytes(fooMessageText)
    });

    while (!fooMessages.length && !barMessages.length) {
      await delay(100);
    }

    expect(fooMessages[0].contentTopic).to.eq(fooContentTopic);
    expect(bytesToUtf8(fooMessages[0].payload)).to.eq(fooMessageText);

    expect(barMessages[0].contentTopic).to.eq(barContentTopic);
    expect(bytesToUtf8(barMessages[0].payload)).to.eq(barMessageText);

    expect(fooMessages.length).to.eq(1);
    expect(barMessages.length).to.eq(1);
  });
});
