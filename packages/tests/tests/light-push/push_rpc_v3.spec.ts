import { LightPushV3StatusCodes, PushRpcV3 } from "@waku/core";
import { expect } from "chai";
import { Uint8ArrayList } from "uint8arraylist";

describe("LightPushV3 Handler", function () {
  it("should correctly encode and decode a request message", function () {
    const request = PushRpcV3.createRequest(
      {
        payload: new Uint8Array([1, 2, 3]),
        contentTopic: "test/1/content/proto"
      },
      "test-topic"
    );

    const encoded = request.encode();
    const decoded = PushRpcV3.decodeRequest(new Uint8ArrayList(encoded));

    expect(decoded.requestId).to.equal(request.requestId);
    expect(decoded.pubsubTopic).to.equal("test-topic");
    expect(decoded.message?.payload).to.deep.equal(new Uint8Array([1, 2, 3]));
  });

  it("should correctly encode and decode a response message", function () {
    const response = PushRpcV3.createResponse(
      "request-id",
      LightPushV3StatusCodes.SUCCESS,
      "Success"
    );

    const encoded = response.encode();
    const decoded = PushRpcV3.decodeResponse(new Uint8ArrayList(encoded));

    expect(decoded.requestId).to.equal("request-id");
    expect(decoded.statusCode).to.equal(LightPushV3StatusCodes.SUCCESS);
    expect(decoded.statusDesc).to.equal("Success");
  });

  it("should recognize a successful status code", function () {
    const isSuccess = LightPushV3StatusCodes.isSuccess(200);
    expect(isSuccess).to.be.true;
  });

  it("should recognize a client error status code", function () {
    const isClientError = LightPushV3StatusCodes.isClientError(404);
    expect(isClientError).to.be.true;
  });

  it("should recognize a server error status code", function () {
    const isServerError = LightPushV3StatusCodes.isServerError(500);
    expect(isServerError).to.be.true;
  });

  it("should return correct status message", function () {
    const message = LightPushV3StatusCodes.getStatusMessage(200);
    expect(message).to.equal("OK");
  });
});
