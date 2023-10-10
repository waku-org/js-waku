import type { ShardInfo } from "@waku/interfaces";

// function to decode a 16-bit unsigned integer from a byte array
const decodeUint16 = (bytes: Uint8Array, offset: number): number => {
  return (bytes[offset] << 8) | bytes[offset + 1];
};

// function to encode a 16-bit unsigned integer into a byte array
const encodeUint16 = (value: number): Uint8Array => {
  return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
};

export const decodeRelayShard = (bytes: Uint8Array): ShardInfo => {
  if (bytes.length < 3) throw new Error("Insufficient data");

  const cluster = decodeUint16(bytes, 0);
  const indexList = [];

  if (bytes[2] >= 64) {
    // rsv format (Bit Vector)
    if (bytes.length !== 130)
      throw new Error("Invalid data length for Bit Vector");

    const bitVector = bytes.slice(3);
    for (let i = 0; i < 1024; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      if (bitVector[byteIndex] & (1 << bitIndex)) {
        indexList.push(i);
      }
    }
  } else {
    // rs format (Index List)
    const numIndices = bytes[2];
    for (let i = 0, offset = 3; i < numIndices; i++, offset += 2) {
      if (offset + 1 >= bytes.length) throw new Error("Unexpected end of data");

      indexList.push(decodeUint16(bytes, offset));
    }
  }

  return { cluster, indexList };
};

export const encodeRelayShard = (shardInfo: ShardInfo): Uint8Array => {
  const { cluster, indexList } = shardInfo;
  const clusterBytes = encodeUint16(cluster);

  if (indexList.length >= 64) {
    // rsv format (Bit Vector)
    const bitVector = new Uint8Array(128).fill(0);
    for (const index of indexList) {
      const byteIndex = Math.floor(index / 8);
      const bitIndex = index % 8;
      bitVector[byteIndex] |= 1 << bitIndex;
    }
    return Uint8Array.from([...clusterBytes, ...bitVector]);
  } else {
    // rs format (Index List)
    const indicesBytes = indexList.flatMap((index) => [...encodeUint16(index)]);
    return Uint8Array.from([
      ...clusterBytes,
      indexList.length,
      ...indicesBytes
    ]);
  }
};
