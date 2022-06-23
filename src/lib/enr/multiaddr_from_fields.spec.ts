import { convertToBytes } from "@multiformats/multiaddr/convert";
import { expect } from "chai";

import { multiaddrFromFields } from "./multiaddr_from_fields";

describe("Multiaddr from fields", () => {
  it("tcp ip4 address", function () {
    const ipBytes = convertToBytes("ip4", "1.2.3.4");
    const portBytes = convertToBytes("tcp", "3333");

    const ma = multiaddrFromFields("ip4", "tcp", ipBytes, portBytes);

    expect(ma.toString()).to.eq("/ip4/1.2.3.4/tcp/3333");
  });

  it("udp ip6 address", function () {
    const ipBytes = convertToBytes("ip6", "2345:425:2ca1::5673:23b5");
    const portBytes = convertToBytes("udp", "1111");

    const ma = multiaddrFromFields("ip6", "udp", ipBytes, portBytes);

    expect(ma.toString()).to.eq("/ip6/2345:425:2ca1::5673:23b5/udp/1111");
  });
});
