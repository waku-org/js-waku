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

export const encodeRelayShard = (shardInfo: ShardInfo): Uint8Array => {
  const { cluster, indexList } = shardInfo;

  // Convert cluster to 2 bytes
  const clusterBytes = new Uint8Array(2);
  clusterBytes[0] = (cluster >> 8) & 0xff;
  clusterBytes[1] = cluster & 0xff;

  // Convert indices to bytes
  const indicesBytes = new Uint8Array(indexList.length * 2);
  for (let i = 0; i < indexList.length; i++) {
    indicesBytes[i * 2] = (indexList[i] >> 8) & 0xff;
    indicesBytes[i * 2 + 1] = indexList[i] & 0xff;
  }

  // Create final output array
  const output = new Uint8Array(3 + indicesBytes.length);
  output[0] = clusterBytes[0];
  output[1] = clusterBytes[1];
  output[2] = indexList.length;
  output.set(indicesBytes, 3);

  return output;
};
