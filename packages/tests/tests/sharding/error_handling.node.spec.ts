import { DefaultPubsubTopic } from "@waku/core";
import { createDecoder, createEncoder } from "@waku/sdk";

describe("Static Sharding: error handling", function () {
  const customPubsubTopic = "/waku/2/rs/3/1";

  it("Decoder with custom pubSubTopic", async function () {
    try {
      createDecoder("customContentTopic1", customPubsubTopic);
      throw new Error("createDecoder was successful with custom pubSubTopic");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          `Error: cannot use custom named pubsub topic: ${customPubsubTopic}, must be ${DefaultPubsubTopic}`
        )
      ) {
        throw err;
      }
    }
  });

  it("Encoder with custom pubSubTopic", async function () {
    try {
      createEncoder({
        pubsubTopic: customPubsubTopic,
        contentTopic: "customContentTopic1"
      });
      throw new Error("createEncoder was successful with custom pubSubTopic");
    } catch (err) {
      if (
        !(err instanceof Error) ||
        !err.message.includes(
          `Error: cannot use custom named pubsub topic: ${customPubsubTopic}, must be ${DefaultPubsubTopic}`
        )
      ) {
        throw err;
      }
    }
  });
});
