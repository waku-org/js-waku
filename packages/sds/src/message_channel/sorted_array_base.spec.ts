import { expect } from "chai";

import { SortedArrayBase } from "./sorted_array_base.js";

// Test implementation that sorts numbers in ascending order
class NumberSortedArray extends SortedArrayBase<number> {
  protected getCompareFn(): (a: number, b: number) => number {
    return (a, b) => a - b;
  }
}

// Test implementation that sorts strings alphabetically
class StringSortedArray extends SortedArrayBase<string> {
  protected getCompareFn(): (a: string, b: string) => number {
    return (a, b) => a.localeCompare(b);
  }
}

describe("SortedArrayBase", () => {
  let numberArray: NumberSortedArray;
  let stringArray: StringSortedArray;

  beforeEach(() => {
    numberArray = new NumberSortedArray();
    stringArray = new StringSortedArray();
  });

  describe("Basic Operations", () => {
    it("should start empty", () => {
      expect(numberArray.length).to.equal(0);
      expect(stringArray.length).to.equal(0);
    });

    it("should maintain sorted order after push", () => {
      numberArray.push(3, 1, 4, 1, 5);
      expect([...numberArray]).to.deep.equal([1, 3, 4, 5]);
    });

    it("should maintain sorted order after unshift", () => {
      numberArray.push(3, 5);
      numberArray.unshift(1, 4);
      expect([...numberArray]).to.deep.equal([1, 3, 4, 5]);
    });

    it("should maintain sorted order after splice", () => {
      numberArray.push(1, 3, 5);
      numberArray.splice(1, 1, 2, 4);
      expect([...numberArray]).to.deep.equal([1, 2, 4, 5]);
    });

    it("should maintain sorted order after fill", () => {
      numberArray.push(1, 2, 3, 4, 5);
      numberArray.fill(10, 1, 3);
      expect([...numberArray]).to.deep.equal([1, 4, 5, 10]);
    });

    it("should maintain sorted order after copyWithin", () => {
      numberArray.push(1, 2, 3, 4, 5);
      numberArray.copyWithin(0, 3, 5);
      expect([...numberArray]).to.deep.equal([3, 4, 4, 5, 5]);
    });
  });

  describe("Array Methods", () => {
    beforeEach(() => {
      numberArray.push(5, 2, 8, 1, 9);
      stringArray.push("zebra", "apple", "banana");
    });

    it("should pop last element", () => {
      const popped = numberArray.pop();
      expect(popped).to.equal(9);
      expect([...numberArray]).to.deep.equal([1, 2, 5, 8]);
    });

    it("should shift first element", () => {
      const shifted = numberArray.shift();
      expect(shifted).to.equal(1);
      expect([...numberArray]).to.deep.equal([2, 5, 8, 9]);
    });

    it("should slice correctly", () => {
      const sliced = numberArray.slice(1, 3);
      expect(sliced).to.deep.equal([2, 5]);
      expect([...numberArray]).to.deep.equal([1, 2, 5, 8, 9]); // Original unchanged
    });

    it("should concat and return sorted array", () => {
      const result = numberArray.concat([3, 7]);
      expect(result).to.deep.equal([1, 2, 3, 5, 7, 8, 9]);
      expect([...numberArray]).to.deep.equal([1, 2, 5, 8, 9]); // Original unchanged
    });

    it("should join elements", () => {
      expect(numberArray.join(",")).to.equal("1,2,5,8,9");
      expect(stringArray.join(" | ")).to.equal("apple | banana | zebra");
    });

    it("should convert to string", () => {
      expect(numberArray.toString()).to.equal("1,2,5,8,9");
    });

    it("should convert to locale string", () => {
      expect(numberArray.toLocaleString()).to.be.a("string");
    });
  });

  describe("Search Methods", () => {
    beforeEach(() => {
      numberArray.push(1, 2, 3, 4, 5);
    });

    it("should find indexOf correctly", () => {
      expect(numberArray.indexOf(2)).to.equal(1);
      expect(numberArray.indexOf(6)).to.equal(-1);
    });

    it("should find indexOf with fromIndex", () => {
      expect(numberArray.indexOf(4, 2)).to.equal(3);
    });

    it("should find lastIndexOf correctly", () => {
      expect(numberArray.lastIndexOf(3)).to.equal(2);
      expect(numberArray.lastIndexOf(6)).to.equal(-1);
    });

    it("should find lastIndexOf with fromIndex", () => {
      expect(numberArray.lastIndexOf(3, 1)).to.equal(-1);
    });

    it("should check includes correctly", () => {
      expect(numberArray.includes(3)).to.be.true;
      expect(numberArray.includes(6)).to.be.false;
    });

    it("should check includes with fromIndex", () => {
      expect(numberArray.includes(4, 2)).to.be.true;
      expect(numberArray.includes(2, 3)).to.be.false;
    });

    it("should access elements with at()", () => {
      expect(numberArray.at(0)).to.equal(1);
      expect(numberArray.at(-1)).to.equal(5);
      expect(numberArray.at(10)).to.be.undefined;
    });
  });

  describe("Higher-Order Methods", () => {
    beforeEach(() => {
      numberArray.push(1, 2, 3, 4, 5);
    });

    it("should map correctly", () => {
      const doubled = numberArray.map((x) => x * 2);
      expect(doubled).to.deep.equal([2, 4, 6, 8, 10]);
    });

    it("should filter correctly", () => {
      const evens = (numberArray as any).filter((x: number) => x % 2 === 0);
      expect(evens).to.deep.equal([2, 4]);
    });

    it("should reduce correctly", () => {
      const sum = numberArray.reduce((acc, val) => acc + val, 0);
      expect(sum).to.equal(15);
    });

    it("should reduce without initial value", () => {
      const sum = numberArray.reduce((acc: number, val: number) => acc + val);
      expect(sum).to.equal(15);
    });

    it("should reduceRight correctly", () => {
      const result = numberArray.reduceRight(
        (acc, val) => acc + val.toString(),
        ""
      );
      expect(result).to.equal("54321");
    });

    it("should find element", () => {
      const found = (numberArray as any).find((x: number) => x > 3);
      expect(found).to.equal(4);
    });

    it("should find element index", () => {
      const index = numberArray.findIndex((x) => x > 3);
      expect(index).to.equal(3);
    });

    it("should check every condition", () => {
      expect((numberArray as any).every((x: number) => x > 0)).to.be.true;
      expect((numberArray as any).every((x: number) => x > 2)).to.be.false;
    });

    it("should check some condition", () => {
      expect(numberArray.some((x) => x > 4)).to.be.true;
      expect(numberArray.some((x) => x > 10)).to.be.false;
    });

    it("should forEach correctly", () => {
      const results: number[] = [];
      numberArray.forEach((x) => results.push(x * 2));
      expect(results).to.deep.equal([2, 4, 6, 8, 10]);
    });

    it("should flatMap correctly", () => {
      const result = numberArray.flatMap((x) => [x, x * 2]);
      expect(result).to.deep.equal([1, 2, 2, 4, 3, 6, 4, 8, 5, 10]);
    });
  });

  describe("Iteration", () => {
    beforeEach(() => {
      numberArray.push(3, 1, 2);
    });

    it("should iterate with for...of", () => {
      const result: number[] = [];
      for (const item of numberArray) {
        result.push(item);
      }
      expect(result).to.deep.equal([1, 2, 3]);
    });

    it("should iterate with entries()", () => {
      const entries = [...numberArray.entries()];
      expect(entries).to.deep.equal([
        [0, 1],
        [1, 2],
        [2, 3]
      ]);
    });

    it("should iterate with keys()", () => {
      const keys = [...numberArray.keys()];
      expect(keys).to.deep.equal([0, 1, 2]);
    });

    it("should iterate with values()", () => {
      const values = [...numberArray.values()];
      expect(values).to.deep.equal([1, 2, 3]);
    });
  });

  describe("String Sorting", () => {
    it("should sort strings alphabetically", () => {
      stringArray.push("zebra", "apple", "banana", "cherry");
      expect([...stringArray]).to.deep.equal([
        "apple",
        "banana",
        "cherry",
        "zebra"
      ]);
    });

    it("should maintain string sort order after operations", () => {
      stringArray.push("zebra", "apple");
      stringArray.unshift("banana");
      stringArray.splice(1, 0, "cherry");
      expect([...stringArray]).to.deep.equal([
        "apple",
        "banana",
        "cherry",
        "zebra"
      ]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty array operations", () => {
      expect(numberArray.pop()).to.be.undefined;
      expect(numberArray.shift()).to.be.undefined;
      expect(numberArray.indexOf(1)).to.equal(-1);
      expect(numberArray.includes(1)).to.be.false;
    });

    it("should handle single element", () => {
      numberArray.push(42);
      expect([...numberArray]).to.deep.equal([42]);
      expect(numberArray.indexOf(42)).to.equal(0);
      expect(numberArray.includes(42)).to.be.true;
    });

    it("should prevent duplicate elements", () => {
      numberArray.push(1, 2, 1, 3, 2);
      expect([...numberArray]).to.deep.equal([1, 2, 3]);
      expect(numberArray.length).to.equal(3);
    });

    it("should handle splice with no items to add", () => {
      numberArray.push(1, 2, 3, 4, 5);
      const removed = numberArray.splice(2, 2);
      expect(removed).to.deep.equal([3, 4]);
      expect([...numberArray]).to.deep.equal([1, 2, 5]);
    });

    it("should handle splice at beginning", () => {
      numberArray.push(1, 2, 3);
      numberArray.splice(0, 0, 0);
      expect([...numberArray]).to.deep.equal([0, 1, 2, 3]);
    });

    it("should handle splice at end", () => {
      numberArray.push(1, 2, 3);
      numberArray.splice(3, 0, 4);
      expect([...numberArray]).to.deep.equal([1, 2, 3, 4]);
    });
  });

  describe("Array Interface Compliance", () => {
    it("should have correct length property", () => {
      expect(numberArray.length).to.equal(0);
      numberArray.push(1, 2, 3);
      expect(numberArray.length).to.equal(3);
    });

    it("should support bracket notation access", () => {
      numberArray.push(3, 1, 2);
      expect(numberArray[0]).to.equal(1);
      expect(numberArray[1]).to.equal(2);
      expect(numberArray[2]).to.equal(3);
    });

    it("should have Symbol.unscopables", () => {
      expect(numberArray[Symbol.unscopables]).to.be.an("object");
    });

    it("should be iterable", () => {
      numberArray.push(3, 1, 2);
      expect(numberArray[Symbol.iterator]).to.be.a("function");
      const iterator = numberArray[Symbol.iterator]();
      expect(iterator.next().value).to.equal(1);
    });
  });
});
