import { generateKeyPair } from "@libp2p/crypto/keys";
import type { PeerId } from "@libp2p/interface";
import { peerIdFromPrivateKey } from "@libp2p/peer-id";
import { LightNode, Tags } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";

import { afterEachCustom, beforeEachCustom } from "../../src/index.js";
import { tearDownNodes } from "../../src/index.js";

const TEST_TIMEOUT = 20_000;

describe("Public methods", function () {
  let waku: LightNode;
  this.timeout(TEST_TIMEOUT);
  beforeEachCustom(this, async () => {
    waku = await createLightNode();
  });

  afterEachCustom(this, async () => {
    await tearDownNodes([], waku);
  });

  // TODO(weboko): skipped and should be tested in discovery module that it sets the tag
  it.skip("getPeersByDiscovery", async function () {
    const privateKey = await generateKeyPair("secp256k1");
    const peerIdBootstrap = peerIdFromPrivateKey(privateKey);
    // const peers_before = await waku.connectionManager.getPeersByDiscovery();
    // expect(peers_before.DISCOVERED[Tags.BOOTSTRAP]).to.deep.eq([]);

    const ttl = 1200000;
    const tag_value = 50;

    await waku.libp2p.peerStore.save(peerIdBootstrap, {
      tags: {
        [Tags.BOOTSTRAP]: {
          value: tag_value,
          ttl: ttl
        }
      }
    });

    // const currentTime = Date.now(); // Get the current time at the point peer connect
    waku.libp2p.dispatchEvent(
      new CustomEvent<PeerId>("peer:connect", { detail: peerIdBootstrap })
    );

    // const peers_after = <PeersByDiscoveryResult>(
    //   await waku.connectionManager.getPeersByDiscovery()
    // );
    // const bootstrap_peer = peers_after.DISCOVERED[Tags.BOOTSTRAP];

    // expect(bootstrap_peer).to.not.deep.eq([]);
    // expect(bootstrap_peer[0].id.toString()).to.eq(peerIdBootstrap.toString());
    // expect(bootstrap_peer[0].tags.has("bootstrap")).to.be.true;
    // expect(bootstrap_peer[0].tags.get("bootstrap")!.value).to.equal(tag_value);
    // Assert that the expiry is within the expected range, considering TTL
    // Note: We allow a small margin for the execution time of the code
    // const marginOfError = 1000; // 1 second in milliseconds, adjust as needed
    // const expiry = (bootstrap_peer[0].tags.get("bootstrap") as any).expiry;
    // expect(Number(expiry)).to.be.closeTo(currentTime + ttl, marginOfError);
  });
});
