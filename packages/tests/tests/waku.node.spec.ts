import type { PeerId } from "@libp2p/interface-peer-id";
import { generateSymmetricKey } from "@waku/core";
import { PeerDiscoveryStaticPeers } from "@waku/core/lib/peer_discovery_static_list";
import { bytesToUtf8, utf8ToBytes } from "@waku/core/lib/utils";
import { waitForRemotePeer } from "@waku/core/lib/wait_for_remote_peer";
import { SymDecoder, SymEncoder } from "@waku/core/lib/waku_message/version_1";
import { createLightNode, createPrivacyNode } from "@waku/create";
import type { Message, Waku, WakuLight, WakuPrivacy } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { expect } from "chai";

import { makeLogFileName, NOISE_KEY_1, NOISE_KEY_2, Nwaku } from "../src/";

const TestContentTopic = "/test/1/waku/utf8";

describe("Waku Dial [node only]", function () {
  describe("Interop: nwaku", function () {
    let waku: Waku;
    let nwaku: Nwaku;

    afterEach(async function () {
      !!nwaku && nwaku.stop();
      !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
    });

    it("connects to nwaku", async function () {
      this.timeout(20_000);
      nwaku = new Nwaku(makeLogFileName(this));
      await nwaku.start({
        filter: true,
        store: true,
        lightpush: true,
        persistMessages: true,
      });
      const multiAddrWithId = await nwaku.getMultiaddrWithId();

      waku = await createLightNode({
        staticNoiseKey: NOISE_KEY_1,
      });
      await waku.start();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore TODO: uniformize usage of multiaddr lib across repos
      await waku.dial(multiAddrWithId);
      await waitForRemotePeer(waku);

      const nimPeerId = await nwaku.getPeerId();
      expect(await waku.libp2p.peerStore.has(nimPeerId)).to.be.true;
    });
  });

  describe("Bootstrap", function () {
    let waku: WakuLight;
    let nwaku: Nwaku;

    afterEach(async function () {
      !!nwaku && nwaku.stop();
      !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
    });

    it("Passing an array", async function () {
      this.timeout(10_000);

      nwaku = new Nwaku(makeLogFileName(this));
      await nwaku.start();
      const multiAddrWithId = await nwaku.getMultiaddrWithId();
      waku = await createLightNode({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore TODO: uniformize usage of multiaddr lib across repos
          peerDiscovery: [new PeerDiscoveryStaticPeers([multiAddrWithId])],
        },
      });
      await waku.start();

      const connectedPeerID: PeerId = await new Promise((resolve) => {
        waku.libp2p.connectionManager.addEventListener(
          "peer:connect",
          (evt) => {
            resolve(evt.detail.remotePeer);
          }
        );
      });

      expect(connectedPeerID.toString()).to.eq(multiAddrWithId.getPeerId());
    });

    it("Using a function", async function () {
      this.timeout(10_000);

      nwaku = new Nwaku(makeLogFileName(this));
      await nwaku.start();

      waku = await createLightNode({
        staticNoiseKey: NOISE_KEY_1,
        libp2p: {
          peerDiscovery: [
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore TODO: uniformize usage of multiaddr lib across repos
            new PeerDiscoveryStaticPeers([await nwaku.getMultiaddrWithId()]),
          ],
        },
      });
      await waku.start();

      const connectedPeerID: PeerId = await new Promise((resolve) => {
        waku.libp2p.connectionManager.addEventListener(
          "peer:connect",
          (evt) => {
            resolve(evt.detail.remotePeer);
          }
        );
      });

      const multiAddrWithId = await nwaku.getMultiaddrWithId();
      expect(connectedPeerID.toString()).to.eq(multiAddrWithId.getPeerId());
    });
  });
});

describe("Decryption Keys", () => {
  afterEach(function () {
    if (this.currentTest?.state === "failed") {
      console.log(`Test failed, log file name is ${makeLogFileName(this)}`);
    }
  });

  let waku1: WakuPrivacy;
  let waku2: WakuPrivacy;
  beforeEach(async function () {
    this.timeout(5000);
    [waku1, waku2] = await Promise.all([
      createPrivacyNode({ staticNoiseKey: NOISE_KEY_1 }).then((waku) =>
        waku.start().then(() => waku)
      ),
      createPrivacyNode({
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
      }).then((waku) => waku.start().then(() => waku)),
    ]);

    waku1.addPeerToAddressBook(
      waku2.libp2p.peerId,
      // TODO: Upgrade libp2p package.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: New multiaddr type but they seem mostly compatible
      waku2.libp2p.getMultiaddrs()
    );

    await Promise.all([
      waitForRemotePeer(waku1, [Protocols.Relay]),
      waitForRemotePeer(waku2, [Protocols.Relay]),
    ]);
  });

  afterEach(async function () {
    !!waku1 && waku1.stop().catch((e) => console.log("Waku failed to stop", e));
    !!waku2 && waku2.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Used by Waku Relay", async function () {
    this.timeout(10000);

    const symKey = generateSymmetricKey();
    const decoder = new SymDecoder(TestContentTopic, symKey);

    const encoder = new SymEncoder(TestContentTopic, symKey);
    const messageText = "Message is encrypted";
    const messageTimestamp = new Date("1995-12-17T03:24:00");
    const message = {
      payload: utf8ToBytes(messageText),
      timestamp: messageTimestamp,
    };

    const receivedMsgPromise: Promise<Message> = new Promise((resolve) => {
      waku2.relay.addObserver(decoder, resolve);
    });

    await waku1.relay.send(encoder, message);

    const receivedMsg = await receivedMsgPromise;

    expect(receivedMsg.contentTopic).to.eq(TestContentTopic);
    expect(bytesToUtf8(receivedMsg.payload!)).to.eq(messageText);
    expect(receivedMsg.timestamp?.valueOf()).to.eq(messageTimestamp.valueOf());
  });
});
