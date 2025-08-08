import { expect } from "chai";

import { SortedArrayBase } from "./sorted_array_base.js";

// Test implementation that sorts strings alphabetically
class StringSortedArray extends SortedArrayBase<string> {
  protected getCompareFn(): (a: string, b: string) => number {
    return (a, b) => a.localeCompare(b);
  }
}

describe("SortedArrayBase", () => {
  let stringArray: StringSortedArray;

  beforeEach(() => {
    stringArray = new StringSortedArray();
  });

  describe("Basic Operations", () => {
    it("should start empty", () => {
      expect(stringArray.length).to.equal(0);
    });

    it("should maintain sorted order after push", () => {
      stringArray.push("c", "a", "d", "a", "e");
      expect([...stringArray]).to.deep.equal(["a", "c", "d", "e"]);
    });

    it("should maintain sorted order after unshift", () => {
      stringArray.push("c", "e");
      stringArray.unshift("a", "d");
      expect([...stringArray]).to.deep.equal(["a", "c", "d", "e"]);
    });

    it("should maintain sorted order after splice", () => {
      stringArray.push("a", "c", "e");
      stringArray.splice(1, 1, "b", "d");
      expect([...stringArray]).to.deep.equal(["a", "b", "d", "e"]);
    });

    it("should maintain sorted order after fill", () => {
      stringArray.push("a", "b", "c", "d", "e");
      stringArray.fill("z", 1, 3);
      expect([...stringArray]).to.deep.equal(["a", "d", "e", "z"]);
    });

    it("should maintain sorted order after copyWithin", () => {
      stringArray.push("a", "b", "c", "d", "e");
      stringArray.copyWithin(0, 3, 5);
      expect([...stringArray]).to.deep.equal(["c", "d", "d", "e", "e"]);
    });
  });

  describe("Array Methods", () => {
    beforeEach(() => {
      stringArray.push("zebra", "apple", "banana", "cherry", "dog");
    });

    it("should pop last element", () => {
      const popped = stringArray.pop();
      expect(popped).to.equal("zebra");
      expect([...stringArray]).to.deep.equal([
        "apple",
        "banana",
        "cherry",
        "dog"
      ]);
    });

    it("should shift first element", () => {
      const shifted = stringArray.shift();
      expect(shifted).to.equal("apple");
      expect([...stringArray]).to.deep.equal([
        "banana",
        "cherry",
        "dog",
        "zebra"
      ]);
    });

    it("should slice correctly", () => {
      const sliced = stringArray.slice(1, 3);
      expect(sliced).to.deep.equal(["banana", "cherry"]);
      expect([...stringArray]).to.deep.equal([
        "apple",
        "banana",
        "cherry",
        "dog",
        "zebra"
      ]); // Original unchanged
    });

    it("should concat and return sorted array", () => {
      const result = stringArray.concat(["cat", "elephant"]);
      expect(result).to.deep.equal([
        "apple",
        "banana",
        "cat",
        "cherry",
        "dog",
        "elephant",
        "zebra"
      ]);
      expect([...stringArray]).to.deep.equal([
        "apple",
        "banana",
        "cherry",
        "dog",
        "zebra"
      ]); // Original unchanged
    });

    it("should join elements", () => {
      expect(stringArray.join(" | ")).to.equal(
        "apple | banana | cherry | dog | zebra"
      );
    });

    it("should convert to string", () => {
      expect(stringArray.toString()).to.equal("apple,banana,cherry,dog,zebra");
    });

    it("should convert to locale string", () => {
      expect(stringArray.toLocaleString()).to.be.a("string");
    });
  });

  describe("Search Methods", () => {
    beforeEach(() => {
      stringArray.push("apple", "banana", "cherry", "dog", "elephant");
    });

    it("should find indexOf correctly", () => {
      expect(stringArray.indexOf("banana")).to.equal(1);
      expect(stringArray.indexOf("zebra")).to.equal(-1);
    });

    it("should find indexOf with fromIndex", () => {
      expect(stringArray.indexOf("dog", 2)).to.equal(3);
    });

    it("should find lastIndexOf correctly", () => {
      expect(stringArray.lastIndexOf("cherry")).to.equal(2);
      expect(stringArray.lastIndexOf("zebra")).to.equal(-1);
    });

    it("should find lastIndexOf with fromIndex", () => {
      expect(stringArray.lastIndexOf("cherry", 1)).to.equal(-1);
    });

    it("should check includes correctly", () => {
      expect(stringArray.includes("cherry")).to.be.true;
      expect(stringArray.includes("zebra")).to.be.false;
    });

    it("should check includes with fromIndex", () => {
      expect(stringArray.includes("dog", 2)).to.be.true;
      expect(stringArray.includes("banana", 3)).to.be.false;
    });

    it("should access elements with at()", () => {
      expect(stringArray.at(0)).to.equal("apple");
      expect(stringArray.at(-1)).to.equal("elephant");
      expect(stringArray.at(10)).to.be.undefined;
    });
  });

  describe("Higher-Order Methods", () => {
    beforeEach(() => {
      stringArray.push("apple", "banana", "cherry", "dog", "elephant");
    });

    it("should map correctly", () => {
      const uppercased = stringArray.map((x) => x.toUpperCase());
      expect(uppercased).to.deep.equal([
        "APPLE",
        "BANANA",
        "CHERRY",
        "DOG",
        "ELEPHANT"
      ]);
    });

    it("should filter correctly", () => {
      const longWords = (stringArray as any).filter(
        (x: string) => x.length > 5
      );
      expect(longWords).to.deep.equal(["banana", "cherry", "elephant"]);
    });

    it("should reduce correctly", () => {
      const concatenated = stringArray.reduce((acc, val) => acc + val, "");
      expect(concatenated).to.equal("applebananacherrydogelephant");
    });

    it("should reduce without initial value", () => {
      const concatenated = stringArray.reduce(
        (acc: string, val: string) => acc + val
      );
      expect(concatenated).to.equal("applebananacherrydogelephant");
    });

    it("should reduceRight correctly", () => {
      const result = stringArray.reduceRight((acc, val) => acc + val, "");
      expect(result).to.equal("elephantdogcherrybananaapple");
    });

    it("should find element", () => {
      const found = (stringArray as any).find((x: string) => x.startsWith("c"));
      expect(found).to.equal("cherry");
    });

    it("should find element index", () => {
      const index = stringArray.findIndex((x) => x.startsWith("c"));
      expect(index).to.equal(2);
    });

    it("should check every condition", () => {
      expect((stringArray as any).every((x: string) => x.length > 0)).to.be
        .true;
      expect((stringArray as any).every((x: string) => x.length > 5)).to.be
        .false;
    });

    it("should check some condition", () => {
      expect(stringArray.some((x) => x.length > 7)).to.be.true;
      expect(stringArray.some((x) => x.length > 10)).to.be.false;
    });

    it("should forEach correctly", () => {
      const results: string[] = [];
      stringArray.forEach((x) => results.push(x.toUpperCase()));
      expect(results).to.deep.equal([
        "APPLE",
        "BANANA",
        "CHERRY",
        "DOG",
        "ELEPHANT"
      ]);
    });

    it("should flatMap correctly", () => {
      const result = stringArray.flatMap((x) => [x, x.length]);
      expect(result).to.deep.equal([
        "apple",
        5,
        "banana",
        6,
        "cherry",
        6,
        "dog",
        3,
        "elephant",
        8
      ]);
    });
  });

  describe("Iteration", () => {
    beforeEach(() => {
      stringArray.push("cherry", "apple", "banana");
    });

    it("should iterate with for...of", () => {
      const result: string[] = [];
      for (const item of stringArray) {
        result.push(item);
      }
      expect(result).to.deep.equal(["apple", "banana", "cherry"]);
    });

    it("should iterate with entries()", () => {
      const entries = [...stringArray.entries()];
      expect(entries).to.deep.equal([
        [0, "apple"],
        [1, "banana"],
        [2, "cherry"]
      ]);
    });

    it("should iterate with keys()", () => {
      const keys = [...stringArray.keys()];
      expect(keys).to.deep.equal([0, 1, 2]);
    });

    it("should iterate with values()", () => {
      const values = [...stringArray.values()];
      expect(values).to.deep.equal(["apple", "banana", "cherry"]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty array operations", () => {
      expect(stringArray.pop()).to.be.undefined;
      expect(stringArray.shift()).to.be.undefined;
      expect(stringArray.indexOf("apple")).to.equal(-1);
      expect(stringArray.includes("apple")).to.be.false;
    });

    it("should handle single element", () => {
      stringArray.push("hello");
      expect([...stringArray]).to.deep.equal(["hello"]);
      expect(stringArray.indexOf("hello")).to.equal(0);
      expect(stringArray.includes("hello")).to.be.true;
    });

    it("should prevent duplicate elements", () => {
      stringArray.push("apple", "banana", "apple", "cherry", "banana");
      expect([...stringArray]).to.deep.equal(["apple", "banana", "cherry"]);
      expect(stringArray.length).to.equal(3);
    });

    it("should handle splice with no items to add", () => {
      stringArray.push("apple", "banana", "cherry", "dog", "elephant");
      const removed = stringArray.splice(2, 2);
      expect(removed).to.deep.equal(["cherry", "dog"]);
      expect([...stringArray]).to.deep.equal(["apple", "banana", "elephant"]);
    });

    it("should handle splice at beginning", () => {
      stringArray.push("banana", "cherry", "dog");
      stringArray.splice(0, 0, "apple");
      expect([...stringArray]).to.deep.equal([
        "apple",
        "banana",
        "cherry",
        "dog"
      ]);
    });

    it("should handle splice at end", () => {
      stringArray.push("apple", "banana", "cherry");
      stringArray.splice(3, 0, "dog");
      expect([...stringArray]).to.deep.equal([
        "apple",
        "banana",
        "cherry",
        "dog"
      ]);
    });
  });

  describe("Array Interface Compliance", () => {
    it("should have correct length property", () => {
      expect(stringArray.length).to.equal(0);
      stringArray.push("apple", "banana", "cherry");
      expect(stringArray.length).to.equal(3);
    });

    it("should support bracket notation access", () => {
      stringArray.push("cherry", "apple", "banana");
      expect(stringArray[0]).to.equal("apple");
      expect(stringArray[1]).to.equal("banana");
      expect(stringArray[2]).to.equal("cherry");
    });

    it("should have Symbol.unscopables", () => {
      expect(stringArray[Symbol.unscopables]).to.be.an("object");
    });

    it("should be iterable", () => {
      stringArray.push("cherry", "apple", "banana");
      expect(stringArray[Symbol.iterator]).to.be.a("function");
      const iterator = stringArray[Symbol.iterator]();
      expect(iterator.next().value).to.equal("apple");
    });
  });
});
