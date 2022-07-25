import { expect } from "chai";

import { makeLogFileName, NOISE_KEY_1, Nwaku } from "../test_utils";
import { delay } from "../test_utils/delay";

import { waitForRemotePeer } from "./wait_for_remote_peer";
import { createWaku, Protocols, Waku } from "./waku";

describe("Wait for remote peer", function () {
  let waku: Waku;
  let nwaku: Nwaku | undefined;

  afterEach(async function () {
    if (nwaku) {
      nwaku.stop();
      nwaku = undefined;
    }
    !!waku && waku.stop().catch((e) => console.log("Waku failed to stop", e));
  });

  it("Relay - dialed first", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start();
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await createWaku({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(multiAddrWithId);
    await delay(1000);
    await waitForRemotePeer(waku, [Protocols.Relay]);
    const peers = waku.relay.getPeers();
    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers).to.includes(nimPeerId);
  });

  it("Relay - dialed after", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start();
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await createWaku({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();

    const waitPromise = waitForRemotePeer(waku, [Protocols.Relay]);
    await delay(1000);
    await waku.dial(multiAddrWithId);
    await waitPromise;

    // TODO: Should getMeshPeers be used instead?
    const peers = waku.relay.getPeers();
    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers).includes(nimPeerId);
  });

  it("Relay - times out", function (done) {
    this.timeout(5000);
    createWaku({
      staticNoiseKey: NOISE_KEY_1,
    })
      .then((waku) => waku.start().then(() => waku))
      .then((waku) => {
        waitForRemotePeer(waku, [Protocols.Relay], 200).then(
          () => {
            throw "Promise expected to reject on time out";
          },
          (reason) => {
            expect(reason).to.eq("Timed out waiting for a remote peer.");
            done();
          }
        );
      });
  });

  it("Store - dialed first", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await createWaku({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(multiAddrWithId);
    await delay(1000);
    await waitForRemotePeer(waku, [Protocols.Store]);

    const peers = (await waku.store.peers()).map((peer) => peer.id.toString());
    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });

  it("Store - dialed after - with timeout", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ persistMessages: true });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await createWaku({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    const waitPromise = waitForRemotePeer(waku, [Protocols.Store], 2000);
    await delay(1000);
    await waku.dial(multiAddrWithId);
    await waitPromise;

    const peers = (await waku.store.peers()).map((peer) => peer.id.toString());

    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });

  it("LightPush", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ lightpush: true });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await createWaku({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(multiAddrWithId);
    await waitForRemotePeer(waku, [Protocols.LightPush]);

    const peers = (await waku.lightPush.peers()).map((peer) =>
      peer.id.toString()
    );

    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });

  it("Filter", async function () {
    this.timeout(20_000);
    nwaku = new Nwaku(makeLogFileName(this));
    await nwaku.start({ filter: true });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await createWaku({
      staticNoiseKey: NOISE_KEY_1,
    });
    await waku.start();
    await waku.dial(multiAddrWithId);
    await waitForRemotePeer(waku, [Protocols.Filter]);

    const peers = (await waku.filter.peers()).map((peer) => peer.id.toString());

    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });
});
