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
  delay,
  makeLogFileName,
  ServiceNode,
  tearDownNodes,
  waitForRemotePeerWithCodec
} from "../../src/index.js";

export const log = new Logger("test:pe");

const pubsubTopic = [singleShardInfoToPubsubTopic({ clusterId: 0, shard: 2 })];

describe.only("Peer Exchange Query", function () {
  this.timeout(120_000);
  let waku: LightNode;
  let nwaku1: ServiceNode;
  let nwaku2: ServiceNode;
  let nwaku3: ServiceNode;
  let nwaku1PeerId: PeerId;
  let nwaku2PeerId: PeerId;
  let nwaku3MA: Multiaddr;
  let nwaku3PeerId: PeerId;
  let components: Libp2pComponents;
  let peerExchange: WakuPeerExchange;
  let numPeersToRequest: number;
  let peerInfos: PeerInfo[];

  before(async function () {
    nwaku1 = new ServiceNode(makeLogFileName(this) + "1");
    nwaku2 = new ServiceNode(makeLogFileName(this) + "2");
    nwaku3 = new ServiceNode(makeLogFileName(this) + "3");
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
    nwaku2PeerId = await nwaku2.getPeerId();
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
    const startTime = Date.now();
    while (!peerInfos || peerInfos.length != numPeersToRequest) {
      if (Date.now() - startTime > 100000) {
        console.log("Timeout reached, exiting the loop.");
        break;
      }

      await delay(2000);

      try {
        peerInfos = await Promise.race([
          peerExchange.query({
            peerId: nwaku3PeerId,
            numPeers: numPeersToRequest
          }) as Promise<PeerInfo[]>,
          new Promise<PeerInfo[]>((resolve) =>
            setTimeout(() => resolve([]), 5000)
          )
        ]);

        if (peerInfos.length === 0) {
          console.log("Query timed out, retrying...");
          continue;
        }

        console.log(peerInfos);
      } catch (error) {
        log.error("Error encountered, retrying...");
      }
    }
  });

  after(async function () {
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
        peerId: nwaku2PeerId,
        numPeers: numPeersToRequest
      });
      throw new Error("Query on not connected peer succeeded unexpectedly.");
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          (error.message === "Not Found" ||
            error.message === "Failed to get a connection to the peer")
        )
      ) {
        throw error;
      }
    }
  });
});
