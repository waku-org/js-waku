import { expect, use } from "chai";
import chaibytes from "chai-bytes";

import { decodeWaku2, encodeWaku2, Waku2 } from "./waku2_codec";

use(chaibytes);

const waku2FieldEncodings = {
  relay: new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]),
  store: new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0]),
  filter: new Uint8Array([0, 0, 1, 0, 0, 0, 0, 0]),
  lightpush: new Uint8Array([0, 0, 0, 1, 0, 0, 0, 0]),
  allTrue: new Uint8Array([1, 1, 1, 1, 0, 0, 0, 0]),
  allFalse: new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]),
  relayAndFilterTrue: new Uint8Array([1, 0, 1, 0, 0, 0, 0, 0]),
  storeAndLightpushTrue: new Uint8Array([0, 1, 0, 1, 0, 0, 0, 0]),
};

describe("ENR waku2 codec", function () {
  let protocols: Waku2;

  beforeEach(function () {
    protocols = {
      relay: false,
      store: false,
      filter: false,
      lightpush: false,
    };
  });

  context("Encoding", function () {
    it("should be able to encode the field with only RELAY set to true", () => {
      protocols.relay = true;

      const bytes = encodeWaku2(protocols);

      expect(bytes).to.equalBytes(waku2FieldEncodings.relay);
    });

    it("should be able to encode the field with only STORE set to true", () => {
      protocols.store = true;

      const bytes = encodeWaku2(protocols);

      expect(bytes).to.equalBytes(waku2FieldEncodings.store);
    });

    it("should be able to encode the field with only FILTER set to true", () => {
      protocols.filter = true;

      const bytes = encodeWaku2(protocols);

      expect(bytes).to.equalBytes(waku2FieldEncodings.filter);
    });

    it("should be able to encode the field with only LIGHTPUSH set to true", () => {
      protocols.lightpush = true;

      const bytes = encodeWaku2(protocols);

      expect(bytes).to.equalBytes(waku2FieldEncodings.lightpush);
    });

    it("should be able to encode the field with ALL protocols set to true", () => {
      protocols.relay = true;
      protocols.store = true;
      protocols.filter = true;
      protocols.lightpush = true;

      const bytes = encodeWaku2(protocols);

      expect(bytes).to.equalBytes(waku2FieldEncodings.allTrue);
    });

    it("should be able to encode the field with ALL protocols set to false", () => {
      const bytes = encodeWaku2(protocols);

      expect(bytes).to.equalBytes(waku2FieldEncodings.allFalse);
    });

    it("should be able to encode the field with RELAY and FILTER protocols set to true", () => {
      protocols.relay = true;
      protocols.filter = true;

      const bytes = encodeWaku2(protocols);

      expect(bytes).to.equalBytes(waku2FieldEncodings.relayAndFilterTrue);
    });

    it("should be able to encode the field with STORE and LIGHTPUSH protocols set to true", () => {
      protocols.store = true;
      protocols.lightpush = true;

      const bytes = encodeWaku2(protocols);

      expect(bytes).to.equalBytes(waku2FieldEncodings.storeAndLightpushTrue);
    });
  });

  context("Decoding", function () {
    it("should be able to decode the field with only RELAY set to true", () => {
      const bytes = waku2FieldEncodings.relay;
      const result = decodeWaku2(bytes);

      expect(result.relay).to.be.true;
    });

    it("should be able to decode the field with only FILTER set to true", () => {
      const bytes = waku2FieldEncodings.filter;
      const result = decodeWaku2(bytes);

      expect(result.filter).to.be.true;
    });

    it("should be able to decode the field with only STORE set to true", () => {
      const bytes = waku2FieldEncodings.store;
      const result = decodeWaku2(bytes);

      expect(result.store).to.be.true;
    });

    it("should be able to decode the field with only LIGHTPUSH set to true", () => {
      const bytes = waku2FieldEncodings.lightpush;
      const result = decodeWaku2(bytes);

      expect(result.lightpush).to.be.true;
    });

    it("should be able to decode the field with ALL protocols set to true", () => {
      const bytes = waku2FieldEncodings.allTrue;
      const result = decodeWaku2(bytes);

      expect(result.relay).to.be.true;
      expect(result.store).to.be.true;
      expect(result.filter).to.be.true;
      expect(result.lightpush).to.be.true;
    });

    it("should be able to decode the field with ALL protocols set to false", () => {
      const bytes = waku2FieldEncodings.allFalse;
      const result = decodeWaku2(bytes);

      expect(result.relay).to.be.false;
      expect(result.store).to.be.false;
      expect(result.filter).to.be.false;
      expect(result.lightpush).to.be.false;
    });

    it("should be able to decode the field with RELAY and FILTER protocols set to true", () => {
      const bytes = waku2FieldEncodings.relayAndFilterTrue;
      const result = decodeWaku2(bytes);

      expect(result.relay).to.be.true;
      expect(result.store).to.be.false;
      expect(result.filter).to.be.true;
      expect(result.lightpush).to.be.false;
    });

    it("should be able to decode the field with STORE and LIGHTPUSH protocols set to true", () => {
      const bytes = waku2FieldEncodings.storeAndLightpushTrue;
      const result = decodeWaku2(bytes);

      expect(result.relay).to.be.false;
      expect(result.store).to.be.true;
      expect(result.filter).to.be.false;
      expect(result.lightpush).to.be.true;
    });
  });
});
