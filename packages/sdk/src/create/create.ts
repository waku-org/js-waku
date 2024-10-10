import { multiaddr } from "@multiformats/multiaddr";
import { type LightNode } from "@waku/interfaces";

import { CreateWakuNodeOptions, WakuNode } from "../waku/index.js";

import { createLibp2pAndUpdateOptions } from "./libp2p.js";

/**
 * Creates a Waku Light Node that uses Push, Filter, and Store protocols.
 * This enables low resource consumption and uses Waku Filter V2 by default.
 */
export async function createLightNode(
  options: CreateWakuNodeOptions = {}
): Promise<LightNode> {
  const { nodesToUse, bootstrapPeers } = options;
  // validateMultiaddrs(nodesToUse, bootstrapPeers);

  const validatedOptions = {
    ...options,
    nodesToUse: nodesToUse ? nodesToUse : undefined,
    bootstrapPeers: bootstrapPeers ? bootstrapPeers : undefined
  };

  const { libp2p, pubsubTopics } =
    await createLibp2pAndUpdateOptions(validatedOptions);

  return new WakuNode(pubsubTopics, validatedOptions, libp2p, {
    store: true,
    lightpush: true,
    filter: true
  }) as LightNode;
}

/**
 * Validates multiaddrs for nodesToUse and bootstrapPeers.
 * Throws an error if any multiaddr is invalid.
 */
// function validateMultiaddrs(
//   nodesToUse?: Record<string, string | string[] | undefined>,
//   bootstrapPeers?: string[]
// ): void {
//   const validateMultiaddr = (addr: string, errorContext: string): void => {
//     try {
//       multiaddr(addr).getPeerId();
//     } catch (error) {
//       throw new Error(`Invalid multiaddr: ${errorContext}`);
//     }
//   };

//   if (nodesToUse) {
//     for (const [protocol, nodes] of Object.entries(nodesToUse)) {
//       if (Array.isArray(nodes)) {
//         nodes.forEach((node) =>
//           validateMultiaddr(node, `${protocol} - ${node}`)
//         );
//       } else if (nodes) {
//         validateMultiaddr(nodes, `${protocol} - ${nodes}`);
//       }
//     }
//   }

//   if (bootstrapPeers) {
//     bootstrapPeers.forEach((peer) =>
//       validateMultiaddr(peer, `bootstrapPeers - ${peer}`)
//     );
//   }
// }
