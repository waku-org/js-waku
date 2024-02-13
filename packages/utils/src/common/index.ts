import type { Address } from "@libp2p/interface";

export * from "./is_defined.js";
export * from "./random_subset.js";
export * from "./group_by.js";
export * from "./to_async_iterator.js";
export * from "./is_size_valid.js";
export * from "./sharding.js";
export * from "./push_or_init_map.js";
export * from "./relay_shard_codec.js";

export function removeItemFromArray(arr: unknown[], value: unknown): unknown[] {
  const index = arr.indexOf(value);
  if (index > -1) {
    arr.splice(index, 1);
  }
  return arr;
}

export function getWsMultiaddrFromMultiaddrs(addresses: Address[]): Address {
  const wsMultiaddr = addresses.find(
    (addr) =>
      addr.multiaddr.toString().includes("ws") ||
      addr.multiaddr.toString().includes("wss")
  );
  if (!wsMultiaddr) {
    throw new Error("No ws multiaddr found in the given addresses");
  }
  return wsMultiaddr;
}
