import tests from "@libp2p/interface-compliance-tests/peer-discovery";
import { LocalStoragePeerInfo } from "@waku/interfaces";
import { LocalStorageDiscovery } from "@waku/local-storage-discovery";
import { createLightNode, type LightNode } from "@waku/sdk";
import { LocalStorage } from "node-localstorage";

import { makeLogFileName, ServiceNode } from "../src/index.js";

global.localStorage = new LocalStorage("./mock_local_storage");

describe("Local Storage Discovery: Compliance Test", function () {
  this.timeout(10000);
  let waku: LightNode;
  let serviceNode1: ServiceNode;
  let serviceNode2: ServiceNode;
  this.beforeEach(async function () {
    waku = await createLightNode();
    serviceNode1 = new ServiceNode(makeLogFileName(this) + "1");
    serviceNode2 = new ServiceNode(makeLogFileName(this) + "1");
    await serviceNode1.start();
    await serviceNode2.start();

    await setPeersInLocalStorage([serviceNode1, serviceNode2]);
  });
  tests({
    async setup() {
      return new LocalStorageDiscovery(waku.libp2p.components);
    },
    async teardown() {}
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
