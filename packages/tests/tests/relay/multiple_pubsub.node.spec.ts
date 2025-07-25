import { createDecoder, createEncoder } from "@waku/core";
import { IDecodedMessage, Protocols, RelayNode } from "@waku/interfaces";
import { createRelayNode } from "@waku/relay";
import { createRoutingInfo } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import {
  afterEachCustom,
  MessageCollector,
  NOISE_KEY_1,
  NOISE_KEY_2,
  NOISE_KEY_3,
  tearDownNodes
} from "../../src/index.js";
import { TestDecoder } from "../filter/utils.js";

describe("Waku Relay, static sharding, multiple pubsub topics", function () {
  this.timeout(15000);
  let waku1: RelayNode;
  let waku2: RelayNode;
  let waku3: RelayNode;

  const clusterId = 3;
  const networkConfig = { clusterId };

  const shardOne = 1;
  const shardTwo = 2;

  const customContentTopic1 = "/test/2/waku-relay/utf8";
  const customContentTopic2 = "/test/3/waku-relay/utf8";

  const routingInfoOne = createRoutingInfo(networkConfig, {
    shardId: shardOne
  });
  const routingInfoTwo = createRoutingInfo(networkConfig, {
    shardId: shardTwo
  });

  const customEncoder1 = createEncoder({
    contentTopic: customContentTopic1,
    routingInfo: routingInfoOne
  });
  const customDecoder1 = createDecoder(customContentTopic1, routingInfoOne);
  const customEncoder2 = createEncoder({
    contentTopic: customContentTopic2,
    routingInfo: routingInfoTwo
  });
  const customDecoder2 = createDecoder(customContentTopic2, routingInfoTwo);

  afterEachCustom(this, async () => {
    await tearDownNodes([], [waku1, waku2, waku3]);
  });

  [
    {
      routingInfo: routingInfoOne,
      encoder: customEncoder1,
      decoder: customDecoder1
    },
    {
      routingInfo: routingInfoTwo,
      encoder: customEncoder2,
      decoder: customDecoder2
    }
  ].forEach((testItem) => {
    it(`3 nodes on ${testItem.routingInfo.pubsubTopic} topic`, async function () {
      const [msgCollector1, msgCollector2, msgCollector3] = Array(3)
        .fill(null)
        .map(() => new MessageCollector());

      [waku1, waku2, waku3] = await Promise.all([
        createRelayNode({
          networkConfig: networkConfig,
          routingInfos: [testItem.routingInfo],
          staticNoiseKey: NOISE_KEY_1
        }).then((waku) => waku.start().then(() => waku)),
        createRelayNode({
          networkConfig: networkConfig,
          routingInfos: [testItem.routingInfo],
          staticNoiseKey: NOISE_KEY_2,
          libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
        }).then((waku) => waku.start().then(() => waku)),
        createRelayNode({
          networkConfig: networkConfig,
          routingInfos: [testItem.routingInfo],
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
        waku1.waitForPeers([Protocols.Relay]),
        waku2.waitForPeers([Protocols.Relay]),
        waku2.waitForPeers([Protocols.Relay])
      ]);

      await waku1.relay.subscribeWithUnsubscribe(
        [testItem.decoder],
        msgCollector1.callback
      );
      await waku2.relay.subscribeWithUnsubscribe(
        [testItem.decoder],
        msgCollector2.callback
      );
      await waku3.relay.subscribeWithUnsubscribe(
        [testItem.decoder],
        msgCollector3.callback
      );

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

      expect(relayResponse1.successes[0].toString()).to.eq(
        waku2.libp2p.peerId.toString()
      );
      expect(relayResponse3.successes[0].toString()).to.eq(
        waku2.libp2p.peerId.toString()
      );
      expect(relayResponse2.successes.map((r) => r.toString())).to.include(
        waku1.libp2p.peerId.toString()
      );
      expect(relayResponse2.successes.map((r) => r.toString())).to.include(
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
        networkConfig: networkConfig,
        routingInfos: [routingInfoOne, routingInfoTwo],
        staticNoiseKey: NOISE_KEY_1
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        networkConfig: networkConfig,
        routingInfos: [routingInfoOne, routingInfoTwo],
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        networkConfig: networkConfig,
        routingInfos: [routingInfoOne],
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
      waku1.waitForPeers([Protocols.Relay]),
      waku2.waitForPeers([Protocols.Relay]),
      waku3.waitForPeers([Protocols.Relay])
    ]);

    await waku1.relay.subscribeWithUnsubscribe(
      [customDecoder1, customDecoder2],
      msgCollector1.callback
    );
    await waku2.relay.subscribeWithUnsubscribe(
      [customDecoder1, customDecoder2],
      msgCollector2.callback
    );
    await waku3.relay.subscribeWithUnsubscribe(
      [customDecoder1],
      msgCollector3.callback
    );

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

  it("n1 and n2 uses relay shard 1, n3 uses relay shard 2", async function () {
    [waku1, waku2, waku3] = await Promise.all([
      createRelayNode({
        networkConfig,
        routingInfos: [routingInfoOne],
        staticNoiseKey: NOISE_KEY_1
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        networkConfig,
        routingInfos: [routingInfoOne],
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        networkConfig,
        routingInfos: [routingInfoTwo],
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
      waku1.waitForPeers([Protocols.Relay]),
      waku2.waitForPeers([Protocols.Relay])
    ]);

    const messageText = "Communicating using a custom pubsub topic";

    const waku2ReceivedMsgPromise: Promise<IDecodedMessage> = new Promise(
      (resolve) => {
        void waku2.relay.subscribeWithUnsubscribe([customDecoder1], resolve);
      }
    );

    // The promise **fails** if we receive a message on the default
    // pubsub topic.
    const waku3NoMsgPromise: Promise<IDecodedMessage> = new Promise(
      (resolve, reject) => {
        void waku3.relay.subscribeWithUnsubscribe([TestDecoder], reject);
        setTimeout(resolve, 1000);
      }
    );

    await waku1.relay.send(customEncoder1, {
      payload: utf8ToBytes(messageText)
    });

    const waku2ReceivedMsg = await waku2ReceivedMsgPromise;
    await waku3NoMsgPromise;

    expect(bytesToUtf8(waku2ReceivedMsg.payload!)).to.eq(messageText);
    expect(waku2ReceivedMsg.pubsubTopic).to.eq(routingInfoOne.pubsubTopic);
  });
});

describe("Waku Relay auto-sharding, multiple pubsub topics", function () {
  this.timeout(15000);
  const clusterId = 7;
  let waku1: RelayNode;
  let waku2: RelayNode;
  let waku3: RelayNode;

  const networkConfig = { clusterId, numShardsInCluster: 8 };

  const customContentTopic1 = "/waku/2/content/utf8";
  const customContentTopic2 = "/myapp/1/latest/proto";

  const routingInfo1 = createRoutingInfo(networkConfig, {
    contentTopic: customContentTopic1
  });
  const routingInfo2 = createRoutingInfo(networkConfig, {
    contentTopic: customContentTopic2
  });

  if (routingInfo1.pubsubTopic == routingInfo2.pubsubTopic)
    throw "Internal error, both content topics resolve to same shard";

  const customEncoder1 = createEncoder({
    contentTopic: customContentTopic1,
    routingInfo: routingInfo1
  });
  const customDecoder1 = createDecoder(customContentTopic1, routingInfo1);
  const customEncoder2 = createEncoder({
    contentTopic: customContentTopic2,
    routingInfo: routingInfo2
  });
  const customDecoder2 = createDecoder(customContentTopic2, routingInfo2);

  const relayShard1 = { clusterId, shards: [routingInfo1.shardId] };
  const relayShard2 = { clusterId, shards: [routingInfo2.shardId] };

  afterEachCustom(this, async () => {
    await tearDownNodes([], [waku1, waku2, waku3]);
  });

  [
    {
      routingInfo: routingInfo1,
      relayShards: relayShard1,
      encoder: customEncoder1,
      decoder: customDecoder1
    },
    {
      routingInfo: routingInfo2,
      relayShards: relayShard2,
      encoder: customEncoder2,
      decoder: customDecoder2
    }
  ].forEach((testItem) => {
    it(`3 nodes on ${testItem.routingInfo.pubsubTopic} topic`, async function () {
      const [msgCollector1, msgCollector2, msgCollector3] = Array(3)
        .fill(null)
        .map(() => new MessageCollector());

      [waku1, waku2, waku3] = await Promise.all([
        createRelayNode({
          networkConfig,
          routingInfos: [testItem.routingInfo],
          staticNoiseKey: NOISE_KEY_1
        }).then((waku) => waku.start().then(() => waku)),
        createRelayNode({
          networkConfig,
          routingInfos: [testItem.routingInfo],
          staticNoiseKey: NOISE_KEY_2,
          libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
        }).then((waku) => waku.start().then(() => waku)),
        createRelayNode({
          networkConfig,
          routingInfos: [testItem.routingInfo],
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
        waku1.waitForPeers([Protocols.Relay]),
        waku2.waitForPeers([Protocols.Relay]),
        waku3.waitForPeers([Protocols.Relay])
      ]);

      await waku1.relay.subscribeWithUnsubscribe(
        [testItem.decoder],
        msgCollector1.callback
      );
      await waku2.relay.subscribeWithUnsubscribe(
        [testItem.decoder],
        msgCollector2.callback
      );
      await waku3.relay.subscribeWithUnsubscribe(
        [testItem.decoder],
        msgCollector3.callback
      );

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

      expect(relayResponse1.successes[0].toString()).to.eq(
        waku2.libp2p.peerId.toString()
      );
      expect(relayResponse3.successes[0].toString()).to.eq(
        waku2.libp2p.peerId.toString()
      );
      expect(relayResponse2.successes.map((r) => r.toString())).to.include(
        waku1.libp2p.peerId.toString()
      );
      expect(relayResponse2.successes.map((r) => r.toString())).to.include(
        waku3.libp2p.peerId.toString()
      );

      expect(
        await msgCollector1.waitForMessagesAutosharding(2, {
          contentTopic: testItem.encoder.contentTopic,
          exact: true
        })
      ).to.eq(true);
      expect(
        await msgCollector2.waitForMessagesAutosharding(2, {
          contentTopic: testItem.encoder.contentTopic,
          exact: true
        })
      ).to.eq(true);
      expect(
        await msgCollector3.waitForMessagesAutosharding(2, {
          contentTopic: testItem.encoder.contentTopic,
          exact: true
        })
      ).to.eq(true);

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
        networkConfig,
        routingInfos: [routingInfo1, routingInfo2],
        staticNoiseKey: NOISE_KEY_1
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        networkConfig,
        routingInfos: [routingInfo1, routingInfo2],
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        networkConfig,
        routingInfos: [routingInfo1],
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
      waku1.waitForPeers([Protocols.Relay]),
      waku2.waitForPeers([Protocols.Relay]),
      waku3.waitForPeers([Protocols.Relay])
    ]);

    await waku1.relay.subscribeWithUnsubscribe(
      [customDecoder1, customDecoder2],
      msgCollector1.callback
    );
    await waku2.relay.subscribeWithUnsubscribe(
      [customDecoder1, customDecoder2],
      msgCollector2.callback
    );
    await waku3.relay.subscribeWithUnsubscribe(
      [customDecoder1],
      msgCollector3.callback
    );

    // The nodes are setup in such a way that all messages send should be relayed to the other nodes in the network
    // However onlt waku1 and waku2 are receiving messages on the CustomPubSubTopic
    await waku1.relay.send(customEncoder1, { payload: utf8ToBytes("M1") });
    await waku1.relay.send(customEncoder2, { payload: utf8ToBytes("M2") });
    await waku2.relay.send(customEncoder1, { payload: utf8ToBytes("M3") });
    await waku2.relay.send(customEncoder2, { payload: utf8ToBytes("M4") });
    await waku3.relay.send(customEncoder1, { payload: utf8ToBytes("M5") });
    await waku3.relay.send(customEncoder2, { payload: utf8ToBytes("M6") });

    expect(
      await msgCollector1.waitForMessagesAutosharding(3, {
        contentTopic: customContentTopic1,
        exact: true
      })
    ).to.eq(true);
    expect(
      await msgCollector1.waitForMessagesAutosharding(3, {
        contentTopic: customContentTopic2,
        exact: true
      })
    ).to.eq(true);
    expect(
      await msgCollector2.waitForMessagesAutosharding(3, {
        contentTopic: customContentTopic1,
        exact: true
      })
    ).to.eq(true);
    expect(
      await msgCollector2.waitForMessagesAutosharding(3, {
        contentTopic: customContentTopic2,
        exact: true
      })
    ).to.eq(true);
    expect(
      await msgCollector3.waitForMessagesAutosharding(2, {
        contentTopic: customContentTopic1,
        exact: true
      })
    ).to.eq(true);
    expect(msgCollector1.hasMessage(customContentTopic1, "M3")).to.eq(true);
    expect(msgCollector1.hasMessage(customContentTopic2, "M4")).to.eq(true);
    expect(msgCollector1.hasMessage(customContentTopic1, "M5")).to.eq(true);
    expect(msgCollector2.hasMessage(customContentTopic1, "M1")).to.eq(true);
    expect(msgCollector2.hasMessage(customContentTopic2, "M2")).to.eq(true);
    expect(msgCollector2.hasMessage(customContentTopic1, "M5")).to.eq(true);
    expect(msgCollector3.hasMessage(customContentTopic1, "M1")).to.eq(true);
    expect(msgCollector3.hasMessage(customContentTopic1, "M3")).to.eq(true);
  });

  it("n1 and n2 uses first shard, n3 uses the second shard", async function () {
    [waku1, waku2, waku3] = await Promise.all([
      createRelayNode({
        networkConfig,
        routingInfos: [routingInfo1],
        staticNoiseKey: NOISE_KEY_1
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        networkConfig,
        routingInfos: [routingInfo1],
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
      }).then((waku) => waku.start().then(() => waku)),
      createRelayNode({
        networkConfig,
        routingInfos: [routingInfo2],
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
      waku1.waitForPeers([Protocols.Relay]),
      waku2.waitForPeers([Protocols.Relay])
    ]);

    const messageText = "Communicating using a custom pubsub topic";

    const waku2ReceivedMsgPromise: Promise<IDecodedMessage> = new Promise(
      (resolve) => {
        void waku2.relay.subscribeWithUnsubscribe([customDecoder1], resolve);
      }
    );

    // The promise **fails** if we receive a message on the default
    // pubsub topic.
    const waku3NoMsgPromise: Promise<IDecodedMessage> = new Promise(
      (resolve, reject) => {
        void waku3.relay.subscribeWithUnsubscribe([TestDecoder], reject);
        setTimeout(resolve, 1000);
      }
    );

    await waku1.relay.send(customEncoder1, {
      payload: utf8ToBytes(messageText)
    });

    const waku2ReceivedMsg = await waku2ReceivedMsgPromise;
    await waku3NoMsgPromise;

    expect(bytesToUtf8(waku2ReceivedMsg.payload!)).to.eq(messageText);
    expect(waku2ReceivedMsg.pubsubTopic).to.eq(routingInfo1.pubsubTopic);
  });
});
