import { expect } from "chai";

import { ensureValidContentTopic } from "./sharding";

const testInvalidCases = (
  contentTopics: string[],
  expectedError: string
): void => {
  for (const invalidTopic of contentTopics) {
    expect(() => ensureValidContentTopic(invalidTopic)).to.throw(expectedError);
  }
};

describe("ensureValidContentTopic", () => {
  it("does not throw on valid cases", () => {
    const validTopics = [
      "/0/myapp/1/mytopic/cbor",
      "/myapp/1/mytopic/cbor",
      "/myapp/v1.1/mytopic/cbor"
    ];
    for (const validTopic of validTopics) {
      expect(() => ensureValidContentTopic(validTopic)).to.not.throw;
    }
  });
  it("throws on empty content topic", () => {
    testInvalidCases(["", " ", "   "], "Content topic format is invalid");
  });

  it("throws on content topic with too few or too many fields", () => {
    testInvalidCases(
      [
        "myContentTopic",
        "myapp1mytopiccbor/",
        " /myapp/1/mytopic",
        "/myapp/1/mytopic",
        "/0/myapp/1/mytopic/cbor/extra"
      ],
      "Content topic format is invalid"
    );
  });

  it("throws on content topic with non-number generation field", () => {
    testInvalidCases(
      [
        "/a/myapp/1/mytopic/cbor",
        "/ /myapp/1/mytopic/cbor",
        "/_/myapp/1/mytopic/cbor",
        "/$/myapp/1/mytopic/cbor"
      ],
      "Invalid generation field in content topic"
    );
  });

  // Note that this test case should be removed once Waku supports other generations
  it("throws on content topic with generation field greater than 0", () => {
    testInvalidCases(
      [
        "/1/myapp/1/mytopic/cbor",
        "/2/myapp/1/mytopic/cbor",
        "/3/myapp/1/mytopic/cbor",
        "/1000/myapp/1/mytopic/cbor"
      ],
      "Generation greater than 0 is not supported"
    );
  });

  it("throws on content topic with empty application field", () => {
    testInvalidCases(
      ["/0//1/mytopic/cbor"],
      "Application field cannot be empty"
    );
  });

  it("throws on content topic with empty version field", () => {
    testInvalidCases(
      ["/0/myapp//mytopic/cbor"],
      "Version field cannot be empty"
    );
  });

  it("throws on content topic with empty topic name field", () => {
    testInvalidCases(["/0/myapp/1//cbor"], "Topic name field cannot be empty");
  });

  it("throws on content topic with empty encoding field", () => {
    testInvalidCases(["/0/myapp/1/mytopic/"], "Encoding field cannot be empty");
  });
});
