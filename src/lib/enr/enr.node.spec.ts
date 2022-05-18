import { expect } from "chai";

import { makeLogFileName, NOISE_KEY_1, Nwaku } from "../../test_utils";
import { Protocols, Waku } from "../waku";

import { ENR } from "./enr";

describe("ENR Interop: nwaku", function () {
  let waku: Waku;
  let nwaku: Nwaku;

  afterEach(async function () {
    !!nwaku && nwaku.stop();
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Relay", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({
      relay: true,
      store: false,
      filter: false,
      lightpush: false,
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(multiAddrWithId);
    await waku.waitForRemotePeer([Protocols.Relay]);

    const nwakuInfo = await nwaku.info();
    const nimPeerId = await nwaku.getPeerId();

    expect(nwakuInfo.enrUri).to.not.be.undefined;
    const dec = await ENR.decodeTxt(nwakuInfo.enrUri ?? "");
    expect(dec.peerId?.toB58String()).to.eq(nimPeerId.toB58String());
    expect(dec.waku2).to.deep.eq({
      relay: true,
      store: false,
      filter: false,
      lightPush: false,
    });
  });

  it("Relay + Store", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({
      relay: true,
      store: true,
      filter: false,
      lightpush: false,
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(multiAddrWithId);
    await waku.waitForRemotePeer([Protocols.Relay]);

    const nwakuInfo = await nwaku.info();
    const nimPeerId = await nwaku.getPeerId();

    expect(nwakuInfo.enrUri).to.not.be.undefined;
    const dec = await ENR.decodeTxt(nwakuInfo.enrUri ?? "");
    expect(dec.peerId?.toB58String()).to.eq(nimPeerId.toB58String());
    expect(dec.waku2).to.deep.eq({
      relay: true,
      store: true,
      filter: false,
      lightPush: false,
    });
  });

  it("All", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({
      relay: true,
      store: true,
      filter: true,
      lightpush: true,
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await Waku.create({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.dial(multiAddrWithId);
    await waku.waitForRemotePeer([Protocols.Relay]);

    const nwakuInfo = await nwaku.info();
    const nimPeerId = await nwaku.getPeerId();

    expect(nwakuInfo.enrUri).to.not.be.undefined;
    const dec = await ENR.decodeTxt(nwakuInfo.enrUri ?? "");
    expect(dec.peerId?.toB58String()).to.eq(nimPeerId.toB58String());
    expect(dec.waku2).to.deep.eq({
      relay: true,
      store: true,
      filter: true,
      lightPush: true,
    });
  });
});
