import tests from "@libp2p/interface-compliance-tests/peer-discovery";
import { LocalStoragePeerInfo } from "@waku/interfaces";
import { LocalStorageDiscovery } from "@waku/local-storage-discovery";
import { createLightNode, type LightNode } from "@waku/sdk";
import { expect } from "chai";
import { LocalStorage } from "node-localstorage";

import { makeLogFileName, ServiceNode } from "../src/index.js";

global.localStorage = new LocalStorage("./mock_local_storage");

describe("Local Storage Discovery", function () {
  this.timeout(25_000);
  let waku: LightNode;
  let serviceNode1: ServiceNode;
  let serviceNode2: ServiceNode;
  this.beforeEach(async function () {
    serviceNode1 = new ServiceNode(makeLogFileName(this) + "1");
    serviceNode2 = new ServiceNode(makeLogFileName(this) + "1");
    await serviceNode1.start();
    await serviceNode2.start();
    await setPeersInLocalStorage([serviceNode1, serviceNode2]);
  });

  it("Compliance Test", async function () {
    waku = await createLightNode();
    await waku.start();
    tests({
      async setup() {
        return new LocalStorageDiscovery(waku.libp2p.components);
      },
      async teardown() {}
    });
  });

  it("Should discover peers from local storage", async function () {
    waku = await createLightNode({ defaultBootstrap: true });
    await waku.start();

    const serviceNode1PeerId = await serviceNode1.getPeerId();
    const serviceNode2PeerId = await serviceNode2.getPeerId();
    const serviceNode1Ma = await serviceNode1.getMultiaddrWithId();
    const serviceNode2Ma = await serviceNode2.getMultiaddrWithId();

    let serviceNode1Received = false;
    let serviceNode2Received = false;

    await new Promise((resolve) => {
      waku.libp2p.addEventListener("peer:update", (event) => {
        const { peer } = event.detail;

        if (peer.id.toString() === serviceNode1PeerId.toString()) {
          serviceNode1Received = true;

          const hasValidAddress = peer.addresses.some(
            (addr) => addr.toString() === serviceNode1Ma.toString()
          );
          expect(hasValidAddress).to.eq(true);
        } else if (peer.id.toString() === serviceNode2PeerId.toString()) {
          serviceNode2Received = true;
          const hasValidAddress = peer.addresses.some(
            (addr) => addr.toString() === serviceNode2Ma.toString()
          );
          expect(hasValidAddress).to.eq(true);
        }

        if (serviceNode1Received && serviceNode2Received) {
          resolve(true);
        }
      });
    });

    expect(serviceNode1Received).to.eq(true);
    expect(serviceNode2Received).to.eq(true);
  });
});

async function setPeersInLocalStorage(
  serviceNodes: ServiceNode[]
): Promise<void> {
  const peers: LocalStoragePeerInfo[] = [];
  for (const node of serviceNodes) {
    const nodePeerId = await node.getPeerId();
    const nodeMa = await node.getMultiaddrWithId();
    peers.push({
      id: nodePeerId.toString(),
      address: nodeMa.toString()
    });
  }
  const localStorage = global.localStorage;
  const peersStr = JSON.stringify(peers);
  localStorage.setItem("waku:peers", peersStr);
}
