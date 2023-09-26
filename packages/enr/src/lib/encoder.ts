import * as RLP from "@ethersproject/rlp";
import type { ENRKey, ENRValue } from "@waku/interfaces";
import { hexToBytes, utf8ToBytes } from "@waku/utils/bytes";
import { toString } from "uint8arrays/to-string";

import { ERR_NO_SIGNATURE, MAX_RECORD_SIZE } from "../constants.js";

import { ENR } from "./enr.js";

export class EnrEncoder {
  static async toValues(
    enr: ENR,
    privateKey?: Uint8Array
  ): Promise<(ENRKey | ENRValue | number[])[]> {
    // sort keys and flatten into [k, v, k, v, ...]
    const content: Array<ENRKey | ENRValue | number[]> = Array.from(enr.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((k) => [k, enr.get(k)] as [ENRKey, ENRValue])
      .map(([k, v]) => [utf8ToBytes(k), v])
      .flat();
    content.unshift(new Uint8Array([Number(enr.seq)]));
    if (privateKey) {
      content.unshift(
        await enr.sign(hexToBytes(RLP.encode(content)), privateKey)
      );
    } else {
      if (!enr.signature) {
        throw new Error(ERR_NO_SIGNATURE);
      }
      content.unshift(enr.signature);
    }
    return content;
  }

  static async toBytes(enr: ENR, privateKey?: Uint8Array): Promise<Uint8Array> {
    const encoded = hexToBytes(
      RLP.encode(await EnrEncoder.toValues(enr, privateKey))
    );
    if (encoded.length >= MAX_RECORD_SIZE) {
      throw new Error("ENR must be less than 300 bytes");
    }
    return encoded;
  }

  static async toString(enr: ENR, privateKey?: Uint8Array): Promise<string> {
    return (
      ENR.RECORD_PREFIX +
      toString(await EnrEncoder.toBytes(enr, privateKey), "base64url")
    );
  }
}
