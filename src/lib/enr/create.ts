import { bufToHex } from "../utils";

import { NodeId } from "./types";

export function createNodeId(buffer: Buffer): NodeId {
  if (buffer.length !== 32) {
    throw new Error("NodeId must be 32 bytes in length");
  }
  return bufToHex(buffer);
}
