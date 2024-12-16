import { HealthStatus, IWaku, LightNode, Protocols } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { delay, shardInfoToPubsubTopics } from "@waku/utils";
import { expect } from "chai";

import {
  afterEachCustom,
  runMultipleNodes,
  ServiceNode,
  ServiceNodesFleet
} from "../../src/index.js";

import {
  messagePayload,
  TestDecoder,
  TestEncoder,
  TestShardInfo
} from "./utils.js";
import { waitForHealthStatus } from "./utils.js";

// TODO(weboko): resolve https://github.com/waku-org/js-waku/issues/2186
describe.skip("Node Health Status Matrix Tests", function () {
  let waku: LightNode;
  let serviceNodes: ServiceNode[];

  afterEachCustom(this, async function () {
    if (waku) {
      await waku.stop();
    }
    if (serviceNodes) {
      await Promise.all(serviceNodes.map((node) => node.stop()));
    }
  });

  const peerCounts = [0, 1, 2, 3];

  peerCounts.forEach((lightPushPeers) => {
    peerCounts.forEach((filterPeers) => {
      it(`LightPush: ${lightPushPeers} peers, Filter: ${filterPeers} peers`, async function () {
        this.timeout(10_000);

        [waku, serviceNodes] = await setupTestEnvironment(
          this.ctx,
          lightPushPeers,
          filterPeers
        );

        if (lightPushPeers > 0) {
          await waku.lightPush.send(TestEncoder, messagePayload);
        }

        if (filterPeers > 0) {
          await waku.filter.subscribe([TestDecoder], () => {});
        }

        const lightPushHealth = waku.health.getProtocolStatus(
          Protocols.LightPush
        );
        const filterHealth = waku.health.getProtocolStatus(Protocols.Filter);

        lightPushPeers = await getPeerCounBasedOnConnections(
          waku,
          waku.lightPush.protocol.multicodec
        );
        expect(lightPushHealth?.status).to.equal(
          getExpectedProtocolStatus(lightPushPeers)
        );
        expect(filterHealth?.status).to.equal(
          getExpectedProtocolStatus(filterPeers)
        );

        const expectedHealth = getExpectedNodeHealth(
          lightPushPeers,
          filterPeers
        );
        const nodeHealth = waku.health.getHealthStatus();
        expect(nodeHealth).to.equal(expectedHealth);
      });
    });
  });
});

describe.only("Node Health Status Transitions", function () {
  let waku: LightNode;
  let serviceNodes: ServiceNode[];

  afterEachCustom(this, async function () {
    if (waku) {
      await waku.stop();
    }
    if (serviceNodes) {
      await Promise.all(serviceNodes.map((node) => node.stop()));
    }
  });

  it.only("should transition through health states with events", async function () {
    // Start with no peers
    [waku, serviceNodes] = await setupTestEnvironment(this.ctx, 0, 0);
    expect(waku.health.getHealthStatus()).to.equal(HealthStatus.Unhealthy);

    // Add one peer for minimal health
    const minimalNode = await runNodeWithProtocols(true, true);
    serviceNodes.push(minimalNode);
    await waku.dial(await minimalNode.getMultiaddrWithId());

    await delay(5000);

    console.log("waiting for minimal health status");
    const minimalHealthPromiseEvent = await waitForHealthStatus(
      waku,
      HealthStatus.MinimallyHealthy
    );

    console.log("minimalHealthPromiseEvent", minimalHealthPromiseEvent);

    expect(minimalHealthPromiseEvent.status).to.equal(
      HealthStatus.MinimallyHealthy
    );
    console.log("minimalHealthPromiseEvent", minimalHealthPromiseEvent);

    // Add second peer for sufficient health
    const sufficientNode = await runNodeWithProtocols(true, true);
    serviceNodes.push(sufficientNode);

    const sufficientHealthPromise = waitForHealthStatus(
      waku,
      HealthStatus.SufficientlyHealthy
    );
    await waku.dial(await sufficientNode.getMultiaddrWithId());

    const sufficientEvent = await sufficientHealthPromise;
    expect(sufficientEvent.status).to.equal(HealthStatus.SufficientlyHealthy);
  });

  it("should emit events only when health status changes", async function () {
    [waku, serviceNodes] = await setupTestEnvironment(this.ctx, 2, 2);

    let eventCount = 0;
    waku.health.addEventListener("health:overall", () => {
      eventCount++;
    });

    // These should not trigger health changes as we're already at max health
    await waku.lightPush.send(TestEncoder, messagePayload);
    await waku.filter.subscribe([TestDecoder], () => {});

    // Give events time to propagate
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(eventCount).to.equal(0);
  });
});

function getExpectedProtocolStatus(peerCount: number): HealthStatus {
  if (peerCount === 0) return HealthStatus.Unhealthy;
  if (peerCount === 1) return HealthStatus.MinimallyHealthy;
  return HealthStatus.SufficientlyHealthy;
}

async function getPeerCounBasedOnConnections(
  waku: IWaku,
  codec: string
): Promise<number> {
  const peerIDs = waku.libp2p
    .getConnections()
    .map((c) => c.remotePeer.toString());

  const peers = await waku.libp2p.peerStore.all();

  return peers
    .filter((peer) => peerIDs.includes(peer.id.toString()))
    .filter((peer) => peer.protocols.includes(codec)).length;
}

function getExpectedNodeHealth(
  lightPushPeers: number,
  filterPeers: number
): HealthStatus {
  if (lightPushPeers === 0 || filterPeers === 0) {
    return HealthStatus.Unhealthy;
  } else if (lightPushPeers === 1 || filterPeers === 1) {
    return HealthStatus.MinimallyHealthy;
  } else {
    return HealthStatus.SufficientlyHealthy;
  }
}

async function runNodeWithProtocols(
  lightPush: boolean,
  filter: boolean
): Promise<ServiceNode> {
  const serviceNode = new ServiceNode(`node-${Date.now()}`);
  await serviceNode.start({
    lightpush: lightPush,
    filter: filter,
    relay: true,
    clusterId: TestShardInfo.clusterId,
    pubsubTopic: shardInfoToPubsubTopics(TestShardInfo)
  });
  return serviceNode;
}

async function setupTestEnvironment(
  context: Mocha.Context,
  lightPushPeers: number,
  filterPeers: number
): Promise<[LightNode, ServiceNode[]]> {
  let commonPeers: number;
  if (lightPushPeers === 0 || filterPeers === 0) {
    commonPeers = Math.max(lightPushPeers, filterPeers);
  } else {
    commonPeers = Math.min(lightPushPeers, filterPeers);
  }

  let waku: LightNode;
  const serviceNodes: ServiceNode[] = [];
  let serviceNodesFleet: ServiceNodesFleet;

  if (commonPeers > 0) {
    [serviceNodesFleet, waku] = await runMultipleNodes(
      context,
      TestShardInfo,
      { filter: true, lightpush: true },
      undefined,
      commonPeers
    );
    serviceNodes.push(...serviceNodesFleet.nodes);
  } else {
    waku = await createLightNode({ networkConfig: TestShardInfo });
  }

  // Create additional LightPush nodes if needed
  for (let i = commonPeers; i < lightPushPeers; i++) {
    const node = await runNodeWithProtocols(true, false);
    serviceNodes.push(node);
    await waku.dial(await node.getMultiaddrWithId());
  }

  // Create additional Filter nodes if needed
  for (let i = commonPeers; i < filterPeers; i++) {
    const node = await runNodeWithProtocols(false, true);
    serviceNodes.push(node);
    await waku.dial(await node.getMultiaddrWithId());
  }

  return [waku, serviceNodes];
}
