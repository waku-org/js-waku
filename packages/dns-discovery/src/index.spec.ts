import { getPseudoRandomSubset } from "@waku/utils";
import { expect } from "chai";

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
