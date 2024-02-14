import { createLightNode, LightNode } from "@waku/sdk";
import { expect } from "chai";
import sinon, { SinonSpy } from "sinon";

import {
  afterEachCustom,
  beforeEachCustom,
  tearDownNodes
} from "../src/index.js";

describe("Create node", function () {
  let waku: LightNode;
  let consoleInfoSpy: SinonSpy;

  beforeEachCustom(this, async () => {
    consoleInfoSpy = sinon.spy(console as any, "info");
  });

  afterEachCustom(this, async () => {
    consoleInfoSpy.restore();
    sinon.restore();
    await tearDownNodes([], waku);
  });

  it("should log info about WebSocket failures to console when hideWebSocketInfo disabled and NODE_ENV is not test", async () => {
    sinon.stub(process.env, "NODE_ENV").value("undefined");
    waku = await createLightNode();
    expect(consoleInfoSpy.callCount).to.be.equal(2);
  });

  [
    ["test", false],
    ["test", true],
    [undefined, true]
  ].map(([env, hideWebSocketInfo]) => {
    it(`should not log info about WebSocket failures to console when NODE_ENV=${env} and hideWebSocketInfo=${hideWebSocketInfo}`, async () => {
      sinon.stub(process.env, "NODE_ENV").value(env);
      waku = await createLightNode({
        libp2p: { hideWebSocketInfo: !!hideWebSocketInfo }
      });
      expect(consoleInfoSpy.callCount).to.be.equal(0);
    });
  });
});
