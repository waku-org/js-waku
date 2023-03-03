import * as RLP from "@ethersproject/rlp";
import type { ENRKey, ENRValue } from "@waku/interfaces";
import { bytesToHex, bytesToUtf8, hexToBytes } from "@waku/utils";
import { log } from "debug";
import { fromString } from "uint8arrays/from-string";

import { ENR } from "./enr.js";

export class EnrDecoder {
  static fromString(encoded: string): Promise<ENR> {
    if (!encoded.startsWith(ENR.RECORD_PREFIX)) {
      throw new Error(
        `"string encoded ENR must start with '${ENR.RECORD_PREFIX}'`
      );
    }
    return EnrDecoder.fromRLP(fromString(encoded.slice(4), "base64url"));
  }

  static fromRLP(encoded: Uint8Array): Promise<ENR> {
    const decoded = RLP.decode(encoded).map(hexToBytes);
    return EnrDecoder.fromValues(decoded);
  }

  private static async fromValues(decoded: Uint8Array[]): Promise<ENR> {
    if (!Array.isArray(decoded)) {
      throw new Error("Decoded ENR must be an array");
    }
    if (decoded.length % 2 !== 0) {
      throw new Error("Decoded ENR must have an even number of elements");
    }
    const [signature, seq, ...kvs] = decoded;
    if (!signature || Array.isArray(signature)) {
      throw new Error("Decoded ENR invalid signature: must be a byte array");
    }
    if (!seq || Array.isArray(seq)) {
      throw new Error(
        "Decoded ENR invalid sequence number: must be a byte array"
      );
    }
    const obj: Record<ENRKey, ENRValue> = {};
    for (let i = 0; i < kvs.length; i += 2) {
      try {
        obj[bytesToUtf8(kvs[i])] = kvs[i + 1];
      } catch (e) {
        log("Failed to decode ENR key to UTF-8, skipping it", kvs[i], e);
      }
    }
    // If seq is an empty array, translate as value 0
    const hexSeq = "0x" + (seq.length ? bytesToHex(seq) : "00");

    const enr = await ENR.create(obj, BigInt(hexSeq), signature);

    const rlpEncodedBytes = hexToBytes(RLP.encode([seq, ...kvs]));
    if (!enr.verify(rlpEncodedBytes, signature)) {
      throw new Error("Unable to verify ENR signature");
    }
    return enr;
  }
}
