import type { IProtoMessage } from "@waku/interfaces";
import { bytesToHex, hexToBytes } from "@waku/utils/bytes";
import { expect } from "chai";

import { messageHash, messageHashStr } from "./index.js";

// https://rfc.vac.dev/spec/14/#test-vectors
describe("Message Hash: RFC Test Vectors", () => {
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
      "e1a9596237dbe2cc8aaf4b838c46a7052df6bc0d42ba214b998a8bfdbe8487d6";
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

  it("Waku message hash computation (message is IProtoMessage with version)", () => {
    const expectedHash =
      "3f11bc950dce0e3ffdcf205ae6414c01130bb5d9f20644869bff80407fa52c8f";
    const pubsubTopic = "/waku/2/default-waku/proto";
    const message: IProtoMessage = {
      payload: new Uint8Array(),
      contentTopic: "/waku/2/default-content/proto",
      meta: hexToBytes("0x73757065722d736563726574"),
      timestamp:
        BigInt(new Date("2024-04-30T10:54:14.978Z").getTime()) *
        BigInt(1000000),
      ephemeral: undefined,
      rateLimitProof: undefined,
      version: 0
    };
    const hash = messageHash(pubsubTopic, message);
    expect(bytesToHex(hash)).to.equal(expectedHash);
  });
});

describe("messageHash and messageHashStr", () => {
  const pubsubTopic = "/waku/2/default-waku/proto";
  const testMessage: IProtoMessage = {
    payload: hexToBytes("0x010203045445535405060708"),
    contentTopic: "/waku/2/default-content/proto",
    meta: hexToBytes("0x73757065722d736563726574"),
    timestamp: BigInt("0x175789bfa23f8400"),
    ephemeral: undefined,
    rateLimitProof: undefined,
    version: undefined
  };

  it("messageHash returns a Uint8Array", () => {
    const hash = messageHash(pubsubTopic, testMessage);
    expect(hash).to.be.instanceOf(Uint8Array);
    expect(hash.length).to.equal(32); // SHA-256 hash is 32 bytes
  });

  it("messageHashStr returns a hex string", () => {
    const hashStr = messageHashStr(pubsubTopic, testMessage);
    expect(typeof hashStr).to.equal("string");
    expect(hashStr.length).to.equal(64); // SHA-256 hash is 32 bytes = 64 hex chars
    expect(hashStr).to.match(/^[0-9a-f]+$/); // Should be a valid hex string
  });

  it("messageHashStr returns the same value as bytesToHex(messageHash)", () => {
    const hash = messageHash(pubsubTopic, testMessage);
    const hashStrFromBytes = bytesToHex(hash);
    const hashStr = messageHashStr(pubsubTopic, testMessage);
    expect(hashStr).to.equal(hashStrFromBytes);
  });

  it("messageHashStr works with IProtoMessage", () => {
    const decodedMessage: IProtoMessage = {
      payload: new Uint8Array([1, 2, 3, 4]),
      contentTopic: "/waku/2/default-content/proto",
      meta: new Uint8Array([5, 6, 7, 8]),
      timestamp:
        BigInt(new Date("2024-04-30T10:54:14.978Z").getTime()) *
        BigInt(1000000),
      ephemeral: undefined,
      rateLimitProof: undefined,
      version: 0
    };

    const hashStr = messageHashStr(pubsubTopic, decodedMessage);
    expect(typeof hashStr).to.equal("string");
    expect(hashStr.length).to.equal(64);
  });

  it("messageHashStr produces consistent results for the same input", () => {
    const hashStr1 = messageHashStr(pubsubTopic, testMessage);
    const hashStr2 = messageHashStr(pubsubTopic, testMessage);
    expect(hashStr1).to.equal(hashStr2);
  });

  it("messageHashStr produces different results for different inputs", () => {
    const hashStr1 = messageHashStr(pubsubTopic, testMessage);

    const differentMessage = {
      ...testMessage,
      payload: hexToBytes("0x0102030454455354050607080A") // Different payload
    };

    const hashStr2 = messageHashStr(pubsubTopic, differentMessage);
    expect(hashStr1).to.not.equal(hashStr2);
  });
});
