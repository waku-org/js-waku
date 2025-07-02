import * as zerokitRLN from "@waku/zerokit-rln-wasm";

import { BytesUtils } from "./bytes.js";

export function poseidonHash(...input: Array<Uint8Array>): Uint8Array {
  const inputLen = BytesUtils.writeUIntLE(
    new Uint8Array(8),
    input.length,
    0,
    8
  );
  const lenPrefixedData = BytesUtils.concatenate(inputLen, ...input);
  return zerokitRLN.poseidonHash(lenPrefixedData);
}

export function sha256(input: Uint8Array): Uint8Array {
  const inputLen = BytesUtils.writeUIntLE(
    new Uint8Array(8),
    input.length,
    0,
    8
  );
  const lenPrefixedData = BytesUtils.concatenate(inputLen, input);
  return zerokitRLN.hash(lenPrefixedData);
}
