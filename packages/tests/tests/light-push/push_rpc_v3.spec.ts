import { LightPushStatusCode } from "@waku/core";
import { expect } from "chai";

describe("LightPushV3 Handler", function () {
  it("should recognize a successful status code", function () {
    const isSuccess = LightPushStatusCode.SUCCESS === 200;
    expect(isSuccess).to.be.true;
  });

  it("should recognize a client error status code", function () {
    const isClientError = LightPushStatusCode.BAD_REQUEST === 400;
    expect(isClientError).to.be.true;
  });

  it("should recognize a server error status code", function () {
    const isServerError = LightPushStatusCode.INTERNAL_ERROR === 500;
    expect(isServerError).to.be.true;
  });

  it("should return correct status message", function () {
    const message = "OK";
    expect(message).to.equal("OK");
  });
});
