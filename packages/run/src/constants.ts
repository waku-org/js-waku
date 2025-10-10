/**
 * Static configuration constants for the local Waku development environment.
 * These values are derived from the --nodekey configuration in docker-compose.yml
 * cspell:ignore nodekey
 */

// Node private keys (from docker-compose.yml --nodekey)
export const NODE1_PRIVATE_KEY =
  "e419c3cf4f09ac3babdf61856e6faa0e0c6a7d97674d5401a0114616549c7632";
export const NODE2_PRIVATE_KEY =
  "50632ab0efd313bfb4aa842de716f03dacd181c863770abd145e3409290fdaa7";

// Derived peer IDs (libp2p identities from the private keys)
export const NODE1_PEER_ID =
  "16Uiu2HAmF6oAsd23RMAnZb3NJgxXrExxBTPMdEoih232iAZkviU2";
export const NODE2_PEER_ID =
  "16Uiu2HAm5aZU47YkiUoARqivbCXwuFPzFFXXiURAorySqAQbL6EQ";

// Static IP addresses (from docker-compose.yml network configuration)
export const NODE1_IP = "172.20.0.10";
export const NODE2_IP = "172.20.0.11";
