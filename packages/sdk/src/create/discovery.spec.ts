import { PubsubTopic } from "@waku/interfaces";
import { expect } from "chai";

import { getPeerDiscoveries } from "./discovery.js";

describe("Default Peer Discoveries", () => {
  const pubsubTopics: PubsubTopic[] = [];

  it("should have no discoveries enabled by default", () => {
    const discoveries = getPeerDiscoveries(pubsubTopics);
    expect(discoveries.length).to.equal(0);
  });

  it("should enable all discoveries when explicitly set", () => {
    const discoveries = getPeerDiscoveries(pubsubTopics, {
      dns: true,
      peerExchange: true,
      localPeerCache: true
    });
    expect(discoveries.length).to.equal(3);
  });

  it("should enable only peerExchange and localPeerCache when dns is disabled", () => {
    const discoveries = getPeerDiscoveries(pubsubTopics, {
      dns: false,
      peerExchange: true,
      localPeerCache: true
    });
    expect(discoveries.length).to.equal(2);
  });

  it("should enable only dns and localPeerCache when peerExchange is disabled", () => {
    const discoveries = getPeerDiscoveries(pubsubTopics, {
      dns: true,
      peerExchange: false,
      localPeerCache: true
    });
    expect(discoveries.length).to.equal(2);
  });

  it("should enable only dns and peerExchange when localPeerCache is disabled", () => {
    const discoveries = getPeerDiscoveries(pubsubTopics, {
      dns: true,
      peerExchange: true,
      localPeerCache: false
    });
    expect(discoveries.length).to.equal(2);
  });

  it("should enable only localPeerCache when dns and peerExchange are disabled", () => {
    const discoveries = getPeerDiscoveries(pubsubTopics, {
      dns: false,
      peerExchange: false,
      localPeerCache: true
    });
    expect(discoveries.length).to.equal(1);
  });
});
