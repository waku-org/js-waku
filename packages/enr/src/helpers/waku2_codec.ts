import type { Waku2 } from "@waku/interfaces";

export function encodeWaku2(protocols: Waku2): number {
  let byte = 0;

  if (protocols.lightPush) byte += 1;
  byte = byte << 1;
  if (protocols.filter) byte += 1;
  byte = byte << 1;
  if (protocols.store) byte += 1;
  byte = byte << 1;
  if (protocols.relay) byte += 1;

  return byte;
}

export function decodeWaku2(byte: number): Waku2 {
  const waku2 = {
    relay: false,
    store: false,
    filter: false,
    lightPush: false
  };

  if (byte % 2) waku2.relay = true;
  byte = byte >> 1;
  if (byte % 2) waku2.store = true;
  byte = byte >> 1;
  if (byte % 2) waku2.filter = true;
  byte = byte >> 1;
  if (byte % 2) waku2.lightPush = true;

  return waku2;
}
