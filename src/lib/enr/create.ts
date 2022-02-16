import { bytesToHex } from "../utils";

import { NodeId } from "./types";

export function createNodeId(bytes: Uint8Array): NodeId {
  if (bytes.length !== 32) {
    throw new Error("NodeId must be 32 bytes in length");
  }
  return bytesToHex(bytes);
}
