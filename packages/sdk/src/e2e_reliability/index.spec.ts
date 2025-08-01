import { type IWaku } from "@waku/interfaces";
import { beforeEach, describe } from "mocha";

import { createLightNode } from "../create/index.js";

import { MessageChannel } from "./index.js";

describe("E2E Reliability", () => {
  let wakuNode: IWaku;
  beforeEach(async () => {
    wakuNode = await createLightNode();
  });

  it("Easily create a new group with e2e reliability", () => {
    MessageChannel.create(wakuNode, "MyChannel");
  });
});
