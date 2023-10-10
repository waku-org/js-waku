import type { ShardInfo } from "@waku/interfaces";

export const decodeRelayShard = (bytes: Uint8Array): ShardInfo => {
  if (bytes.length < 3) throw new Error("Insufficient data");

  const view = new DataView(bytes.buffer);
  const cluster = view.getUint16(0);

  const indexList = [];

  if (bytes.length === 130) {
    // rsv format (Bit Vector)
    for (let i = 0; i < 1024; i++) {
      const byteIndex = Math.floor(i / 8) + 2; // Adjusted for the 2-byte cluster field
      const bitIndex = 7 - (i % 8);
      if (view.getUint8(byteIndex) & (1 << bitIndex)) {
        indexList.push(i);
      }
    }
  } else {
    // rs format (Index List)
    const numIndices = view.getUint8(2);
    for (let i = 0, offset = 3; i < numIndices; i++, offset += 2) {
      if (offset + 1 >= bytes.length) throw new Error("Unexpected end of data");
      indexList.push(view.getUint16(offset));
    }
  }

  return { cluster, indexList };
};

export const encodeRelayShard = (shardInfo: ShardInfo): Uint8Array => {
  const { cluster, indexList } = shardInfo;
  const totalLength = indexList.length >= 64 ? 130 : 3 + 2 * indexList.length;
  const buffer = new ArrayBuffer(totalLength);
  const view = new DataView(buffer);

  view.setUint16(0, cluster);

  if (indexList.length >= 64) {
    // rsv format (Bit Vector)
    for (const index of indexList) {
      const byteIndex = Math.floor(index / 8) + 2; // Adjusted for the 2-byte cluster field
      const bitIndex = 7 - (index % 8);
      view.setUint8(byteIndex, view.getUint8(byteIndex) | (1 << bitIndex));
    }
  } else {
    // rs format (Index List)
    view.setUint8(2, indexList.length);
    for (let i = 0, offset = 3; i < indexList.length; i++, offset += 2) {
      view.setUint16(offset, indexList[i]);
    }
  }

  return new Uint8Array(buffer);
};
