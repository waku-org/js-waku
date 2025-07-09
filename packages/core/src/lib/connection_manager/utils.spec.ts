import { peerIdFromString } from "@libp2p/peer-id";
import { expect } from "chai";

import { mapToPeerId, mapToPeerIdOrMultiaddr } from "./utils.js";

describe("mapToPeerIdOrMultiaddr", () => {
  it("should return PeerId when PeerId is provided", async () => {
    const peerId = peerIdFromString(
      "12D3KooWHFJGwBXD7ukXqKaQZYmV1U3xxN1XCNrgriSEyvkxf6nE"
    );

    const result = mapToPeerIdOrMultiaddr(peerId);

    expect(result).to.equal(peerId);
  });

  it("should return Multiaddr when Multiaddr input is provided", () => {
    const multiAddr =
      "/ip4/127.0.0.1/tcp/8000/p2p/12D3KooWHFJGwBXD7ukXqKaQZYmV1U3xxN1XCNrgriSEyvkxf6nE";

    const result = mapToPeerIdOrMultiaddr(multiAddr);

    expect(result.toString()).to.equal(multiAddr);
  });
});

describe("mapToPeerId", () => {
  it("should return PeerId when PeerId is provided", async () => {
    const peerId = peerIdFromString(
      "12D3KooWHFJGwBXD7ukXqKaQZYmV1U3xxN1XCNrgriSEyvkxf6nE"
    );
    const result = mapToPeerId(peerId);
    expect(result).to.equal(peerId);
    expect(result.toString()).to.equal(peerId.toString());
  });

  it("should return PeerId when Multiaddr input is provided", () => {
    const multiAddr =
      "/ip4/127.0.0.1/tcp/8000/p2p/12D3KooWHFJGwBXD7ukXqKaQZYmV1U3xxN1XCNrgriSEyvkxf6nE";

    const result = mapToPeerId(multiAddr);
    expect(result.toString()).to.equal(
      "12D3KooWHFJGwBXD7ukXqKaQZYmV1U3xxN1XCNrgriSEyvkxf6nE"
    );
  });
});
