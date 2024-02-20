import { bootstrap } from "@libp2p/bootstrap";
import type { PeerId } from "@libp2p/interface";
import { multiaddr } from "@multiformats/multiaddr";
import type { Multiaddr } from "@multiformats/multiaddr";
import type { LightNode, PeerInfo } from "@waku/interfaces";
import {
  PeerExchangeCodec,
  WakuPeerExchange,
  wakuPeerExchangeDiscovery
} from "@waku/peer-exchange";
import { createLightNode, Libp2pComponents } from "@waku/sdk";
import { Logger, singleShardInfoToPubsubTopic } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  beforeEachCustom,
  delay,
  makeLogFileName,
  ServiceNode,
  tearDownNodes,
  waitForRemotePeerWithCodec
} from "../../src/index.js";

export const log = new Logger("test:pe");

const pubsubTopic = [singleShardInfoToPubsubTopic({ clusterId: 0, shard: 2 })];

describe("Query", function () {
  this.timeout(30_000);
  let waku: LightNode;
  let nwaku1: ServiceNode;
  let nwaku2: ServiceNode;
  let nwaku3: ServiceNode;
  let nwaku1PeerId: PeerId;
  let nwaku3MA: Multiaddr;
  let nwaku3PeerId: PeerId;
  let components: Libp2pComponents;
  let peerExchange: WakuPeerExchange;
  let numPeersToRequest: number;
  let peerInfos: PeerInfo[];

  beforeEachCustom(this, async () => {
    nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1");
    nwaku2 = new ServiceNode(makeLogFileName(this.ctx) + "2");
    nwaku3 = new ServiceNode(makeLogFileName(this.ctx) + "3");
    await nwaku1.start({
      pubsubTopic: pubsubTopic,
      discv5Discovery: true,
      peerExchange: true,
      relay: true
    });
    nwaku1PeerId = await nwaku1.getPeerId();
    await nwaku2.start({
      pubsubTopic: pubsubTopic,
      discv5Discovery: true,
      peerExchange: true,
      discv5BootstrapNode: (await nwaku1.info()).enrUri,
      relay: true
    });
    await nwaku3.start({
      pubsubTopic: pubsubTopic,
      discv5Discovery: true,
      peerExchange: true,
      discv5BootstrapNode: (await nwaku2.info()).enrUri,
      relay: true
    });
    nwaku3MA = await nwaku3.getMultiaddrWithId();
    nwaku3PeerId = await nwaku3.getPeerId();
    waku = await createLightNode({
      libp2p: {
        peerDiscovery: [
          bootstrap({ list: [nwaku3MA.toString()] }),
          wakuPeerExchangeDiscovery(pubsubTopic)
        ]
      }
    });
    await waku.start();
    await waku.libp2p.dialProtocol(nwaku3MA, PeerExchangeCodec);
    await waitForRemotePeerWithCodec(waku, PeerExchangeCodec, nwaku3PeerId);

    components = waku.libp2p.components as unknown as Libp2pComponents;
    peerExchange = new WakuPeerExchange(components, pubsubTopic);
    numPeersToRequest = 2;

    // querying the connected peer
    peerInfos = [];
    while (peerInfos.length != numPeersToRequest) {
      try {
        peerInfos = (await peerExchange.query({
          peerId: nwaku3PeerId,
          numPeers: numPeersToRequest
        })) as PeerInfo[];
      } catch (error) {
        log.error("Error encountered, retrying...");
      }
      await delay(2000);
    }
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([nwaku1, nwaku2, nwaku3], waku);
  });

  it("connected peers and dial", async function () {
    expect(peerInfos[0].ENR).to.not.be.null;
    expect(peerInfos[0].ENR?.peerInfo?.multiaddrs).to.not.be.null;

    const peerWsMA = peerInfos[0].ENR?.peerInfo?.multiaddrs[2];
    const localPeerWsMAAsString = peerWsMA
      ?.toString()
      .replace(/\/ip4\/[\d.]+\//, "/ip4/127.0.0.1/");
    const localPeerWsMA = multiaddr(localPeerWsMAAsString);

    let foundNodePeerId: PeerId | undefined = undefined;
    const doesPeerIdExistInResponse = peerInfos.some(({ ENR }) => {
      foundNodePeerId = ENR?.peerInfo?.id;
      return ENR?.peerInfo?.id.toString() === nwaku1PeerId.toString();
    });
    if (!foundNodePeerId) {
      throw new Error("Peer1 ID not found");
    }
    expect(doesPeerIdExistInResponse, "peer not found").to.be.equal(true);

    await waku.libp2p.dialProtocol(localPeerWsMA, PeerExchangeCodec);
    await waitForRemotePeerWithCodec(waku, PeerExchangeCodec, foundNodePeerId);
  });

  it("more peers than existing", async function () {
    const peerInfo = await peerExchange.query({
      peerId: nwaku3PeerId,
      numPeers: 5
    });
    expect(peerInfo?.length).to.be.eq(numPeersToRequest);
  });

  it("less peers than existing", async function () {
    const peerInfo = await peerExchange.query({
      peerId: nwaku3PeerId,
      numPeers: 1
    });
    expect(peerInfo?.length).to.be.eq(1);
  });

  it("non connected peers", async function () {
    // querying the non connected peer
    try {
      await peerExchange.query({
        peerId: nwaku1PeerId,
        numPeers: numPeersToRequest
      });
      throw new Error("Query on not connected peer succeeded unexpectedly.");
    } catch (error) {
      if (!(error instanceof Error && error.message === "Not Found")) {
        throw error;
      }
    }
  });
});
