import type { IDecodedMessage, IProtoMessage } from "@waku/interfaces";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import { messageHash } from "./index.js";

// https://rfc.vac.dev/spec/14/#test-vectors
describe("RFC Test Vectors", () => {
  it("Waku message hash computation (meta size of 12 bytes)", () => {
    const expectedHash =
      "64cce733fed134e83da02b02c6f689814872b1a0ac97ea56b76095c3c72bfe05";
    const pubsubTopic = "/waku/2/default-waku/proto";
    const message: IProtoMessage = {
      payload: hexToBytes("0x010203045445535405060708"),
      contentTopic: "/waku/2/default-content/proto",
      meta: hexToBytes("0x73757065722d736563726574"),
      timestamp: BigInt("0x175789bfa23f8400"),
      ephemeral: undefined,
      rateLimitProof: undefined,
      version: undefined
    };
    const hash = messageHash(pubsubTopic, message);
    expect(bytesToHex(hash)).to.equal(expectedHash);
  });

  it("Waku message hash computation (meta size of 64 bytes)", () => {
    const expectedHash =
      "7158b6498753313368b9af8f6e0a0a05104f68f972981da42a43bc53fb0c1b27";
    const pubsubTopic = "/waku/2/default-waku/proto";
    const message: IProtoMessage = {
      payload: hexToBytes("0x010203045445535405060708"),
      contentTopic: "/waku/2/default-content/proto",
      meta: hexToBytes(
        "0x000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f"
      ),
      timestamp: BigInt("0x175789bfa23f8400"),
      ephemeral: undefined,
      rateLimitProof: undefined,
      version: undefined
    };
    const hash = messageHash(pubsubTopic, message);
    expect(bytesToHex(hash)).to.equal(expectedHash);
  });

  it("Waku message hash computation (meta attribute not present)", () => {
    const expectedHash =
      "a2554498b31f5bcdfcbf7fa58ad1c2d45f0254f3f8110a85588ec3cf10720fd8";
    const pubsubTopic = "/waku/2/default-waku/proto";
    const message: IProtoMessage = {
      payload: hexToBytes("0x010203045445535405060708"),
      contentTopic: "/waku/2/default-content/proto",
      meta: undefined,
      timestamp: BigInt("0x175789bfa23f8400"),
      ephemeral: undefined,
      rateLimitProof: undefined,
      version: undefined
    };
    const hash = messageHash(pubsubTopic, message);
    expect(bytesToHex(hash)).to.equal(expectedHash);
  });

  it("Waku message hash computation (payload length 0)", () => {
    const expectedHash =
      "483ea950cb63f9b9d6926b262bb36194d3f40a0463ce8446228350bd44e96de4";
    const pubsubTopic = "/waku/2/default-waku/proto";
    const message: IProtoMessage = {
      payload: new Uint8Array(),
      contentTopic: "/waku/2/default-content/proto",
      meta: hexToBytes("0x73757065722d736563726574"),
      timestamp: BigInt("0x175789bfa23f8400"),
      ephemeral: undefined,
      rateLimitProof: undefined,
      version: undefined
    };
    const hash = messageHash(pubsubTopic, message);
    expect(bytesToHex(hash)).to.equal(expectedHash);
  });

  it("Waku message hash computation (no timestamp)", () => {
    const expectedHash =
      "483ea950cb63f9b9d6926b262bb36194d3f40a0463ce8446228350bd44e96de4";
    const pubsubTopic = "/waku/2/default-waku/proto";
    const message: IProtoMessage = {
      payload: new Uint8Array(),
      contentTopic: "/waku/2/default-content/proto",
      meta: hexToBytes("0x73757065722d736563726574"),
      timestamp: undefined,
      ephemeral: undefined,
      rateLimitProof: undefined,
      version: undefined
    };
    const hash = messageHash(pubsubTopic, message);
    expect(bytesToHex(hash)).to.equal(expectedHash);
  });

  it("Waku message hash computation (message is IDecodedMessage)", () => {
    const expectedHash =
      "483ea950cb63f9b9d6926b262bb36194d3f40a0463ce8446228350bd44e96de4";
    const pubsubTopic = "/waku/2/default-waku/proto";
    const message: IDecodedMessage = {
      payload: new Uint8Array(),
      pubsubTopic,
      contentTopic: "/waku/2/default-content/proto",
      meta: hexToBytes("0x73757065722d736563726574"),
      timestamp: new Date(),
      ephemeral: undefined,
      rateLimitProof: undefined
    };
    const hash = messageHash(pubsubTopic, message);
    expect(bytesToHex(hash)).to.equal(expectedHash);
  });
});
