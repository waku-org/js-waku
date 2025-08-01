import { IDecodedMessage, IDecoder, IEncoder, IWaku } from "@waku/interfaces";
import { delay } from "@waku/utils";
import { bytesToUtf8, utf8ToBytes } from "@waku/utils/bytes";
import { expect } from "chai";
import { beforeEach, describe } from "mocha";

import { createLightNode } from "../create/index.js";

import { MessageChannel } from "./index.js";

const TEST_CONTENT_TOPIC = "/my-tests/0/topic-name/proto";

describe("E2E Reliability", () => {
  let wakuNode: IWaku;
  let encoder: IEncoder;
  let decoder: IDecoder<IDecodedMessage>;

  beforeEach(async () => {
    wakuNode = await createLightNode();
    encoder = wakuNode.createEncoder({ contentTopic: TEST_CONTENT_TOPIC });
    decoder = wakuNode.createDecoder({ contentTopic: TEST_CONTENT_TOPIC });
  });

  it("Easily create a new group with e2e reliability", () => {
    MessageChannel.create(wakuNode, "MyChannel");
  });

  it("Sends a message with e2e reliability", async () => {
    const messageChannel = MessageChannel.create(wakuNode, "MyChannel");

    const message = { payload: utf8ToBytes("message in channel") };
    await messageChannel.send(encoder, message);
  });

  it("Subscribe and then sends a message with e2e reliability", async () => {
    const messageChannel = MessageChannel.create(wakuNode, "MyChannel");

    let receivedMessage: IDecodedMessage;
    const subRes = await messageChannel.subscribe(
      decoder,
      (message: IDecodedMessage) => {
        receivedMessage = message;
      }
    );

    expect(subRes).to.be.true;

    const message = { payload: utf8ToBytes("message in channel") };
    await messageChannel.send(encoder, message);

    //TODO: replace with even emitting
    while (!receivedMessage!) {
      await delay(100);
    }
    expect(bytesToUtf8(receivedMessage?.payload)).to.eq(message.payload);
  });
});
