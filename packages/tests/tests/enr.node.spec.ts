import { EnrDecoder } from "@waku/enr";
import type { RelayNode } from "@waku/interfaces";
import { Protocols } from "@waku/interfaces";
import { expect } from "chai";

import {
  afterEachCustom,
  DefaultTestClusterId,
  DefaultTestContentTopic,
  DefaultTestNumShardsInCluster,
  DefaultTestRoutingInfo,
  ServiceNode,
  startRelayNode,
  startServiceNode,
  tearDownNodes
} from "../src/index.js";

describe("ENR Interop: ServiceNode", function () {
  let waku: RelayNode;
  let nwaku: ServiceNode;

  afterEachCustom(this, async () => {
    await tearDownNodes(nwaku, waku);
  });

  it("Relay", async function () {
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

    waku = await startRelayNode();
    await waku.dial(multiAddrWithId);
    await waku.waitForPeers([Protocols.Relay]);

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
    nwaku = await startServiceNode(this, {
      relay: true,
      store: true,
      filter: false,
      lightpush: false,
      clusterId: DefaultTestClusterId,
      numShardsInNetwork: DefaultTestNumShardsInCluster,
      contentTopic: [DefaultTestContentTopic]
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await startRelayNode();
    await waku.dial(multiAddrWithId);
    await waku.waitForPeers([Protocols.Relay]);

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
    nwaku = await startServiceNode(this, {
      relay: true,
      store: true,
      filter: true,
      lightpush: true,
      clusterId: DefaultTestClusterId,
      numShardsInNetwork: DefaultTestNumShardsInCluster,
      contentTopic: [DefaultTestContentTopic]
    });
    const multiAddrWithId = await nwaku.getMultiaddrWithId();

    waku = await startRelayNode();
    await waku.dial(multiAddrWithId);
    await waku.waitForPeers([Protocols.Relay]);

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
