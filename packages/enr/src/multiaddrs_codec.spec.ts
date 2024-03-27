import { multiaddr } from "@multiformats/multiaddr";
import { expect } from "chai";

import { decodeMultiaddrs, encodeMultiaddrs } from "./multiaddrs_codec.js";

describe("ENR multiaddrs codec", function () {
  it("Sample", async () => {
    const multiaddrs = [
      multiaddr("/dns4/node-01.do-ams3.waku.test.status.im/tcp/443/wss"),
      multiaddr(
        "/dns6/node-01.ac-cn-hongkong-c.waku.test.status.im/tcp/443/wss"
      ),
      multiaddr(
        "/onion3/vww6ybal4bd7szmgncyruucpgfkqahzddi37ktceo3ah7ngmcopnpyyd:1234/wss"
      )
    ];

    const bytes = encodeMultiaddrs(multiaddrs);
    const result = decodeMultiaddrs(bytes);

    const multiaddrsAsStr = result.map((ma) => ma.toString());
    expect(multiaddrsAsStr).to.include(
      "/dns4/node-01.do-ams3.waku.test.status.im/tcp/443/wss"
    );
    expect(multiaddrsAsStr).to.include(
      "/dns6/node-01.ac-cn-hongkong-c.waku.test.status.im/tcp/443/wss"
    );
    expect(multiaddrsAsStr).to.include(
      "/onion3/vww6ybal4bd7szmgncyruucpgfkqahzddi37ktceo3ah7ngmcopnpyyd:1234/wss"
    );
  });
});
