import { generateKeyPair } from "@libp2p/crypto/keys";
import type { PeerId } from "@libp2p/interface";
import { TypedEventEmitter } from "@libp2p/interface";
import { peerIdFromPrivateKey } from "@libp2p/peer-id";
import { Multiaddr } from "@multiformats/multiaddr";
import { LightNode, Protocols, Tags } from "@waku/interfaces";
import { createRelayNode } from "@waku/relay";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  DefaultTestShardInfo,
  delay,
  NOISE_KEY_1
} from "../../src/index.js";
import {
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

const TEST_TIMEOUT = 30_000;

describe("Connection state", function () {
  this.timeout(TEST_TIMEOUT);
  let waku: LightNode;

  let nwaku1: ServiceNode;
  let nwaku2: ServiceNode;
  let nwaku1PeerId: Multiaddr;
  let nwaku2PeerId: Multiaddr;

  let navigatorMock: any;
  let originalNavigator: any;

  beforeEachCustom(this, async () => {
    waku = await createLightNode({ networkConfig: DefaultTestShardInfo });
    nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1");
    nwaku2 = new ServiceNode(makeLogFileName(this.ctx) + "2");
    await nwaku1.start({ filter: true });
    await nwaku2.start({ filter: true });
    nwaku1PeerId = await nwaku1.getMultiaddrWithId();
    nwaku2PeerId = await nwaku2.getMultiaddrWithId();

    navigatorMock = { onLine: true };
    Object.defineProperty(globalThis, "navigator", {
      value: navigatorMock,
      configurable: true,
      writable: false
    });
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku1, nwaku2], waku);
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: false
    });
  });

  it("should emit `waku:online` event only when first peer is connected", async function () {
    let eventCount = 0;
    const connectionStatus = new Promise<boolean>((resolve) => {
      waku.events.addEventListener("waku:connection", ({ detail: status }) => {
        eventCount++;
        resolve(status);
      });
    });

    await waku.dial(nwaku1PeerId, [Protocols.Filter]);
    await delay(400);
    expect(await connectionStatus).to.eq(true);
    expect(eventCount).to.be.eq(1);

    await waku.dial(nwaku2PeerId, [Protocols.Filter]);
    await delay(400);
    expect(eventCount).to.be.eq(1);
  });

  it("should emit `waku:offline` event only when all peers disconnect", async function () {
    await waku.dial(nwaku1PeerId, [Protocols.Filter]);
    await waku.dial(nwaku2PeerId, [Protocols.Filter]);

    let eventCount = 0;
    const connectionStatus = new Promise<boolean>((resolve) => {
      waku.events.addEventListener("waku:connection", ({ detail: status }) => {
        eventCount++;
        resolve(status);
      });
    });

    await nwaku1.stop();
    await delay(400);
    expect(eventCount).to.be.eq(0);

    await nwaku2.stop();
    expect(await connectionStatus).to.eq(false);
    expect(eventCount).to.be.eq(1);
  });

  it("`waku:online` between 2 js-waku relay nodes", async function () {
    const waku1 = await createRelayNode({
      staticNoiseKey: NOISE_KEY_1,
      networkConfig: DefaultTestShardInfo
    });
    const waku2 = await createRelayNode({
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } },
      networkConfig: DefaultTestShardInfo
    });

    let eventCount1 = 0;
    const connectionStatus1 = new Promise<boolean>((resolve) => {
      waku1.events.addEventListener("waku:connection", ({ detail: status }) => {
        eventCount1++;
        resolve(status);
      });
    });

    let eventCount2 = 0;
    const connectionStatus2 = new Promise<boolean>((resolve) => {
      waku2.events.addEventListener("waku:connection", ({ detail: status }) => {
        eventCount2++;
        resolve(status);
      });
    });

    await waku1.libp2p.peerStore.merge(waku2.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });

    await waku1.dial(waku2.peerId);

    expect(await connectionStatus1).to.eq(true);
    expect(await connectionStatus2).to.eq(true);
    expect(eventCount1).to.be.eq(1);
    expect(eventCount2).to.be.eq(1);
  });

  it("isConnected should return true after first peer connects", async function () {
    expect(waku.isConnected()).to.be.false;
    await waku.dial(nwaku1PeerId, [Protocols.Filter]);
    await delay(400);
    expect(waku.isConnected()).to.be.true;
  });

  it("isConnected should return false after all peers disconnect", async function () {
    await waku.dial(nwaku1PeerId, [Protocols.Filter]);
    await waku.dial(nwaku2PeerId, [Protocols.Filter]);
    await delay(250);
    expect(waku.isConnected()).to.be.true;

    await waku.libp2p.hangUp(nwaku1PeerId);
    expect(waku.isConnected()).to.be.true;
    await waku.libp2p.hangUp(nwaku2PeerId);
    expect(waku.isConnected()).to.be.false;
  });

  it("isConnected return false after peer stops", async function () {
    expect(waku.isConnected()).to.be.false;
    await waku.dial(nwaku1PeerId, [Protocols.Filter]);
    await delay(400);
    expect(waku.isConnected()).to.be.true;

    await nwaku1.stop();
    await delay(400);
    expect(waku.isConnected()).to.be.false;
  });

  it("isConnected between 2 js-waku relay nodes", async function () {
    const waku1 = await createRelayNode({
      staticNoiseKey: NOISE_KEY_1
    });
    const waku2 = await createRelayNode({
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
    });
    await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await Promise.all([waku1.dial(waku2.libp2p.peerId)]);
    await delay(400);
    expect(waku1.isConnected()).to.be.true;
    expect(waku2.isConnected()).to.be.true;
  });
});

describe("waku:connection", function () {
  let navigatorMock: any;
  let originalNavigator: any;

  let waku: LightNode;
  this.timeout(TEST_TIMEOUT);

  beforeEachCustom(this, async () => {
    waku = await createLightNode();
    originalNavigator = global.navigator;

    navigatorMock = { onLine: true };
    Object.defineProperty(globalThis, "navigator", {
      value: navigatorMock,
      configurable: true,
      writable: false
    });

    const eventEmmitter = new TypedEventEmitter();
    globalThis.addEventListener =
      eventEmmitter.addEventListener.bind(eventEmmitter);
    globalThis.removeEventListener =
      eventEmmitter.removeEventListener.bind(eventEmmitter);
    globalThis.dispatchEvent = eventEmmitter.dispatchEvent.bind(eventEmmitter);
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([], waku);

    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: false
    });
    // @ts-expect-error: resetting set value
    globalThis.addEventListener = undefined;
    // @ts-expect-error: resetting set value
    globalThis.removeEventListener = undefined;
    // @ts-expect-error: resetting set value
    globalThis.dispatchEvent = undefined;
  });

  it(`should emit events and trasition isConnected state when has peers or no peers`, async function () {
    const privateKey1 = await generateKeyPair("secp256k1");
    const privateKey2 = await generateKeyPair("secp256k1");
    const peerIdPx = peerIdFromPrivateKey(privateKey1);
    const peerIdPx2 = peerIdFromPrivateKey(privateKey2);

    await waku.libp2p.peerStore.save(peerIdPx, {
      tags: {
        [Tags.PEER_EXCHANGE]: {
          value: 50,
          ttl: 1200000
        }
      }
    });

    await waku.libp2p.peerStore.save(peerIdPx2, {
      tags: {
        [Tags.PEER_EXCHANGE]: {
          value: 50,
          ttl: 1200000
        }
      }
    });

    let eventCount = 0;
    const connectedStatus = new Promise<boolean>((resolve) => {
      waku.events.addEventListener("waku:connection", ({ detail: status }) => {
        eventCount++;
        resolve(status);
      });
    });

    waku.libp2p.dispatchEvent(
      new CustomEvent<PeerId>("peer:connect", { detail: peerIdPx })
    );
    waku.libp2p.dispatchEvent(
      new CustomEvent<PeerId>("peer:connect", { detail: peerIdPx2 })
    );

    await delay(100);

    expect(waku.isConnected()).to.be.true;
    expect(await connectedStatus).to.eq(true);
    expect(eventCount).to.be.eq(1);

    const disconnectedStatus = new Promise<boolean>((resolve) => {
      waku.events.addEventListener("waku:connection", ({ detail: status }) => {
        resolve(status);
      });
    });

    waku.libp2p.dispatchEvent(
      new CustomEvent<PeerId>("peer:disconnect", { detail: peerIdPx })
    );
    waku.libp2p.dispatchEvent(
      new CustomEvent<PeerId>("peer:disconnect", { detail: peerIdPx2 })
    );

    expect(waku.isConnected()).to.be.false;
    expect(await disconnectedStatus).to.eq(false);
    expect(eventCount).to.be.eq(2);
  });

  it("should be online or offline if network state changed", async function () {
    // have to recreate js-waku for it to pick up new globalThis
    waku = await createLightNode();

    const privateKey = await generateKeyPair("secp256k1");
    const peerIdPx = peerIdFromPrivateKey(privateKey);

    await waku.libp2p.peerStore.save(peerIdPx, {
      tags: {
        [Tags.PEER_EXCHANGE]: {
          value: 50,
          ttl: 1200000
        }
      }
    });

    let eventCount = 0;
    const connectedStatus = new Promise<boolean>((resolve) => {
      waku.events.addEventListener("waku:connection", ({ detail: status }) => {
        eventCount++;
        resolve(status);
      });
    });

    waku.libp2p.dispatchEvent(
      new CustomEvent<PeerId>("peer:connect", { detail: peerIdPx })
    );

    await delay(100);

    expect(waku.isConnected()).to.be.true;
    expect(await connectedStatus).to.eq(true);
    expect(eventCount).to.be.eq(1);

    const disconnectedStatus = new Promise<boolean>((resolve) => {
      waku.events.addEventListener("waku:connection", ({ detail: status }) => {
        resolve(status);
      });
    });

    navigatorMock.onLine = false;
    globalThis.dispatchEvent(new CustomEvent("offline"));

    await delay(100);

    expect(waku.isConnected()).to.be.false;
    expect(await disconnectedStatus).to.eq(false);
    expect(eventCount).to.be.eq(2);

    const connectionRecoveredStatus = new Promise<boolean>((resolve) => {
      waku.events.addEventListener("waku:connection", ({ detail: status }) => {
        resolve(status);
      });
    });

    navigatorMock.onLine = true;
    globalThis.dispatchEvent(new CustomEvent("online"));

    await delay(100);

    expect(waku.isConnected()).to.be.true;
    expect(await connectionRecoveredStatus).to.eq(true);
    expect(eventCount).to.be.eq(3);
  });
});
