import { ProtocolError } from "@waku/interfaces";
import { expect } from "chai";

import { mapInfoToProtocolError } from "./utils.js";

describe("Light Push Utils", () => {
  describe("mapInfoToProtocolError", () => {
    it("should return REMOTE_PEER_REJECTED for undefined info", () => {
      expect(mapInfoToProtocolError(undefined)).to.equal(
        ProtocolError.REMOTE_PEER_REJECTED
      );
    });

    it("should return REMOTE_PEER_REJECTED for empty string", () => {
      expect(mapInfoToProtocolError("")).to.equal(
        ProtocolError.REMOTE_PEER_REJECTED
      );
    });

    it("should detect RLN errors", () => {
      expect(mapInfoToProtocolError("could not generate rln proof")).to.equal(
        ProtocolError.RLN_PROOF_GENERATION
      );
      expect(
        mapInfoToProtocolError(
          "could not get new message id to generate an rln proof"
        )
      ).to.equal(ProtocolError.RLN_PROOF_GENERATION);
      expect(mapInfoToProtocolError("RLN validation failed")).to.equal(
        ProtocolError.RLN_PROOF_GENERATION
      );
    });

    it("should detect rate limiting errors", () => {
      expect(mapInfoToProtocolError("rate limit exceeded")).to.equal(
        ProtocolError.REMOTE_PEER_REJECTED
      );
      expect(mapInfoToProtocolError("too many requests")).to.equal(
        ProtocolError.REMOTE_PEER_REJECTED
      );
      expect(mapInfoToProtocolError("Rate Limit Exceeded")).to.equal(
        ProtocolError.REMOTE_PEER_REJECTED
      );
    });

    it("should detect topic errors", () => {
      expect(mapInfoToProtocolError("topic not found")).to.equal(
        ProtocolError.TOPIC_NOT_CONFIGURED
      );
      expect(mapInfoToProtocolError("topic not configured")).to.equal(
        ProtocolError.TOPIC_NOT_CONFIGURED
      );
      expect(mapInfoToProtocolError("pubsub topic not configured")).to.equal(
        ProtocolError.TOPIC_NOT_CONFIGURED
      );
    });

    it("should detect size errors", () => {
      expect(mapInfoToProtocolError("message too large")).to.equal(
        ProtocolError.SIZE_TOO_BIG
      );
      expect(mapInfoToProtocolError("payload size exceeded")).to.equal(
        ProtocolError.SIZE_TOO_BIG
      );
      expect(mapInfoToProtocolError("Message Too Large")).to.equal(
        ProtocolError.SIZE_TOO_BIG
      );
    });

    it("should detect decode errors", () => {
      expect(mapInfoToProtocolError("failed to decode message")).to.equal(
        ProtocolError.DECODE_FAILED
      );
      expect(mapInfoToProtocolError("invalid message format")).to.equal(
        ProtocolError.DECODE_FAILED
      );
      expect(mapInfoToProtocolError("malformed request")).to.equal(
        ProtocolError.DECODE_FAILED
      );
    });

    it("should detect empty payload errors", () => {
      expect(mapInfoToProtocolError("empty payload")).to.equal(
        ProtocolError.EMPTY_PAYLOAD
      );
      expect(mapInfoToProtocolError("payload is empty")).to.equal(
        ProtocolError.EMPTY_PAYLOAD
      );
      expect(mapInfoToProtocolError("Empty Payload Not Allowed")).to.equal(
        ProtocolError.EMPTY_PAYLOAD
      );
    });

    it("should return REMOTE_PEER_REJECTED for unrecognized errors", () => {
      expect(mapInfoToProtocolError("some unknown error")).to.equal(
        ProtocolError.REMOTE_PEER_REJECTED
      );
      expect(mapInfoToProtocolError("internal server error")).to.equal(
        ProtocolError.REMOTE_PEER_REJECTED
      );
    });

    it("should be case insensitive", () => {
      expect(mapInfoToProtocolError("RATE LIMIT")).to.equal(
        ProtocolError.REMOTE_PEER_REJECTED
      );
      expect(mapInfoToProtocolError("Topic Not Found")).to.equal(
        ProtocolError.TOPIC_NOT_CONFIGURED
      );
      expect(mapInfoToProtocolError("DECODE FAILED")).to.equal(
        ProtocolError.DECODE_FAILED
      );
    });
  });
});
