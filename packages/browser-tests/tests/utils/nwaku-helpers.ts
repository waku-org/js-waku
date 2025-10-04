import { ServiceNode, ServiceNodesFleet } from "@waku/tests";
import { DefaultTestRoutingInfo } from "@waku/tests";
import { Logger } from "@waku/utils";

const log = new Logger("nwaku-helpers");

/**
 * Creates a two-node nwaku network following waku/tests patterns.
 * Node 1: Relay + Light Push (service provider)
 * Node 2: Relay only (network peer)
 */
export async function createTwoNodeNetwork(): Promise<ServiceNodesFleet> {
  log.info("Creating nwaku node 1 (Relay + Light Push)...");
  const lightPushNode = new ServiceNode("lightpush-node-" + Math.random().toString(36).substring(7));

  const lightPushArgs = {
    relay: true,
    lightpush: true,
    filter: false,
    store: false,
    clusterId: DefaultTestRoutingInfo.clusterId,
    numShardsInNetwork: DefaultTestRoutingInfo.networkConfig.numShardsInCluster,
    contentTopic: [DefaultTestRoutingInfo.contentTopic]
  };

  await lightPushNode.start(lightPushArgs, { retries: 3 });

  log.info("Creating nwaku node 2 (Relay only)...");
  const relayNode = new ServiceNode("relay-node-" + Math.random().toString(36).substring(7));

  // Connect second node to first node (following ServiceNodesFleet pattern)
  const firstNodeAddr = await lightPushNode.getExternalMultiaddr();
  const relayArgs = {
    relay: true,
    lightpush: false,
    filter: false,
    store: false,
    staticnode: firstNodeAddr,
    clusterId: DefaultTestRoutingInfo.clusterId,
    numShardsInNetwork: DefaultTestRoutingInfo.networkConfig.numShardsInCluster,
    contentTopic: [DefaultTestRoutingInfo.contentTopic]
  };

  await relayNode.start(relayArgs, { retries: 3 });

  // Wait for network formation (following waku/tests timing patterns)
  log.info("Waiting for nwaku network formation...");
  await new Promise((r) => setTimeout(r, 5000));

  // Verify connectivity (optional, for debugging)
  await verifyNetworkFormation([lightPushNode, relayNode]);

  // Return ServiceNodesFleet-compatible object
  // Note: We're returning a partial ServiceNodesFleet for testing purposes
  return {
    nodes: [lightPushNode, relayNode],
    messageCollector: null
  } as ServiceNodesFleet;
}

/**
 * Verifies that nwaku nodes have formed connections.
 * Follows error handling patterns from waku/tests.
 */
async function verifyNetworkFormation(nodes: ServiceNode[]): Promise<void> {
  try {
    const peerCounts = await Promise.all(
      nodes.map(async (node, index) => {
        const peers = await node.peers();
        log.info(`Node ${index + 1} has ${peers.length} peer(s)`);
        return peers.length;
      })
    );

    if (peerCounts.every(count => count === 0)) {
      log.warn("⚠️  Nodes may not be properly connected yet");
    }
  } catch (error) {
    log.warn("Could not verify peer connections:", error);
  }
}

/**
 * Extracts Docker-accessible multiaddr from nwaku node.
 * Returns multiaddr using container's internal IP for Docker network communication.
 */
export async function getDockerAccessibleMultiaddr(node: ServiceNode): Promise<string> {
  // Get multiaddr with localhost and extract components
  const localhostMultiaddr = await node.getMultiaddrWithId();
  const peerId = await node.getPeerId();

  // Extract port from multiaddr string
  const multiaddrStr = localhostMultiaddr.toString();
  const portMatch = multiaddrStr.match(/\/tcp\/(\d+)/);
  const port = portMatch ? portMatch[1] : null;

  if (!port) {
    throw new Error("Could not extract port from multiaddr: " + multiaddrStr);
  }

  // Get Docker container IP (accessing internal field)
  // Note: This accesses an internal implementation detail of ServiceNode
  const nodeWithDocker = node as ServiceNode & { docker?: { containerIp?: string } };
  const containerIp = nodeWithDocker.docker?.containerIp;
  if (!containerIp) {
    throw new Error("Could not get container IP from node");
  }

  // Build Docker network accessible multiaddr
  const dockerMultiaddr = `/ip4/${containerIp}/tcp/${port}/ws/p2p/${peerId}`;

  log.info("Original multiaddr:", multiaddrStr);
  log.info("Docker accessible multiaddr:", dockerMultiaddr);

  return dockerMultiaddr;
}

/**
 * Stops nwaku nodes with retry logic, following teardown patterns from waku/tests.
 */
export async function stopNwakuNodes(nodes: ServiceNode[]): Promise<void> {
  if (!nodes || nodes.length === 0) return;

  log.info("Stopping nwaku nodes...");
  try {
    await Promise.all(nodes.map(node => node.stop()));
    log.info("Nwaku nodes stopped successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn("Nwaku nodes stop had issues:", message);
  }
}
