// Module script executed inside the headless browser page
// Relies on window.__HEADLESS_CONFIG__ being set by the server-side template

const cfg = (window.__HEADLESS_CONFIG__ || {});
const useCdn = !!cfg.useCdn;
const defaultClusterId = typeof cfg.defaultClusterId === "number" ? cfg.defaultClusterId : 42;
const defaultShard = typeof cfg.defaultShard === "number" ? cfg.defaultShard : 0;
const stubPeerId = cfg.stubPeerId || "mock-peer-id";

// Install a stub API by default; may be replaced below if CDN path is enabled
window.waku = undefined;
window.wakuAPI = {
  getPeerInfo: () => ({ peerId: stubPeerId, multiaddrs: [], peers: [] }),
  getDebugInfo: () => ({ listenAddresses: [], peerId: stubPeerId, protocols: [] }),
  pushMessage: () => ({ successes: [], failures: [] }),
  dialPeers: () => ({ total: 0, errors: [] }),
  createWakuNode: () => ({ success: true, message: "Mock node created" }),
  startNode: () => ({ success: true }),
  stopNode: () => ({ success: true }),
  subscribe: () => ({ unsubscribe: async () => { } })
};

(async () => {
  if (!useCdn) {
    window.postMessage({ type: "WAKU_READY" }, "*");
    return;
  }
  try {
    const { createLightNode, createEncoder, createDecoder } = await import("@waku/sdk");
    window.wakuAPI = {
      async createWakuNode(options) {
        try { if (window.waku) await window.waku.stop(); } catch (e) { console.error(e); }
        window.waku = await createLightNode(options);
        return { success: true };
      },
      async startNode() { await window.waku?.start(); return { success: true }; },
      async stopNode() { await window.waku?.stop(); return { success: true }; },
      async dialPeers(waku, peerAddrs) {
        const errors = [];
        await Promise.allSettled((peerAddrs || []).map((addr) => waku.dial(addr).catch((err) => errors.push(String(err?.message || err)))));
        return { total: (peerAddrs || []).length, errors };
      },
      async pushMessage(waku, contentTopic, payload, opts = {}) {
        const clusterId = opts.clusterId ?? defaultClusterId;
        const shard = opts.shard ?? defaultShard;
        const encoder = createEncoder({ contentTopic, pubsubTopicShardInfo: { clusterId, shard } });
        return waku.lightPush.send(encoder, { payload: payload ?? new Uint8Array() });
      },
      async subscribe(waku, contentTopic, opts = {}, callback) {
        const clusterId = opts.clusterId ?? defaultClusterId;
        const shard = opts.shard ?? defaultShard;
        const decoder = createDecoder(contentTopic, { clusterId, shard });
        return waku.filter.subscribe(decoder, callback ?? (() => { }));
      },
      getPeerInfo(waku) {
        const addrs = waku.libp2p.getMultiaddrs();
        return { peerId: waku.libp2p.peerId.toString(), multiaddrs: addrs.map((a) => a.toString()), peers: [] };
      },
      getDebugInfo(waku) {
        return { listenAddresses: waku.libp2p.getMultiaddrs().map((a) => a.toString()), peerId: waku.libp2p.peerId.toString(), protocols: Array.from(waku.libp2p.getProtocols()) };
      }
    };
    window.postMessage({ type: "WAKU_READY" }, "*");
  } catch (e) {
    window.postMessage({ type: "WAKU_CDN_ERROR", error: String(e?.message || e) }, "*");
  }
})();




