import { IEncoder, type IWaku } from "@waku/interfaces";
import { utf8ToBytes } from "@waku/utils/bytes";
import { beforeEach, describe } from "mocha";

import { createLightNode } from "../create/index.js";

import { MessageChannel } from "./index.js";

const TEST_CONTENT_TOPIC = "/my-tests/0/topic-name/proto";

describe("E2E Reliability", () => {
  let wakuNode: IWaku;
  let encoder: IEncoder;
  beforeEach(async () => {
    wakuNode = await createLightNode();
    encoder = wakuNode.createEncoder({ contentTopic: TEST_CONTENT_TOPIC });
  });

  it("Easily create a new group with e2e reliability", () => {
    MessageChannel.create(wakuNode, "MyChannel");
  });

  it("Sends a message with e2e reliability", async () => {
    const messageChannel = MessageChannel.create(wakuNode, "MyChannel");

    const message = { payload: utf8ToBytes("message in channel") };
    await messageChannel.send(encoder, message);
  });
});
