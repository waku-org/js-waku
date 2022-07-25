import type { PeerId } from "@libp2p/interface-peer-id";
import { expect } from "chai";

import {
  makeLogFileName,
  NOISE_KEY_1,
  NOISE_KEY_2,
  Nwaku,
} from "../test_utils/";

import { generateSymmetricKey } from "./crypto";
import { waitForRemotePeer } from "./wait_for_remote_peer";
import { createWaku, Protocols, Waku } from "./waku";
import { WakuMessage } from "./waku_message";

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
      await nwaku.start();
      const multiAddrWithId = await nwaku.getMultiaddrWithId();

      waku = await createWaku({
        staticNoiseKey: NOISE_KEY_1,
      });
      await waku.start();
      await waku.dial(multiAddrWithId);
      await waitForRemotePeer(waku, [Protocols.Relay]);

      const nimPeerId = await nwaku.getPeerId();
      expect(await waku.libp2p.peerStore.has(nimPeerId)).to.be.true;
    });
  });

  describe("Bootstrap", function () {
    let waku: Waku;
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

      waku = await createWaku({
        staticNoiseKey: NOISE_KEY_1,
        bootstrap: { peers: [multiAddrWithId] },
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

    it("Passing a function", async function () {
      this.timeout(10_000);

      nwaku = new Nwaku(makeLogFileName(this));
      await nwaku.start();

      waku = await createWaku({
        staticNoiseKey: NOISE_KEY_1,
        bootstrap: {
          getPeers: async () => {
            return [await nwaku.getMultiaddrWithId()];
          },
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

  let waku1: Waku;
  let waku2: Waku;
  beforeEach(async function () {
    this.timeout(5000);
    [waku1, waku2] = await Promise.all([
      createWaku({ staticNoiseKey: NOISE_KEY_1 }).then((waku) =>
        waku.start().then(() => waku)
      ),
      createWaku({
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
      }).then((waku) => waku.start().then(() => waku)),
    ]);

    waku1.addPeerToAddressBook(
      waku2.libp2p.peerId,
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

    waku2.addDecryptionKey(symKey);

    const messageText = "Message is encrypted";
    const messageTimestamp = new Date("1995-12-17T03:24:00");
    const message = await WakuMessage.fromUtf8String(
      messageText,
      TestContentTopic,
      {
        timestamp: messageTimestamp,
        symKey,
      }
    );

    const receivedMsgPromise: Promise<WakuMessage> = new Promise((resolve) => {
      waku2.relay.addObserver(resolve);
    });

    await waku1.relay.send(message);

    const receivedMsg = await receivedMsgPromise;

    expect(receivedMsg.contentTopic).to.eq(message.contentTopic);
    expect(receivedMsg.version).to.eq(message.version);
    expect(receivedMsg.payloadAsUtf8).to.eq(messageText);
    expect(receivedMsg.timestamp?.valueOf()).to.eq(messageTimestamp.valueOf());
  });
});
