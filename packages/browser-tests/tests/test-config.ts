export const NETWORK_CONFIG = {
  "waku.sandbox": {
    peers: [
      "/dns4/node-01.do-ams3.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmNaeL4p3WEYzC9mgXBmBWSgWjPHRvatZTXnp8Jgv3iKsb",
      "/dns4/node-01.gc-us-central1-a.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmRv1iQ3NoMMcjbtRmKxPuYBbF9nLYz2SDv9MTN8WhGuUU",
      "/dns4/node-01.ac-cn-hongkong-c.waku.sandbox.status.im/tcp/30303/p2p/16Uiu2HAmQYiojgZ8APsh9wqbWNyCstVhnp9gbeNrxSEQnLJchC92"
    ]
  },

  "waku.test": {
    peers: [
      "/dns4/node-01.do-ams3.waku.test.status.im/tcp/8000/wss/p2p/16Uiu2HAkykgaECHswi3YKJ5dMLbq2kPVCo89fcyTd38UcQD6ej5W",
      "/dns4/node-01.gc-us-central1-a.waku.test.status.im/tcp/8000/wss/p2p/16Uiu2HAmDCp8XJ9z1ev18zuv8NHekAsjNyezAvmMfFEJkiharitG",
      "/dns4/node-01.ac-cn-hongkong-c.waku.test.status.im/tcp/8000/wss/p2p/16Uiu2HAkzHaTP5JsUwfR9NR8Rj9HC24puS6ocaU8wze4QrXr9iXp"
    ]
  },

  networkConfig: {
    clusterId: 1,
    shards: [0]
  },

  // Default node configuration
  defaultNodeConfig: {
    defaultBootstrap: false
  },

  // Test message configuration
  testMessage: {
    contentTopic: "/test/1/message/proto",
    payload: "Hello, Waku!"
  }
};

export const ACTIVE_PEERS = NETWORK_CONFIG["waku.test"].peers;

// Network defaults with env overrides. Stick to SDK defaults but be explicit.
function getNumberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function getNumberArrayFromEnv(name: string, fallback: number[]): number[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => Number.isFinite(Number(x)))) {
      return parsed.map((x) => Number(x));
    }
  } catch {
    const split = raw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
    if (split.length > 0) return split;
  }
  return fallback;
}

export const DEFAULT_CLUSTER_ID = getNumberFromEnv("WAKU_CLUSTER_ID", 1);
export const DEFAULT_SHARDS = getNumberArrayFromEnv("WAKU_SHARDS", [0]);

export function buildPubsubTopic(clusterId: number, shard: number): string {
  return `/waku/2/rs/${clusterId}/${shard}`;
}

export const PUBSUB_TOPICS: string[] = DEFAULT_SHARDS.map((s) => buildPubsubTopic(DEFAULT_CLUSTER_ID, s));
export const PRIMARY_PUBSUB_TOPIC: string = PUBSUB_TOPICS[0] ?? buildPubsubTopic(DEFAULT_CLUSTER_ID, 0);

// Resolve peers dynamically with the following precedence:
// 1) WAKU_WS_MULTIADDR (single)
// 2) WAKU_WS_MULTIADDRS (JSON array or comma-separated)
// 3) Discover via a temporary js-waku light node using waitForPeers/getConnectedPeers
// 4) Fallback to provided defaultPeers (defaults to ACTIVE_PEERS)
export async function resolvePeers(defaultPeers: string[] = ACTIVE_PEERS): Promise<string[]> {
  const single = process.env.WAKU_WS_MULTIADDR?.trim();
  if (single) return [single];

  const manyRaw = process.env.WAKU_WS_MULTIADDRS?.trim();
  if (manyRaw) {
    try {
      const parsed = JSON.parse(manyRaw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        if (parsed.length > 0) return parsed as string[];
      }
    } catch {
      const split = manyRaw.split(",").map((s) => s.trim()).filter(Boolean);
      if (split.length > 0) return split;
    }
  }

  // Try dynamic discovery via @waku/sdk using built-in helpers
  try {
    const mod: any = await import("@waku/sdk");
    const { Protocols } = await import("@waku/interfaces");
    const node = await mod.createLightNode({ defaultBootstrap: true });
    await node.start();

    // Wait for peers supporting relevant protocols to be connected
    try {
      await node.waitForPeers([Protocols.Filter, Protocols.LightPush], 5000);
    } catch (_e) {
      // ignore timeout; proceed with whatever is connected
    }

    // Prefer official API: getConnectedPeers -> addresses + peer id -> multiaddrs
    const peers = await node.getConnectedPeers();
    const found = new Set<string>();
    for (const p of peers ?? []) {
      const pid = p?.id?.toString?.();
      const addrs = Array.isArray(p?.addresses) ? p.addresses : [];
      for (const a of addrs) {
        const maStr = a?.multiaddr?.toString?.() ?? a?.multiaddr ?? "";
        if (typeof maStr === "string" && /\/ws\/?/.test(maStr)) {
          const withPeer = maStr.includes("/p2p/")
            ? maStr
            : pid ? `${maStr}/p2p/${pid}` : maStr;
          found.add(withPeer);
        }
      }
    }

    await node.stop().catch(() => {});

    if (found.size > 0) return Array.from(found);
  } catch (e) {
    // Discovery failed; fall back
  }

  return defaultPeers;
}
