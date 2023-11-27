import { createLightNode, LightNode } from "@waku/sdk";
import { expect } from "chai";
import sinon, { SinonSpy } from "sinon";

import { tearDownNodes } from "../src/index.js";

describe("Craete node", () => {
  let waku: LightNode;
  let consoleInfoSpy: SinonSpy;

  beforeEach(() => {
    consoleInfoSpy = sinon.spy(console as any, "info");
  });

  afterEach(async () => {
    consoleInfoSpy.restore();
    await tearDownNodes([], waku);
  });

  it("should log info about WebSocket failures to console when hideWebSocketInfo disabled", async () => {
    waku = await createLightNode();
    expect(consoleInfoSpy.callCount).to.be.equal(2);
  });

  it("should not log info about WebSocket failures to console when hideWebSocketInfo enabled", async () => {
    waku = await createLightNode({
      libp2p: { hideWebSocketInfo: true }
    });
    expect(consoleInfoSpy.callCount).to.be.equal(0);
  });
});
