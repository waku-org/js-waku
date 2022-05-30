import { expect } from "chai";

import { fleets } from "./predefined";
import { getPseudoRandomSubset } from "./random_subset";

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
    if (process.env.CI || window?.__env__?.CI) {
      this.skip();
    }
  });

  it("Check pre-defined nodes against hosted JSON [live data]", async function () {
    const res = await fetch("https://fleets.status.im/");
    const nodes = await res.json();

    expect(fleets.fleets["wakuv2.prod"]["waku-websocket"]).to.deep.eq(
      nodes.fleets["wakuv2.prod"]["waku-websocket"]
    );
    expect(fleets.fleets["wakuv2.test"]["waku-websocket"]).to.deep.eq(
      nodes.fleets["wakuv2.test"]["waku-websocket"]
    );
  });
});
