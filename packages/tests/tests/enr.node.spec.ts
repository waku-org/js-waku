import { waitForRemotePeer } from "@waku/core";
import { EnrDecoder } from "@waku/enr";
import type { RelayNode } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { createRelayNode } from "@waku/sdk/relay";
import { expect } from "chai";

import {
  makeLogFileName,
  MOCHA_HOOK_MAX_TIMEOUT,
  NOISE_KEY_1,
  ServiceNode,
  tearDownNodes,
  withGracefulTimeout
} from "../src/index.js";

describe("ENR Interop: ServiceNode", function () {
  let waku: RelayNode;
  let nwaku: ServiceNode;

  this.afterEach(function (done) {
    this.timeout(MOCHA_HOOK_MAX_TIMEOUT);
    const teardown: () => Promise<void> = async () => {
      await tearDownNodes(nwaku, waku);
    };
    withGracefulTimeout(teardown, 20000, done);
  });

  it("Relay", async function () {
    this.timeout(20_000);
    nwaku = new ServiceNode(makeLogFileName(this));
    await nwaku.start({
      relay: true,
      store: false,
      filter: false,
      lightpush: false
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await createRelayNode({
      staticNoiseKey: NOISE_KEY_1
    });
    await waku.start();
    await waku.dial(multiAddrWithId);
    await waitForRemotePeer(waku, [Protocols.Relay]);

    const nwakuInfo = await nwaku.info();
    const nimPeerId = await nwaku.getPeerId();

    expect(nwakuInfo.enrUri).to.not.be.undefined;
    const dec = await EnrDecoder.fromString(nwakuInfo.enrUri ?? "");
    expect(dec.peerId?.toString()).to.eq(nimPeerId.toString());
    expect(dec.waku2).to.deep.eq({
      relay: true,
      store: false,
      filter: false,
      lightPush: false
    });
  });

  it("Relay + Store", async function () {
    this.timeout(20_000);
    nwaku = new ServiceNode(makeLogFileName(this));
    await nwaku.start({
      relay: true,
      store: true,
      filter: false,
      lightpush: false
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await createRelayNode({
      staticNoiseKey: NOISE_KEY_1
    });
    await waku.start();
    await waku.dial(multiAddrWithId);
    await waitForRemotePeer(waku, [Protocols.Relay]);

    const nwakuInfo = await nwaku.info();
    const nimPeerId = await nwaku.getPeerId();

    expect(nwakuInfo.enrUri).to.not.be.undefined;
    const dec = await EnrDecoder.fromString(nwakuInfo.enrUri ?? "");
    expect(dec.peerId?.toString()).to.eq(nimPeerId.toString());
    expect(dec.waku2).to.deep.eq({
      relay: true,
      store: true,
      filter: false,
      lightPush: false
    });
  });

  it("All", async function () {
    this.timeout(20_000);
    nwaku = new ServiceNode(makeLogFileName(this));
    await nwaku.start({
      relay: true,
      store: true,
      filter: true,
      lightpush: true,
      legacyFilter: true
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await createRelayNode({
      staticNoiseKey: NOISE_KEY_1
    });
    await waku.start();
    await waku.dial(multiAddrWithId);
    await waitForRemotePeer(waku, [Protocols.Relay]);

    const nwakuInfo = await nwaku.info();
    const nimPeerId = await nwaku.getPeerId();

    expect(nwakuInfo.enrUri).to.not.be.undefined;
    const dec = await EnrDecoder.fromString(nwakuInfo.enrUri ?? "");
    expect(dec.peerId?.toString()).to.eq(nimPeerId.toString());
    expect(dec.waku2).to.deep.eq({
      relay: true,
      store: true,
      filter: true,
      lightPush: true
    });
  });
});
