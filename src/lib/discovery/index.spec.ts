import { expect } from "chai";

import { getNodesFromHostedJson, getPseudoRandomSubset } from "./index";

declare global {
  interface Window {
    __env__?: any;
  }
}
declare let window: Window | undefined;

describe("Discovery", () => {
  it("returns all values when wanted number matches available values", function () {
    const values = ["a", "b", "c"];

    const res = getPseudoRandomSubset(values, 3);

    expect(res.length).to.eq(3);
    expect(res.includes("a")).to.be.true;
    expect(res.includes("b")).to.be.true;
    expect(res.includes("c")).to.be.true;
  });

  it("returns all values when wanted number is greater than available values", function () {
    const values = ["a", "b", "c"];

    const res = getPseudoRandomSubset(values, 5);

    expect(res.length).to.eq(3);
    expect(res.includes("a")).to.be.true;
    expect(res.includes("b")).to.be.true;
    expect(res.includes("c")).to.be.true;
  });

  it("returns a subset of values when wanted number is lesser than available values", function () {
    const values = ["a", "b", "c"];

    const res = getPseudoRandomSubset(values, 2);

    expect(res.length).to.eq(2);
  });
});

describe("Discovery [live data]", function () {
  before(function () {
    if (
      process.env.CI ||
      (typeof window !== "undefined" && window?.__env__?.CI)
    ) {
      this.skip();
    }
  });

  it("Returns nodes from default hosted JSON [live data]", async function () {
    const res = await getNodesFromHostedJson(
      ["fleets", "wakuv2.prod", "waku-websocket"],
      "https://fleets.status.im/",
      3
    );

    expect(res.length).to.eq(3);
    expect(res[0].toString()).to.not.be.undefined;
  });
});
