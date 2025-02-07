import { expect } from "chai";

import {
  getMOverNBitsForK,
  KTooLargeError,
  NoSuitableRatioError
} from "./probabilities.js";

describe("Probabilities", () => {
  it("should not allow k > 12", () => {
    expect(() => getMOverNBitsForK(13, 0.01)).to.throw(KTooLargeError);
  });

  it("should not allow unachievable error rate", () => {
    expect(() => getMOverNBitsForK(2, 0.00001)).to.throw(NoSuitableRatioError);
  });

  it("should return the correct m/n for k = 2, targetError = 0.1", () => {
    expect(getMOverNBitsForK(2, 0.1)).to.equal(6);
  });

  it("should return the correct m/n for k = 7, targetError = 0.01", () => {
    expect(getMOverNBitsForK(7, 0.01)).to.equal(10);
  });

  it("should return the correct m/n for k = 7, targetError = 0.001", () => {
    expect(getMOverNBitsForK(7, 0.001)).to.equal(16);
  });
});
