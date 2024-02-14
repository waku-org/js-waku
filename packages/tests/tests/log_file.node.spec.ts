import { expect } from "chai";

import { beforeEachCustom, makeLogFileName } from "../src/index.js";

describe("This", function () {
  describe("Is", function () {
    it("A test", function () {
      expect(makeLogFileName(this.ctx)).to.equal("This_Is_A_test");
    });
  });

  describe("Is also", function () {
    let testName: string;
    beforeEachCustom(this, async () => {
      testName = makeLogFileName(this.ctx);
    });
    it("A test", function () {
      expect(testName).to.equal("This_Is_also_A_test");
    });
  });
});
