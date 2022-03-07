import { expect } from "chai";
import { Multiaddr } from "multiaddr";
import PeerId from "peer-id";

import { delay } from "../test_utils/delay";

import { fleets } from "./discovery/predefined";
import { Protocols, Waku } from "./waku";
import { WakuMessage } from "./waku_message";

describe("Test nwaku test fleet", () => {
  const wakus: Waku[] = [];

  afterEach(function () {
    wakus.forEach((waku) => {
      waku.stop().catch((e) => console.log("Waku failed to stop", e));
    });
  });

  it("Connect", async function () {
    // This test depends on fleets.status.im being online.
    // This dependence must be removed once DNS discovery is implemented
    this.timeout(20_000);

    const nodes = Object.values(fleets.fleets["wakuv2.test"]["waku-websocket"]);

    const peerIds = nodes.map((a) => {
      const ma = new Multiaddr(a);
      return ma.getPeerId()!;
    });

    expect(nodes.length).to.eq(3);

    const promises = nodes.map(async (node, i) => {
      wakus[i] = await Waku.create({
        bootstrap: { peers: [node] },
      });

      return new Promise((resolve) => {
        wakus[i].libp2p.connectionManager.on("peer:connect", (connection) => {
          resolve(connection.remotePeer);
        });
      }).then((connectedPeerID) => {
        const peerId = connectedPeerID as unknown as PeerId;
        expect(peerId.toB58String()).to.eq(peerIds[i]);
      });
    });

    await Promise.all(promises);
  });

  it("Relay", async function () {
    // This test depends on fleets.status.im being online.
    // This dependence must be removed once DNS discovery is implemented
    this.timeout(20_000);

    const nodes = Object.values(fleets.fleets["wakuv2.test"]["waku-websocket"]);

    expect(nodes.length).to.eq(3);

    const promises = nodes.map(async (node, i) => {
      wakus[i] = await Waku.create({
        bootstrap: { peers: [node] },
      });

      await wakus[i].waitForRemotePeer([Protocols.Relay]);
      console.log(node + ": ready");
    });

    await Promise.all(promises);
    // All connected and relay ready

    const contentTopic = "/js-waku-testing/1/relay-test/utf8";

    const messages: string[] = [];

    wakus.forEach((waku) => {
      waku.relay.addObserver((message) => {
        messages.push(message.payloadAsUtf8);
      });
    });

    const relayPromises = wakus.map(async (waku, i) => {
      const msg = await WakuMessage.fromUtf8String(
        `sent from ${i}`,
        contentTopic
      );
      return waku.relay.send(msg);
    });

    await Promise.all(relayPromises);
    await delay(1000);

    console.log(messages);

    expect(messages.length).to.gte(nodes.length);

    for (let i = 0; i < wakus.length; i++) {
      expect(messages).to.contain(`sent from ${i}`);
    }
  });
});
