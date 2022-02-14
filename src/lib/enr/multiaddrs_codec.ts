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
  let multiaddrsBuf = Buffer.from([]);

  multiaddrs.forEach((multiaddr) => {
    if (multiaddr.getPeerId())
      throw new Error("`multiaddr` field MUST not contain peer id");

    const bytes = multiaddr.bytes;

    let buf = Buffer.alloc(2);

    // Prepend the size of the next entry
    const written = buf.writeUInt16BE(bytes.length, 0);

    if (written !== MULTIADDR_LENGTH_SIZE) {
      throw new Error(
        `Internal error: unsigned 16-bit integer was not written in ${MULTIADDR_LENGTH_SIZE} bytes`
      );
    }

    buf = Buffer.concat([buf, bytes]);

    multiaddrsBuf = Buffer.concat([multiaddrsBuf, buf]);
  });

  return multiaddrsBuf;
}
