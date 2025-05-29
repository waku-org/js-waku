import { PubsubTopic } from "@waku/interfaces";
import { expect } from "chai";

import { getPeerDiscoveries } from "./discovery.js";

describe("Default Peer Discoveries", () => {
  const pubsubTopics: PubsubTopic[] = [];

  it("should enable all discoveries by default", () => {
    const discoveries = getPeerDiscoveries(pubsubTopics);
    expect(discoveries.length).to.equal(3);
  });

  it("should disable DNS discovery when specified", () => {
    const discoveries = getPeerDiscoveries(pubsubTopics, {
      dns: false,
      peerExchange: true,
      localPeerCache: true
    });
    expect(discoveries.length).to.equal(2);
  });

  it("should disable Peer Exchange discovery when specified", () => {
    const discoveries = getPeerDiscoveries(pubsubTopics, {
      dns: true,
      peerExchange: false,
      localPeerCache: true
    });
    expect(discoveries.length).to.equal(2);
  });

  it("should disable Local Peer Cache discovery when specified", () => {
    const discoveries = getPeerDiscoveries(pubsubTopics, {
      dns: true,
      peerExchange: true,
      localPeerCache: false
    });
    expect(discoveries.length).to.equal(2);
  });

  it("should disable multiple discoveries when specified", () => {
    const discoveries = getPeerDiscoveries(pubsubTopics, {
      dns: false,
      peerExchange: false,
      localPeerCache: true
    });
    expect(discoveries.length).to.equal(1);
  });
});
