import type { Waku2 } from "@waku/interfaces";
import { expect } from "chai";

import { decodeWaku2, encodeWaku2 } from "./waku2_codec";

const waku2FieldEncodings = {
  relay: 1,
  store: 2,
  filter: 4,
  lightPush: 8,
  allTrue: 15,
  allFalse: 0,
  relayAndFilterTrue: 5,
  storeAndLightPushTrue: 10
};

describe("ENR waku2 codec", function () {
  let protocols: Waku2;

  beforeEach(function () {
    protocols = {
      relay: false,
      store: false,
      filter: false,
      lightPush: false
    };
  });

  context("Encoding", function () {
    it("should be able to encode the field with only RELAY set to true", () => {
      protocols.relay = true;

      const byte = encodeWaku2(protocols);

      expect(byte).to.eq(waku2FieldEncodings.relay);
    });

    it("should be able to encode the field with only STORE set to true", () => {
      protocols.store = true;

      const byte = encodeWaku2(protocols);

      expect(byte).to.eq(waku2FieldEncodings.store);
    });

    it("should be able to encode the field with only FILTER set to true", () => {
      protocols.filter = true;

      const byte = encodeWaku2(protocols);

      expect(byte).to.eq(waku2FieldEncodings.filter);
    });

    it("should be able to encode the field with only LIGHTPUSH set to true", () => {
      protocols.lightPush = true;

      const byte = encodeWaku2(protocols);

      expect(byte).to.eq(waku2FieldEncodings.lightPush);
    });

    it("should be able to encode the field with ALL protocols set to true", () => {
      protocols.relay = true;
      protocols.store = true;
      protocols.filter = true;
      protocols.lightPush = true;

      const byte = encodeWaku2(protocols);

      expect(byte).to.eq(waku2FieldEncodings.allTrue);
    });

    it("should be able to encode the field with ALL protocols set to false", () => {
      const byte = encodeWaku2(protocols);

      expect(byte).to.eq(waku2FieldEncodings.allFalse);
    });

    it("should be able to encode the field with RELAY and FILTER protocols set to true", () => {
      protocols.relay = true;
      protocols.filter = true;

      const byte = encodeWaku2(protocols);

      expect(byte).to.eq(waku2FieldEncodings.relayAndFilterTrue);
    });

    it("should be able to encode the field with STORE and LIGHTPUSH protocols set to true", () => {
      protocols.store = true;
      protocols.lightPush = true;

      const byte = encodeWaku2(protocols);

      expect(byte).to.eq(waku2FieldEncodings.storeAndLightPushTrue);
    });
  });

  context("Decoding", function () {
    it("should be able to decode the field with only RELAY set to true", () => {
      const byte = waku2FieldEncodings.relay;
      const result = decodeWaku2(byte);

      expect(result.relay).to.be.true;
    });

    it("should be able to decode the field with only FILTER set to true", () => {
      const byte = waku2FieldEncodings.filter;
      const result = decodeWaku2(byte);

      expect(result.filter).to.be.true;
    });

    it("should be able to decode the field with only STORE set to true", () => {
      const byte = waku2FieldEncodings.store;
      const result = decodeWaku2(byte);

      expect(result.store).to.be.true;
    });

    it("should be able to decode the field with only LIGHTPUSH set to true", () => {
      const byte = waku2FieldEncodings.lightPush;
      const result = decodeWaku2(byte);

      expect(result.lightPush).to.be.true;
    });

    it("should be able to decode the field with ALL protocols set to true", () => {
      const byte = waku2FieldEncodings.allTrue;
      const result = decodeWaku2(byte);

      expect(result.relay).to.be.true;
      expect(result.store).to.be.true;
      expect(result.filter).to.be.true;
      expect(result.lightPush).to.be.true;
    });

    it("should be able to decode the field with ALL protocols set to false", () => {
      const byte = waku2FieldEncodings.allFalse;
      const result = decodeWaku2(byte);

      expect(result.relay).to.be.false;
      expect(result.store).to.be.false;
      expect(result.filter).to.be.false;
      expect(result.lightPush).to.be.false;
    });

    it("should be able to decode the field with RELAY and FILTER protocols set to true", () => {
      const byte = waku2FieldEncodings.relayAndFilterTrue;
      const result = decodeWaku2(byte);

      expect(result.relay).to.be.true;
      expect(result.store).to.be.false;
      expect(result.filter).to.be.true;
      expect(result.lightPush).to.be.false;
    });

    it("should be able to decode the field with STORE and LIGHTPUSH protocols set to true", () => {
      const byte = waku2FieldEncodings.storeAndLightPushTrue;
      const result = decodeWaku2(byte);

      expect(result.relay).to.be.false;
      expect(result.store).to.be.true;
      expect(result.filter).to.be.false;
      expect(result.lightPush).to.be.true;
    });
  });
});
