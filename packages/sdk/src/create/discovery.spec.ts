import { expect } from "chai";

import { getPeerDiscoveries } from "./discovery.js";

describe("Default Peer Discoveries", () => {
  it("should have no discoveries enabled by default", () => {
    const discoveries = getPeerDiscoveries();
    expect(discoveries.length).to.equal(0);
  });

  it("should enable all discoveries when explicitly set", () => {
    const discoveries = getPeerDiscoveries({
      dns: true,
      peerExchange: true,
      peerCache: true
    });
    expect(discoveries.length).to.equal(3);
  });

  it("should enable only peerExchange and peerCache when dns is disabled", () => {
    const discoveries = getPeerDiscoveries({
      dns: false,
      peerExchange: true,
      peerCache: true
    });
    expect(discoveries.length).to.equal(2);
  });

  it("should enable only dns and localPeerCache when peerExchange is disabled", () => {
    const discoveries = getPeerDiscoveries({
      dns: true,
      peerExchange: false,
      peerCache: true
    });
    expect(discoveries.length).to.equal(2);
  });

  it("should enable only dns and peerExchange when peerCache is disabled", () => {
    const discoveries = getPeerDiscoveries({
      dns: true,
      peerExchange: true,
      peerCache: false
    });
    expect(discoveries.length).to.equal(2);
  });

  it("should enable only peerCache when dns and peerExchange are disabled", () => {
    const discoveries = getPeerDiscoveries({
      dns: false,
      peerExchange: false,
      peerCache: true
    });
    expect(discoveries.length).to.equal(1);
  });
});
