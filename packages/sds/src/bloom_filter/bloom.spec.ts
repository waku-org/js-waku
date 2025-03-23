import { expect } from "chai";

import { BloomFilter, DefaultBloomFilter } from "./bloom.js";

const n = 10000;
const sampleChars =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const specialPatterns = [
  "shortstr",
  "a".repeat(1000), // Very long string
  "special@#$%^&*()", // Special characters
  "unicode→★∑≈", // Unicode characters
  "pattern".repeat(10) // Repeating pattern
];

describe("BloomFilter", () => {
  let bloomFilter: BloomFilter;
  let testElements: string[];

  beforeEach(() => {
    bloomFilter = new DefaultBloomFilter({
      capacity: n,
      errorRate: 0.001
    });

    testElements = new Array<string>(n);

    for (let i = 0; i < n; i++) {
      let newString = "";
      for (let j = 0; j < 7; j++) {
        newString += sampleChars[Math.floor(Math.random() * 51)];
      }
      testElements[i] = newString;
    }

    for (const item of testElements) {
      bloomFilter.insert(item);
    }
    expect(bloomFilter.lookup("nonexistent")).to.equal(
      false,
      "look up for an element yet to be added should return false"
    );
    expect(bloomFilter.lookup(testElements[0])).to.equal(
      true,
      "look up for an element that was added should return true"
    );
  });

  it("should initialize bloom filter with correct parameters", () => {
    expect(bloomFilter.kHashes).to.equal(10);
    expect(bloomFilter.totalBits / n).to.equal(15);

    const bloomFilter2 = new DefaultBloomFilter({
      capacity: 10000,
      errorRate: 0.001,
      kHashes: 4,
      forceNBitsPerElem: 20
    });
    expect(bloomFilter2.kHashes).to.equal(4);
    expect(bloomFilter2.totalBits).to.equal(200000);
  });

  it("should insert elements correctly", () => {
    expect(bloomFilter.lookup("test string")).to.equal(
      false,
      "look up for an element yet to be added should return false"
    );
    bloomFilter.insert("test string");
    expect(bloomFilter.lookup("test string")).to.equal(
      true,
      "look up for an element that was added should return true"
    );
    expect(bloomFilter.lookup("different string")).to.equal(
      false,
      "look up for an element that was not added should return false"
    );
  });

  it("should maintain desired error rate", () => {
    let falsePositives = 0;
    const testSize = n / 2;
    for (let i = 0; i < testSize; i++) {
      let testString = "";
      for (let j = 0; j < 8; j++) {
        // Different length than setup
        testString += sampleChars[Math.floor(Math.random() * 51)];
      }
      if (bloomFilter.lookup(testString)) {
        falsePositives++;
      }
    }

    const actualErrorRate = falsePositives / testSize;
    expect(actualErrorRate).to.be.lessThan(bloomFilter.errorRate * 1.5);
  });

  it("should never report false negatives", () => {
    for (const item of testElements) {
      expect(bloomFilter.lookup(item)).to.equal(true);
    }
  });

  it("should serialize and deserialize correctly", () => {
    const serialized = bloomFilter.toBytes();
    const deserialized = DefaultBloomFilter.fromBytes(
      serialized,
      bloomFilter.options
    );
    for (const item of testElements) {
      expect(deserialized.lookup(item)).to.equal(true);
    }
  });
});

describe("BloomFilter with special patterns", () => {
  let bloomFilter: BloomFilter;
  const inserted: string[] = [];

  beforeEach(() => {
    bloomFilter = new DefaultBloomFilter({
      capacity: n,
      errorRate: 0.001
    });
  });

  it("should handle special patterns correctly", () => {
    for (const pattern of specialPatterns) {
      bloomFilter.insert(pattern);
      expect(bloomFilter.lookup(pattern)).to.equal(true);
    }
  });

  it("should handle general insertion and lookup correctly", () => {
    for (let i = 0; i < n; i++) {
      inserted[i] = `${i}test${Math.random().toString(36).substring(2, 15)}`;
      bloomFilter.insert(inserted[i]);
    }

    for (const item of inserted) {
      expect(bloomFilter.lookup(item)).to.equal(true);
    }
  });

  it("should check false positive rate", () => {
    const testSize = n / 2;
    let falsePositives = 0;
    for (let i = 0; i < testSize; i++) {
      const testItem = `notpresent${i}${Math.random().toString(36).substring(2, 15)}`;
      if (bloomFilter.lookup(testItem)) {
        falsePositives++;
      }
    }

    const fpRate = falsePositives / testSize;
    expect(fpRate).to.be.lessThan(bloomFilter.errorRate * 1.5);
  });
});
