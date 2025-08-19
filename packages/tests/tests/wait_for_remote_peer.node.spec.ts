import type { LightNode, RelayNode } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { formatPubsubTopic } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  DefaultTestClusterId,
  DefaultTestContentTopic,
  DefaultTestNetworkConfig,
  DefaultTestNumShardsInCluster,
  DefaultTestRoutingInfo,
  delay,
  ServiceNode,
  startLightNode,
  startRelayNode,
  startServiceNode,
  tearDownNodes
} from "../src/index.js";

import { runRelayNodes } from "./relay/utils.js";

describe("Wait for remote peer", function () {
  let waku1: RelayNode;
  let waku2: LightNode;
  let nwaku: ServiceNode;

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, [waku1, waku2]);
  });

  it("Relay - dialed first", async function () {
    this.timeout(20_000);
    [nwaku, waku1] = await runRelayNodes(
      this,
      DefaultTestNetworkConfig,
      undefined,
      [DefaultTestContentTopic]
    );
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    const peers = waku1.relay.getMeshPeers(DefaultTestRoutingInfo.pubsubTopic);
    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers).to.includes(nimPeerId);
  });

  it("Relay - dialed after", async function () {
    this.timeout(20_000);
    nwaku = await startServiceNode(this, {
      relay: true,
      store: false,
      filter: false,
      lightpush: false,
      clusterId: DefaultTestClusterId,
      numShardsInNetwork: DefaultTestNumShardsInCluster,
      contentTopic: [DefaultTestContentTopic]
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku1 = await startRelayNode();

    const waitPromise = waku1.waitForPeers([Protocols.Relay]);
    await delay(1000);
    await waku1.dial(multiAddrWithId);
    await waitPromise;

    const peers = waku1.relay.getMeshPeers(DefaultTestRoutingInfo.pubsubTopic);
    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers).includes(nimPeerId);
  });

  it("Relay - times out", function (done) {
    this.timeout(5000);
    startRelayNode()
      .then((waku1) => {
        waku1.waitForPeers([Protocols.Relay], 200).then(
          () => {
            throw "Promise expected to reject on time out";
          },
          (reason) => {
            expect(reason?.message).to.eq(
              "Timed out waiting for a remote peer."
            );
            done();
          }
        );
      })
      .catch((e) => done(e));
  });

  it("Store - dialed first", async function () {
    this.timeout(20_000);
    nwaku = await startServiceNode(this, {
      store: true,
      relay: false,
      lightpush: false,
      filter: false
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku2 = await startLightNode();
    await waku2.dial(multiAddrWithId);
    await delay(1000);
    await waku2.waitForPeers([Protocols.Store]);

    const peers = (await waku2.getConnectedPeers()).map((peer) =>
      peer.id.toString()
    );
    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });

  it("Store - dialed after - with timeout", async function () {
    this.timeout(20_000);
    nwaku = await startServiceNode(this, {
      store: true,
      relay: false,
      lightpush: false,
      filter: false
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku2 = await startLightNode();
    const waitPromise = waku2.waitForPeers([Protocols.Store], 2000);
    await delay(1000);
    await waku2.dial(multiAddrWithId);
    await waitPromise;

    const peers = (await waku2.getConnectedPeers()).map((peer) =>
      peer.id.toString()
    );

    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });

  it("LightPush", async function () {
    this.timeout(20_000);
    nwaku = await startServiceNode(this, {
      lightpush: true,
      filter: false,
      relay: false,
      store: false
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku2 = await startLightNode();
    await waku2.dial(multiAddrWithId);
    await waku2.waitForPeers([Protocols.LightPush]);

    const peers = (await waku2.getConnectedPeers()).map((peer) =>
      peer.id.toString()
    );

    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });

  it("Filter", async function () {
    this.timeout(20_000);
    nwaku = await startServiceNode(this, {
      filter: true,
      lightpush: false,
      relay: false,
      store: false
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku2 = await startLightNode();
    await waku2.dial(multiAddrWithId);
    await waku2.waitForPeers([Protocols.Filter]);

    const peers = (await waku2.getConnectedPeers()).map((peer) =>
      peer.id.toString()
    );

    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });

  // TODO: re-enable store once https://github.com/waku-org/js-waku/issues/2162 is fixed
  it("Light Node - default protocols", async function () {
    this.timeout(20_000);
    nwaku = await startServiceNode(this, {
      filter: true,
      lightpush: true,
      relay: false
      // store: true
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku2 = await startLightNode();
    await waku2.dial(multiAddrWithId);
    await waku2.waitForPeers([
      Protocols.Filter,
      // Protocols.Store,
      Protocols.LightPush
    ]);

    const peers = (await waku2.getConnectedPeers()).map((peer) =>
      peer.id.toString()
    );

    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });

  it("Relay Node - default protocol", async function () {
    this.timeout(20_000);
    [nwaku, waku1] = await runRelayNodes(this, { clusterId: 0 }, [0]);
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    const peers = waku1.relay.getMeshPeers(formatPubsubTopic(0, 0));

    const nimPeerId = multiAddrWithId.getPeerId();

    expect(nimPeerId).to.not.be.undefined;
    expect(peers.includes(nimPeerId as string)).to.be.true;
  });
});
