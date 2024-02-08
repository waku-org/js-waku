import { Multiaddr } from "@multiformats/multiaddr";
import { EConnectionStateEvents, LightNode, Protocols } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { createRelayNode } from "@waku/sdk/relay";
import { expect } from "chai";

import { delay } from "../../src/index.js";
import {
  makeLogFileName,
  ServiceNode,
  tearDownNodes
} from "../../src/index.js";

describe("Connection state", function () {
  this.timeout(20_000);
  let waku: LightNode;

  let nwaku1: ServiceNode;
  let nwaku2: ServiceNode;
  let nwaku1PeerId: Multiaddr;
  let nwaku2PeerId: Multiaddr;

  beforeEach(async () => {
    this.timeout(20_000);
    waku = await createLightNode();
    nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1");
    nwaku2 = new ServiceNode(makeLogFileName(this.ctx) + "2");
    await nwaku1.start({
      filter: true
    });

    await nwaku2.start({
      filter: true
    });

    nwaku1PeerId = await nwaku1.getMultiaddrWithId();
    nwaku2PeerId = await nwaku2.getMultiaddrWithId();
  });

  afterEach(async () => {
    this.timeout(15000);
    await tearDownNodes([nwaku1, nwaku2], waku);
  });

  it("should emit `waku:online` event only when first peer is connected", async function () {
    let eventCount = 0;
    const connectionStatus = new Promise<boolean>((resolve) => {
      waku.connectionManager.addEventListener(
        EConnectionStateEvents.CONNECTION_STATUS,
        ({ detail: status }) => {
          eventCount++;
          resolve(status);
        }
      );
    });

    await waku.dial(nwaku1PeerId, [Protocols.Filter]);
    await delay(250);
    expect(await connectionStatus).to.eq(true);
    expect(eventCount).to.be.eq(1);

    await waku.dial(nwaku2PeerId, [Protocols.Filter]);
    await delay(250);
    expect(eventCount).to.be.eq(1);
  });

  it("should emit `waku:offline` event only when all peers disconnect", async function () {
    await waku.dial(nwaku1PeerId, [Protocols.Filter]);
    await waku.dial(nwaku2PeerId, [Protocols.Filter]);

    let eventCount = 0;
    const connectionStatus = new Promise<boolean>((resolve) => {
      waku.connectionManager.addEventListener(
        EConnectionStateEvents.CONNECTION_STATUS,
        ({ detail: status }) => {
          eventCount++;
          resolve(status);
        }
      );
    });

    await nwaku1.stop();
    await delay(250);
    expect(eventCount).to.be.eq(0);

    await nwaku2.stop();
    expect(await connectionStatus).to.eq(false);
    expect(eventCount).to.be.eq(1);
  });

  it("`waku:online` bwtween 2 js-waku relay nodes", async function () {
    const waku1 = await createRelayNode();
    const waku2 = await createRelayNode({
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
    });

    let eventCount1 = 0;
    const connectionStatus1 = new Promise<boolean>((resolve) => {
      waku1.connectionManager.addEventListener(
        EConnectionStateEvents.CONNECTION_STATUS,
        ({ detail: status }) => {
          eventCount1++;
          resolve(status);
        }
      );
    });

    let eventCount2 = 0;
    const connectionStatus2 = new Promise<boolean>((resolve) => {
      waku2.connectionManager.addEventListener(
        EConnectionStateEvents.CONNECTION_STATUS,
        ({ detail: status }) => {
          eventCount2++;
          resolve(status);
        }
      );
    });

    await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await Promise.all([waku1.dial(waku2.libp2p.peerId)]);
    await delay(250);

    expect(await connectionStatus1).to.eq(true);
    expect(await connectionStatus2).to.eq(true);
    expect(eventCount1).to.be.eq(1);
    expect(eventCount2).to.be.eq(1);
  });

  it("isConnected should return true after first peer connects", async function () {
    expect(waku.isConnected()).to.be.false;
    await waku.dial(nwaku1PeerId, [Protocols.Filter]);
    await delay(250);
    expect(waku.isConnected()).to.be.true;
  });

  it("isConnected should return false after all peers disconnect", async function () {
    expect(waku.isConnected()).to.be.false;
    await waku.dial(nwaku1PeerId, [Protocols.Filter]);
    await waku.dial(nwaku2PeerId, [Protocols.Filter]);
    await delay(250);
    expect(waku.isConnected()).to.be.true;

    await waku.libp2p.hangUp(nwaku1PeerId);
    await delay(250);
    expect(waku.isConnected()).to.be.true;

    await waku.libp2p.hangUp(nwaku2PeerId);
    await delay(250);
    expect(waku.isConnected()).to.be.false;
  });

  it("isConnected return false after peer stops", async function () {
    expect(waku.isConnected()).to.be.false;
    await waku.dial(nwaku1PeerId, [Protocols.Filter]);
    await delay(250);
    expect(waku.isConnected()).to.be.true;

    await nwaku1.stop();
    await delay(250);
    expect(waku.isConnected()).to.be.false;
  });

  it("isConnected bwtween 2 js-waku relay nodes", async function () {
    const waku1 = await createRelayNode();
    const waku2 = await createRelayNode({
      libp2p: { addresses: { listen: ["/ip4/0.0.0.0/tcp/0/ws"] } }
    });
    await waku1.libp2p.peerStore.merge(waku2.libp2p.peerId, {
      multiaddrs: waku2.libp2p.getMultiaddrs()
    });
    await Promise.all([waku1.dial(waku2.libp2p.peerId)]);
    await delay(250);
    expect(waku1.isConnected()).to.be.true;
    expect(waku2.isConnected()).to.be.true;
  });
});
