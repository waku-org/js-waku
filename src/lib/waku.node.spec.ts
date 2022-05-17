import { expect } from "chai";
import PeerId from "peer-id";

import {
  makeLogFileName,
  NOISE_KEY_1,
  NOISE_KEY_2,
  Nwaku,
} from "../test_utils/";
import { delay } from "../test_utils/delay";

import { Protocols, Waku } from "./waku";
import { WakuMessage } from "./waku_message";
import { generateSymmetricKey } from "./waku_message/version_1";

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

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
      });
      await waku.dial(multiAddrWithId);
      await waku.waitForRemotePeer([Protocols.Relay]);

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

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        bootstrap: { peers: [multiAddrWithId] },
      });

      const connectedPeerID: PeerId = await new Promise((resolve) => {
        waku.libp2p.connectionManager.on("peer:connect", (connection) => {
          resolve(connection.remotePeer);
        });
      });

      expect(connectedPeerID.toB58String()).to.eq(multiAddrWithId.getPeerId());
    });

    it("Passing a function", async function () {
      this.timeout(10_000);

      nwaku = new Nwaku(makeLogFileName(this));
      await nwaku.start();

      waku = await Waku.create({
        staticNoiseKey: NOISE_KEY_1,
        bootstrap: {
          getPeers: async () => {
            return [await nwaku.getMultiaddrWithId()];
          },
        },
      });

      const connectedPeerID: PeerId = await new Promise((resolve) => {
        waku.libp2p.connectionManager.on("peer:connect", (connection) => {
          resolve(connection.remotePeer);
        });
      });

      const multiAddrWithId = await nwaku.getMultiaddrWithId();
      expect(connectedPeerID.toB58String()).to.eq(multiAddrWithId.getPeerId());
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
      Waku.create({ staticNoiseKey: NOISE_KEY_1 }),
      Waku.create({
        staticNoiseKey: NOISE_KEY_2,
        libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
      }),
    ]);

    waku1.addPeerToAddressBook(waku2.libp2p.peerId, waku2.libp2p.multiaddrs);

    await Promise.all([
      waku1.waitForRemotePeer([Protocols.Relay]),
      waku2.waitForRemotePeer([Protocols.Relay]),
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

describe("Wait for remote peer / get peers", function () {
  let waku: Waku;
  let nwaku: Nwaku;

  afterEach(async function () {
    !!nwaku && nwaku.stop();
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Relay - dialed first", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start();
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(multiAddrWithId);
    await delay(1000);
    await waku.waitForRemotePeer([Protocols.Relay]);
    const peers = waku.relay.getPeers();
    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.has(nimPeerId as string)).to.be.true;
  });

  it("Relay - dialed after", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start();
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });

    const waitPromise = waku.waitForRemotePeer([Protocols.Relay]);
    await delay(1000);
    await waku.dial(multiAddrWithId);
    await waitPromise;

    const peers = waku.relay.getPeers();
    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.has(nimPeerId as string)).to.be.true;
  });

  it("Store - dialed first", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(multiAddrWithId);
    await delay(1000);
    await waku.waitForRemotePeer([Protocols.Store]);

    const peers = [];
    for await (const peer of waku.store.peers) {
      peers.push(peer.id.toB58String());
    }

    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });

  it("Store - dialed after", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    const waitPromise = waku.waitForRemotePeer([Protocols.Store]);
    await delay(1000);
    await waku.dial(multiAddrWithId);
    await waitPromise;

    const peers = [];
    for await (const peer of waku.store.peers) {
      peers.push(peer.id.toB58String());
    }

    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });

  it("LightPush", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ lightpush: true });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(multiAddrWithId);
    await waku.waitForRemotePeer([Protocols.LightPush]);

    const peers = [];
    for await (const peer of waku.lightPush.peers) {
      peers.push(peer.id.toB58String());
    }

    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });
});
