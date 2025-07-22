/**
 * Some constants for test purposes.
 *
 * @hidden
 * @module
 */

import { AutoSharding, ShardInfo } from "@waku/interfaces";
import { createRoutingInfo } from "@waku/utils";

export const NOISE_KEY_1 = new Uint8Array(
  ((): number[] => {
    const b = [];
    for (let i = 0; i < 32; i++) {
      b.push(1);
    }
    return b;
  })()
);

export const NOISE_KEY_2 = new Uint8Array(
  ((): number[] => {
    const b = [];
    for (let i = 0; i < 32; i++) {
      b.push(2);
    }
    return b;
  })()
);

export const NOISE_KEY_3 = new Uint8Array(
  ((): number[] => {
    const b = [];
    for (let i = 0; i < 32; i++) {
      b.push(3);
    }
    return b;
  })()
);

export const TEST_STRING = [
  { description: "short", value: "hi" },
  { description: "long", value: "A".repeat(10000) },
  { description: "numeric", value: "1234567890" },
  { description: "special chars", value: "!@#$%^&*()_+" },
  { description: "Chinese", value: "你好" },
  { description: "Arabic", value: "مرحبا" },
  { description: "Russian", value: "Привет" },
  { description: "SQL Injection", value: "'; DROP TABLE users; --" },
  {
    description: "Script",
    value: '<script>alert("hacked");</script>',
    invalidContentTopic: true
  },
  {
    description: "XML",
    value: "<element>Some content</element>",
    invalidContentTopic: true
  },
  {
    description: "Basic HTML tag",
    value: "<h1>Heading</h1>",
    invalidContentTopic: true
  },
  { description: "JSON", value: '{"user":"admin","password":"123456"}' },
  {
    description: "shell command",
    value: "`rm -rf /`",
    invalidContentTopic: true
  },
  { description: "escaped characters", value: "\\n\\t\\0" },
  { description: "unicode special characters", value: "\u202Ereverse" },
  { description: "emoji", value: "🤫 🤥 😶 😶‍🌫️ 😐 😑 😬 🫨 🫠 🙄 😯 😦 😧 😮" }
];

export const TEST_TIMESTAMPS = [
  BigInt(Date.now()) * BigInt(1000000),
  Date.now(),
  1649153314,
  1949153314000
];

export const MOCHA_HOOK_MAX_TIMEOUT = 50_000;

export const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL || "https://sepolia.gateway.tenderly.co";

export const DefaultTestClusterId = 0;
export const DefaultTestNumShardsInCluster = 10;
export const DefaultTestNetworkConfig: AutoSharding = {
  clusterId: DefaultTestClusterId,
  numShardsInCluster: DefaultTestNumShardsInCluster
};
export const DefaultTestShardInfo: ShardInfo = {
  clusterId: DefaultTestClusterId,
  shards: [0]
};
export const DefaultTestContentTopic = "/test/1/content-topic/proto";
export const DefaultTestRoutingInfo = createRoutingInfo(
  DefaultTestNetworkConfig,
  { contentTopic: DefaultTestContentTopic }
);
