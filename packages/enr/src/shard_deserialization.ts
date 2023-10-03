import type { ShardInfo } from "@waku/interfaces";

export const decodeRelayShard = (bytes: Uint8Array): ShardInfo => {
  // Ensure there is enough data (at least 3 bytes)
  if (bytes.length < 3) {
    throw new Error("Insufficient data");
  }

  // Read cluster (first 2 bytes)
  const cluster = (bytes[0] << 8) | bytes[1];

  // Read the number of indices (3rd byte)
  const numIndices = bytes[2];

  // Read the indices
  let offset = 3;
  const indexList = [];
  for (let i = 0; i < numIndices; i++) {
    if (offset + 1 >= bytes.length) {
      throw new Error("Unexpected end of data");
    }
    indexList.push((bytes[offset] << 8) | bytes[offset + 1]);
    offset += 2;
  }

  return { cluster, indexList };
};
