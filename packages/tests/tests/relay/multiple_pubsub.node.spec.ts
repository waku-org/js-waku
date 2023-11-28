import {
  createDecoder,
  createEncoder,
  DecodedMessage,
  waitForRemotePeer
} from "@waku/core";
import { RelayNode, ShardInfo, SingleShardInfo } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { createRelayNode } from "@waku/sdk";
import { singleShardInfoToPubsubTopic } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  MessageCollector,
  NOISE_KEY_1,
  NOISE_KEY_2,
  NOISE_KEY_3,
  tearDownNodes
} from "../../src/index.js";
import { TestDecoder } from "../filter/utils.js";

describe("Waku Relay, multiple pubsub topics", function () {
  this.timeout(15000);
  let waku1: RelayNode;
  let waku2: RelayNode;
  let waku3: RelayNode;

  const customPubsubTopic1 = singleShardInfoToPubsubTopic({
    cluster: 3,
    index: 1
  });
  const customPubsubTopic2 = singleShardInfoToPubsubTopic({
    cluster: 3,
    index: 2
  });
  const shardInfo1: ShardInfo = { cluster: 3, indexList: [1] };
  const singleShardInfo1: SingleShardInfo = {
    cluster: 3,
    index: 1
  };
  const customContentTopic1 = "/test/2/waku-relay/utf8";
  const customContentTopic2 = "/test/3/waku-relay/utf8";
  const shardInfo2: ShardInfo = { cluster: 3, indexList: [2] };
  const singleShardInfo2: SingleShardInfo = {
    cluster: 3,
    index: 2
  };
  const customEncoder1 = createEncoder({
    pubsubTopicShardInfo: singleShardInfo1,
    contentTopic: customContentTopic1
  });
  const customDecoder1 = createDecoder(customContentTopic1, singleShardInfo1);
  const customEncoder2 = createEncoder({
    pubsubTopicShardInfo: singleShardInfo2,
    contentTopic: customContentTopic2
  });
  const customDecoder2 = createDecoder(customContentTopic2, singleShardInfo2);
  const shardInfoBothShards: ShardInfo = { cluster: 3, indexList: [1, 2] };

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes([], [waku1, waku2, waku3]);
  });

  [
    {
      pubsub: customPubsubTopic1,
      shardInfo: shardInfo1,
      encoder: customEncoder1,
      decoder: customDecoder1
    },
    {
      pubsub: customPubsubTopic2,
      shardInfo: shardInfo2,
      encoder: customEncoder2,
      decoder: customDecoder2
    }
  ].forEach((testItem) => {
    it(`3 nodes on ${testItem.pubsub} topic`, async function () {
      const [msgCollector1, msgCollector2, msgCollector3] = Array(3)
        .fill(null)
        .map(() => new MessageCollector());

      [waku1, waku2, waku3] = await Promise.all([
        createRelayNode({
          shardInfo: testItem.shardInfo,
          staticNoiseKey: NOISE_KEY_1
        }).then((waku) => waku.start().then(() => waku)),
        createRelayNode({
          shardInfo: testItem.shardInfo,
          staticNoiseKey: NOISE_KEY_2,
          libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
        }).then((waku) => waku.start().then(() => waku)),
        createRelayNode({
          shardInfo: testItem.shardInfo,
          staticNoiseKey: NOISE_KEY_3
        }).then((waku) => waku.start().then(() => waku))
      ]);

      await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
        multiaddrs: waku2.libp2p.getMultiaddrs()
      });
      await waku3.libp2p.peerStore.merge(waku2.libp2p.peerId, {
        multiaddrs: waku2.libp2p.getMultiaddrs()
      });
      await Promise.all([
        waku1.dial(waku2.libp2p.peerId),
        waku3.dial(waku2.libp2p.peerId)
      ]);

      await Promise.all([
        waitForRemotePeer(waku1, [Protocols.Relay]),
        waitForRemotePeer(waku2, [Protocols.Relay]),
        waitForRemotePeer(waku3, [Protocols.Relay])
      ]);

      await waku1.relay.subscribe([testItem.decoder], msgCollector1.callback);
      await waku2.relay.subscribe([testItem.decoder], msgCollector2.callback);
      await waku3.relay.subscribe([testItem.decoder], msgCollector3.callback);

      // The nodes are setup in such a way that all messages send should be relayed to the other nodes in the network
      const relayResponse1 = await waku1.relay.send(testItem.encoder, {
        payload: utf8ToBytes("M1")
      });
      const relayResponse2 = await waku2.relay.send(testItem.encoder, {
        payload: utf8ToBytes("M2")
      });
      const relayResponse3 = await waku3.relay.send(testItem.encoder, {
        payload: utf8ToBytes("M3")
      });

      expect(relayResponse1.recipients[0].toString()).to.eq(
        waku2.libp2p.peerId.toString()
      );
      expect(relayResponse3.recipients[0].toString()).to.eq(
        waku2.libp2p.peerId.toString()
      );
      expect(relayResponse2.recipients.map((r) => r.toString())).to.include(
        waku1.libp2p.peerId.toString()
      );
      expect(relayResponse2.recipients.map((r) => r.toString())).to.include(
        waku3.libp2p.peerId.toString()
      );

      expect(await msgCollector1.waitForMessages(2, { exact: true })).to.eq(
        true
      );
      expect(await msgCollector2.waitForMessages(2, { exact: true })).to.eq(
        true
      );
      expect(await msgCollector3.waitForMessages(2, { exact: true })).to.eq(
        true
      );

      expect(
        msgCollector1.hasMessage(testItem.encoder.contentTopic, "M2")
      ).to.eq(true);
      expect(
        msgCollector1.hasMessage(testItem.encoder.contentTopic, "M3")
      ).to.eq(true);
      expect(
        msgCollector2.hasMessage(testItem.encoder.contentTopic, "M1")
      ).to.eq(true);
      expect(
        msgCollector2.hasMessage(testItem.encoder.contentTopic, "M3")
      ).to.eq(true);
      expect(
        msgCollector3.hasMessage(testItem.encoder.contentTopic, "M1")
      ).to.eq(true);
      expect(
        msgCollector3.hasMessage(testItem.encoder.contentTopic, "M2")
      ).to.eq(true);
    });
  });

  it("Nodes with multiple pubsub topic", async function () {
    const [msgCollector1, msgCollector2, msgCollector3] = Array(3)
      .fill(null)
      .map(() => new MessageCollector());

    // Waku1 and waku2 are using multiple pubsub topis
    [waku1, waku2, waku3] = await Promise.all([
      createRelayNode({
        shardInfo: shardInfoBothShards,
        staticNoiseKey: NOISE_KEY_1
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        shardInfo: shardInfoBothShards,
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        shardInfo: shardInfo1,
        staticNoiseKey: NOISE_KEY_3
      }).then((waku) => waku.start().then(() => waku))
    ]);

    await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await waku3.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await Promise.all([
      waku1.dial(waku2.libp2p.peerId),
      waku3.dial(waku2.libp2p.peerId)
    ]);

    await Promise.all([
      waitForRemotePeer(waku1, [Protocols.Relay]),
      waitForRemotePeer(waku2, [Protocols.Relay]),
      waitForRemotePeer(waku3, [Protocols.Relay])
    ]);

    await waku1.relay.subscribe(
      [customDecoder1, customDecoder2],
      msgCollector1.callback
    );
    await waku2.relay.subscribe(
      [customDecoder1, customDecoder2],
      msgCollector2.callback
    );
    await waku3.relay.subscribe([customDecoder1], msgCollector3.callback);

    // The nodes are setup in such a way that all messages send should be relayed to the other nodes in the network
    // However onlt waku1 and waku2 are receiving messages on the CustomPubSubTopic
    await waku1.relay.send(customEncoder1, { payload: utf8ToBytes("M1") });
    await waku1.relay.send(customEncoder2, { payload: utf8ToBytes("M2") });
    await waku2.relay.send(customEncoder1, { payload: utf8ToBytes("M3") });
    await waku2.relay.send(customEncoder2, { payload: utf8ToBytes("M4") });
    await waku3.relay.send(customEncoder1, { payload: utf8ToBytes("M5") });
    await waku3.relay.send(customEncoder2, { payload: utf8ToBytes("M6") });

    expect(await msgCollector1.waitForMessages(3, { exact: true })).to.eq(true);
    expect(await msgCollector2.waitForMessages(3, { exact: true })).to.eq(true);
    expect(await msgCollector3.waitForMessages(2, { exact: true })).to.eq(true);
    expect(msgCollector1.hasMessage(customContentTopic1, "M3")).to.eq(true);
    expect(msgCollector1.hasMessage(customContentTopic2, "M4")).to.eq(true);
    expect(msgCollector1.hasMessage(customContentTopic1, "M5")).to.eq(true);
    expect(msgCollector2.hasMessage(customContentTopic1, "M1")).to.eq(true);
    expect(msgCollector2.hasMessage(customContentTopic2, "M2")).to.eq(true);
    expect(msgCollector2.hasMessage(customContentTopic1, "M5")).to.eq(true);
    expect(msgCollector3.hasMessage(customContentTopic1, "M1")).to.eq(true);
    expect(msgCollector3.hasMessage(customContentTopic1, "M3")).to.eq(true);
  });

  it("n1 and n2 uses a custom pubsub, n3 uses the default pubsub", async function () {
    [waku1, waku2, waku3] = await Promise.all([
      createRelayNode({
        shardInfo: shardInfo1,
        staticNoiseKey: NOISE_KEY_1
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        shardInfo: shardInfo1,
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        staticNoiseKey: NOISE_KEY_3
      }).then((waku) => waku.start().then(() => waku))
    ]);

    await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await waku3.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await Promise.all([
      waku1.dial(waku2.libp2p.peerId),
      waku3.dial(waku2.libp2p.peerId)
    ]);

    await Promise.all([
      waitForRemotePeer(waku1, [Protocols.Relay]),
      waitForRemotePeer(waku2, [Protocols.Relay])
    ]);

    const messageText = "Communicating using a custom pubsub topic";

    const waku2ReceivedMsgPromise: Promise<DecodedMessage> = new Promise(
      (resolve) => {
        void waku2.relay.subscribe([customDecoder1], resolve);
      }
    );

    // The promise **fails** if we receive a message on the default
    // pubsub topic.
    const waku3NoMsgPromise: Promise<DecodedMessage> = new Promise(
      (resolve, reject) => {
        void waku3.relay.subscribe([TestDecoder], reject);
        setTimeout(resolve, 1000);
      }
    );

    await waku1.relay.send(customEncoder1, {
      payload: utf8ToBytes(messageText)
    });

    const waku2ReceivedMsg = await waku2ReceivedMsgPromise;
    await waku3NoMsgPromise;

    expect(bytesToUtf8(waku2ReceivedMsg.payload!)).to.eq(messageText);
    expect(waku2ReceivedMsg.pubsubTopic).to.eq(customPubsubTopic1);
  });
});
