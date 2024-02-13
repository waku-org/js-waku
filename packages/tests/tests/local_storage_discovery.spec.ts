import tests from "@libp2p/interface-compliance-tests/peer-discovery";
import { LocalStoragePeerInfo } from "@waku/interfaces";
import { LocalStorageDiscovery } from "@waku/local-discovery";
import { createLightNode, type LightNode } from "@waku/sdk";
import { LocalStorage } from "node-localstorage";

global.localStorage = new LocalStorage("./mock_local_storage");

describe("Local Storage Discovery", function () {
  this.timeout(25_000);
  let waku: LightNode;

  this.beforeEach(async function () {});

  describe.only("Compliance Tests", function () {
    tests({
      async setup() {
        await setPeersInLocalStorage();
        waku = await createLightNode();
        return new LocalStorageDiscovery(waku.libp2p.components);
      },
      async teardown() {}
    });
  });

  async function setPeersInLocalStorage(): Promise<void> {
    const MOCK_PEER_ID =
      "16Uiu2HAm4v86W3bmT1BiH6oSPzcsSr24iDQpSN5Qa992BCjjwgrD";
    const MOCK_MA = `/ip4/127.0.0.1/tcp/8000/ws/p2p/${MOCK_PEER_ID}`;

    const peers: LocalStoragePeerInfo[] = [];
    peers.push({
      id: MOCK_PEER_ID.toString(),
      address: MOCK_MA
    });
    const localStorage = global.localStorage;
    const peersStr = JSON.stringify(peers);
    localStorage.setItem("waku:peers", peersStr);
  }
});
