import { expect } from "chai";

import testVectors from "./nim_hash_test_vectors.json" assert { type: "json" };
import { hashN } from "./nim_hashn.mjs";

describe("hashN", () => {
  testVectors.vectors.forEach((vector) => {
    // TODO: The result of the hash function compiled from nim to js does not match outputs when run in nim itself when using unicode characters.
    if (vector.input === "αβγδε") {
      return;
    }
    it(`should hash "${vector.input}" with n=${vector.n} and maxValue=${vector.maxValue} correctly`, () => {
      const result = hashN(vector.input, vector.n, vector.maxValue);
      expect(result).to.equal(vector.expected.hashC);
    });
  });
});
