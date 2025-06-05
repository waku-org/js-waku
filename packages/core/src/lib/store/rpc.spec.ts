import { expect } from "chai";

import { StoreQueryRequest } from "./rpc.js";

describe("StoreQueryRequest validation", () => {
  it("accepts valid content-filtered query", () => {
    const request = StoreQueryRequest.create({
      pubsubTopic: "/waku/2/default-waku/proto",
      contentTopics: ["/test/1/content/proto"],
      includeData: true,
      paginationForward: true
    });
    expect(request).to.exist;
  });

  it("rejects content-filtered query with only pubsubTopic", () => {
    expect(() =>
      StoreQueryRequest.create({
        pubsubTopic: "/waku/2/default-waku/proto",
        contentTopics: [],
        includeData: true,
        paginationForward: true
      })
    ).to.throw(
      "Both pubsubTopic and contentTopics must be set together for content-filtered queries"
    );
  });

  it("rejects content-filtered query with only contentTopics", () => {
    expect(() =>
      StoreQueryRequest.create({
        pubsubTopic: "",
        contentTopics: ["/test/1/content/proto"],
        includeData: true,
        paginationForward: true
      })
    ).to.throw(
      "Both pubsubTopic and contentTopics must be set together for content-filtered queries"
    );
  });

  it("accepts valid message hash query", () => {
    const request = StoreQueryRequest.create({
      pubsubTopic: "",
      contentTopics: [],
      messageHashes: [new Uint8Array([1, 2, 3, 4])],
      includeData: true,
      paginationForward: true
    });
    expect(request).to.exist;
  });

  it("rejects hash query with content filter parameters", () => {
    expect(() =>
      StoreQueryRequest.create({
        messageHashes: [new Uint8Array([1, 2, 3, 4])],
        pubsubTopic: "/waku/2/default-waku/proto",
        contentTopics: ["/test/1/content/proto"],
        includeData: true,
        paginationForward: true
      })
    ).to.throw(
      "Message hash lookup queries cannot include content filter criteria"
    );
  });

  it("rejects hash query with time filter", () => {
    expect(() =>
      StoreQueryRequest.create({
        pubsubTopic: "",
        contentTopics: [],
        messageHashes: [new Uint8Array([1, 2, 3, 4])],
        timeStart: new Date(),
        includeData: true,
        paginationForward: true
      })
    ).to.throw(
      "Message hash lookup queries cannot include content filter criteria"
    );
  });

  it("accepts time-filtered query with content filter", () => {
    const request = StoreQueryRequest.create({
      pubsubTopic: "/waku/2/default-waku/proto",
      contentTopics: ["/test/1/content/proto"],
      timeStart: new Date(Date.now() - 3600000),
      timeEnd: new Date(),
      includeData: true,
      paginationForward: true
    });
    expect(request).to.exist;
  });
});
