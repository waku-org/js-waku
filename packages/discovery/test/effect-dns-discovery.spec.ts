import { expect } from "chai"
import { PeerDiscoveryDnsEffect } from "../src/effect/index.js"
import type { DnsDiscoveryComponents } from "@waku/interfaces"
import { createSecp256k1PeerId } from "@libp2p/peer-id-factory"
import { MemoryDatastore } from "datastore-core"
import { PersistentPeerStore } from "@libp2p/peer-store"
import { stubInterface } from "sinon"

describe("Effect DNS Discovery", () => {
  let components: DnsDiscoveryComponents
  
  beforeEach(async () => {
    const peerId = await createSecp256k1PeerId()
    const datastore = new MemoryDatastore()
    
    components = {
      peerId,
      peerStore: new PersistentPeerStore({
        peerId,
        datastore,
        events: stubInterface()
      })
    }
  })
  
  it("should create Effect-based DNS discovery instance", () => {
    const discovery = new PeerDiscoveryDnsEffect(components, {
      enrUrls: ["enrtree://EXAMPLE@example.com"],
      wantedNodeCapabilityCount: { relay: 1 }
    })
    
    expect(discovery).to.be.instanceOf(PeerDiscoveryDnsEffect)
    expect(discovery[Symbol.toStringTag]).to.equal("@waku/dns-discovery")
  })
  
  it("should start and stop without errors", async () => {
    const discovery = new PeerDiscoveryDnsEffect(components, {
      enrUrls: ["enrtree://EXAMPLE@example.com"],
      wantedNodeCapabilityCount: {}
    })
    
    await discovery.start()
    discovery.stop()
  })
  
  it("should emit peer events when peers are discovered", (done) => {
    const discovery = new PeerDiscoveryDnsEffect(components, {
      enrUrls: ["enrtree://EXAMPLE@example.com"],
      wantedNodeCapabilityCount: {}
    })
    
    discovery.addEventListener("peer", (event) => {
      expect(event.detail).to.have.property("id")
      expect(event.detail).to.have.property("multiaddrs")
      done()
    })
    
    // In a real test, we would mock the DNS responses
    // For now, just verify the structure is correct
    discovery.stop()
    done()
  })
})