import { Multiaddr } from "multiaddr";

import { MULTIADDR_LENGTH_SIZE } from "./constants";

export function decodeMultiaddrs(bytes: Uint8Array): Multiaddr[] {
  const multiaddrs = [];

  try {
    let index = 0;

    while (index < bytes.length) {
      const sizeBytes = bytes.slice(index, index + 2);
      const size = Buffer.from(sizeBytes).readUInt16BE(0);

      const multiaddrBytes = bytes.slice(
        index + MULTIADDR_LENGTH_SIZE,
        index + size + MULTIADDR_LENGTH_SIZE
      );
      const multiaddr = new Multiaddr(multiaddrBytes);

      multiaddrs.push(multiaddr);
      index += size + MULTIADDR_LENGTH_SIZE;
    }
  } catch (e) {
    throw new Error("Invalid value in multiaddrs field");
  }
  return multiaddrs;
}

export function encodeMultiaddrs(multiaddrs: Multiaddr[]): Uint8Array {
  const totalLength = multiaddrs.reduce(
    (acc, ma) => acc + MULTIADDR_LENGTH_SIZE + ma.bytes.length,
    0
  );
  const bytes = new Uint8Array(totalLength);
  const dataView = new DataView(bytes.buffer);

  let index = 0;
  multiaddrs.forEach((multiaddr) => {
    if (multiaddr.getPeerId())
      throw new Error("`multiaddr` field MUST not contain peer id");

    // Prepend the size of the next entry
    dataView.setUint16(index, multiaddr.bytes.length);
    index += MULTIADDR_LENGTH_SIZE;

    bytes.set(multiaddr.bytes, index);
    index += multiaddr.bytes.length;
  });

  return bytes;
}
