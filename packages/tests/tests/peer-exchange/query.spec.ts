// REPLACE WITH UNIT TESTS
// import { bootstrap } from "@libp2p/bootstrap";
// import type { PeerId } from "@libp2p/interface";
// import { multiaddr } from "@multiformats/multiaddr";
// import type { Multiaddr } from "@multiformats/multiaddr";
// import {
//   PeerExchangeCodec,
//   WakuPeerExchange,
//   wakuPeerExchangeDiscovery
// } from "@waku/discovery";
// import type { LightNode, PeerExchangeQueryResult } from "@waku/interfaces";
// import { createLightNode, Libp2pComponents, ProtocolError } from "@waku/sdk";
// import { Logger } from "@waku/utils";
// import { expect } from "chai";

// import {
//   afterEachCustom,
//   beforeEachCustom,
//   delay,
//   makeLogFileName,
//   ServiceNode,
//   tearDownNodes,
//   waitForRemotePeerWithCodec
// } from "../../src/index.js";

// export const log = new Logger("test:pe");

// const ShardInfo = { clusterId: 0, shards: [2] };

// describe("Peer Exchange Query", function () {
//   this.timeout(30_000);
//   let waku: LightNode;
//   let nwaku1: ServiceNode;
//   let nwaku2: ServiceNode;
//   let nwaku3: ServiceNode;
//   let nwaku1PeerId: PeerId;
//   let nwaku3MA: Multiaddr;
//   let nwaku3PeerId: PeerId;
//   let components: Libp2pComponents;
//   let peerExchange: WakuPeerExchange;
//   let numPeersToRequest: number;
//   let queryResult: PeerExchangeQueryResult;

//   beforeEachCustom(
//     this,
//     async () => {
//       nwaku1 = new ServiceNode(makeLogFileName(this.ctx) + "1");
//       nwaku2 = new ServiceNode(makeLogFileName(this.ctx) + "2");
//       nwaku3 = new ServiceNode(makeLogFileName(this.ctx) + "3");
//       await nwaku1.start({
//         shard: ShardInfo.shards,
//         clusterId: ShardInfo.clusterId,
//         discv5Discovery: true,
//         peerExchange: true,
//         relay: true
//       });
//       nwaku1PeerId = await nwaku1.getPeerId();
//       await nwaku2.start({
//         shard: ShardInfo.shards,
//         clusterId: ShardInfo.clusterId,
//         discv5Discovery: true,
//         peerExchange: true,
//         discv5BootstrapNode: (await nwaku1.info()).enrUri,
//         relay: true
//       });
//       await nwaku3.start({
//         shard: ShardInfo.shards,
//         clusterId: ShardInfo.clusterId,
//         discv5Discovery: true,
//         peerExchange: true,
//         discv5BootstrapNode: (await nwaku2.info()).enrUri,
//         relay: true
//       });
//       nwaku3MA = await nwaku3.getMultiaddrWithId();
//       nwaku3PeerId = await nwaku3.getPeerId();
//       waku = await createLightNode({
//         libp2p: {
//           peerDiscovery: [
//             bootstrap({ list: [nwaku3MA.toString()] }),
//             wakuPeerExchangeDiscovery()
//           ]
//         }
//       });
//       await waku.start();
//       await waku.libp2p.dialProtocol(nwaku3MA, PeerExchangeCodec);
//       await waitForRemotePeerWithCodec(waku, PeerExchangeCodec, nwaku3PeerId);

//       components = waku.libp2p.components as unknown as Libp2pComponents;
//       peerExchange = new WakuPeerExchange(components);
//       numPeersToRequest = 2;

//       const startTime = Date.now();

//       while (true) {
//         if (Date.now() - startTime > 100_000) {
//           log.error("Timeout reached, exiting the loop.");
//           break;
//         }
//         await delay(2000);
//         try {
//           queryResult = await Promise.race([
//             peerExchange.query({
//               peerId: nwaku3PeerId,
//               numPeers: numPeersToRequest
//             }),
//             new Promise<PeerExchangeQueryResult>((resolve) =>
//               setTimeout(
//                 () =>
//                   resolve({
//                     peerInfos: null,
//                     error: ProtocolError.GENERIC_FAIL
//                   }),
//                 5000
//               )
//             )
//           ]);
//           const hasErrors = queryResult?.error !== null;
//           const hasPeerInfos =
//             queryResult?.peerInfos &&
//             queryResult.peerInfos.length === numPeersToRequest;
//           if (hasErrors) {
//             log.error("Error encountered, retrying...", queryResult.error);
//             continue;
//           }
//           if (!hasPeerInfos) {
//             log.warn(
//               "Peer info not available or does not match the requested number of peers, retrying..."
//             );
//             continue;
//           }
//           break;
//         } catch (error) {
//           log.warn("Error encountered, retrying...", error);
//         }
//       }
//     },
//     120_000
//   );

//   afterEachCustom(this, async () => {
//     await tearDownNodes([nwaku1, nwaku2, nwaku3], waku);
//   });

//   // slow and flaky in CI: https://github.com/waku-org/js-waku/issues/1911
//   it.skip("connected peers and dial", async function () {
//     expect(queryResult.error).to.be.null;

//     expect(queryResult.peerInfos?.[0].ENR).to.not.be.null;
//     expect(queryResult.peerInfos?.[0].ENR?.peerInfo?.multiaddrs).to.not.be.null;

//     const peerWsMA = queryResult.peerInfos?.[0].ENR?.peerInfo?.multiaddrs[2];
//     const localPeerWsMAAsString = peerWsMA
//       ?.toString()
//       .replace(/\/ip4\/[\d.]+\//, "/ip4/127.0.0.1/");
//     const localPeerWsMA = multiaddr(localPeerWsMAAsString);

//     let foundNodePeerId: PeerId | undefined = undefined;
//     const doesPeerIdExistInResponse = queryResult.peerInfos?.some(({ ENR }) => {
//       foundNodePeerId = ENR?.peerInfo?.id;
//       return ENR?.peerInfo?.id.toString() === nwaku1PeerId.toString();
//     });
//     if (!foundNodePeerId) {
//       throw new Error("Peer1 ID not found");
//     }
//     expect(doesPeerIdExistInResponse, "peer not found").to.be.equal(true);

//     await waku.libp2p.dialProtocol(localPeerWsMA, PeerExchangeCodec);
//     await waitForRemotePeerWithCodec(waku, PeerExchangeCodec, foundNodePeerId);
//   });

//   // slow and flaky in CI: https://github.com/waku-org/js-waku/issues/1911
//   it.skip("more peers than existing", async function () {
//     const result = await peerExchange.query({
//       peerId: nwaku3PeerId,
//       numPeers: 5
//     });
//     expect(result.error).to.be.null;
//     expect(result.peerInfos?.length).to.be.eq(numPeersToRequest);
//   });

//   // slow and flaky in CI: https://github.com/waku-org/js-waku/issues/1911
//   it.skip("less peers than existing", async function () {
//     const result = await peerExchange.query({
//       peerId: nwaku3PeerId,
//       numPeers: 1
//     });
//     expect(result.error).to.be.null;
//     expect(result.peerInfos?.length).to.be.eq(1);
//   });

//   // slow and flaky in CI: https://github.com/waku-org/js-waku/issues/1911
//   it.skip("non connected peers", async function () {
//     // querying the non connected peer
//     const result = await peerExchange.query({
//       peerId: nwaku1PeerId,
//       numPeers: numPeersToRequest
//     });
//     expect(result.error).to.be.eq(ProtocolError.NO_PEER_AVAILABLE);
//     expect(result.peerInfos).to.be.null;
//   });
// });
