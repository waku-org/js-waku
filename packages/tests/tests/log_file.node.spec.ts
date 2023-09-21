import { expect } from "chai";

import { makeLogFileName } from "../src/index";

describe("This", function () {
  describe("Is", function () {
    it("A test", function () {
      expect(makeLogFileName(this)).to.equal("This_Is_A_test");
    });
  });

  describe("Is also", function () {
    let testName: string;
    beforeEach(function () {
      testName = makeLogFileName(this);
    });
    it("A test", function () {
      expect(testName).to.equal("This_Is_also_A_test");
    });
  });
});
