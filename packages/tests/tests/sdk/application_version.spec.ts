import { createApplicationNode, WakuNode } from "@waku/sdk";
import {
  contentTopicToPubsubTopic,
  ensureValidContentTopic
} from "@waku/utils";
import { expect } from "chai";

describe("SDK: Creating by Application and Version", function () {
  const ContentTopic = "/myapp/1/latest/proto";

  it("given an application and version, creates a waku node with the correct pubsub topic", async function () {
    const contentTopic = ensureValidContentTopic(ContentTopic);
    const waku = await createApplicationNode(
      contentTopic.application,
      contentTopic.version
    );
    const expectedPubsubTopic = contentTopicToPubsubTopic(ContentTopic);

    expect((waku as WakuNode).pubsubTopics).to.include(expectedPubsubTopic);
  });
});
