import { multiaddr } from "@multiformats/multiaddr";
import type { Waku } from "@waku/interfaces";
import { createLightNode } from "@waku/sdk";
import { expect } from "chai";

import { NimGoNode, tearDownNodes } from "../src/index.js";

describe("dials multiaddr", function () {
  let waku: Waku;
  let nwaku: NimGoNode;

  afterEach(async function () {
    this.timeout(15000);
    await tearDownNodes(nwaku, waku);
  });

  it("TLS", async function () {
    this.timeout(20_000);

    let tlsWorks = true;

    waku = await createLightNode();
    await waku.start();
    try {
      // dummy multiaddr, doesn't have to be valid
      await waku.dial(multiaddr(`/ip4/127.0.0.1/tcp/30303/tls/ws`));
    } catch (error) {
      if (error instanceof Error) {
        // if the error is of tls unsupported, the test should fail
        // for any other dial errors, the test should pass
        if (error.message === "Unsupported protocol tls") {
          tlsWorks = false;
        }
      }
    }

    expect(tlsWorks).to.eq(true);
  });
});
