import type { IProtoMessage } from "@waku/interfaces";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import { messageHash } from "./index.js";

// https://rfc.vac.dev/spec/14/#test-vectors
describe("RFC Test Vectors", () => {
  it("Waku message hash computation", () => {
    const expectedHash =
      "4fdde1099c9f77f6dae8147b6b3179aba1fc8e14a7bf35203fc253ee479f135f";

    const pubsubTopic = "/waku/2/default-waku/proto";
    const message: IProtoMessage = {
      payload: hexToBytes("0x010203045445535405060708"),
      contentTopic: "/waku/2/default-content/proto",
      meta: hexToBytes("0x73757065722d736563726574"),
      ephemeral: undefined,
      rateLimitProof: undefined,
      timestamp: undefined,
      version: undefined
    };

    const hash = messageHash(pubsubTopic, message);

    expect(bytesToHex(hash)).to.equal(expectedHash);
  });

  it("Waku message hash computation (meta attribute not present)", () => {
    const expectedHash =
      "87619d05e563521d9126749b45bd4cc2430df0607e77e23572d874ed9c1aaa62";

    const pubsubTopic = "/waku/2/default-waku/proto";
    const message: IProtoMessage = {
      payload: hexToBytes("0x010203045445535405060708"),
      contentTopic: "/waku/2/default-content/proto",
      meta: undefined,
      ephemeral: undefined,
      rateLimitProof: undefined,
      timestamp: undefined,
      version: undefined
    };

    const hash = messageHash(pubsubTopic, message);

    expect(bytesToHex(hash)).to.equal(expectedHash);
  });

  it("Waku message hash computation (payload length 0)", () => {
    const expectedHash =
      "e1a9596237dbe2cc8aaf4b838c46a7052df6bc0d42ba214b998a8bfdbe8487d6";

    const pubsubTopic = "/waku/2/default-waku/proto";
    const message: IProtoMessage = {
      payload: new Uint8Array(),
      contentTopic: "/waku/2/default-content/proto",
      meta: hexToBytes("0x73757065722d736563726574"),
      ephemeral: undefined,
      rateLimitProof: undefined,
      timestamp: undefined,
      version: undefined
    };

    const hash = messageHash(pubsubTopic, message);

    expect(bytesToHex(hash)).to.equal(expectedHash);
  });
});
