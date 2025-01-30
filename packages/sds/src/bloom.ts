import { getMOverNBitsForK } from "./probabilities.js";

export interface BloomFilterOptions {
  // The expected maximum number of elements for which this BloomFilter is sized.
  capacity: number;

  // The desired false-positive rate (between 0 and 1).
  errorRate: number;

  // (Optional) The exact number of hash functions, if the user wants to override the automatic calculation.
  kHashes?: number;

  // (Optional) Force a specific number of bits per element instead of using a table or optimal formula.
  forceNBitsPerElem?: number;
}

const sizeOfInt = 8;

/**
 * A probabilistic data structure that tracks memberships in a set.
 * Supports time and space efficient lookups, but may return false-positives.
 * Can never return false-negatives.
 * A bloom filter can tell us if an element is:
 * - Definitely not in the set
 * - Potentially in the set (with a probability depending on the false-positive rate)
 */
export class BloomFilter {
  public totalBits: number;
  public data: Array<bigint> = [];
  public kHashes: number;
  public errorRate: number;

  private hashN: (item: string, n: number, maxValue: number) => number;
  public constructor(
    options: BloomFilterOptions,
    hashN: (item: string, n: number, maxValue: number) => number
  ) {
    let nBitsPerElem: number;
    let k = options.kHashes ?? 0;
    const forceNBitsPerElem = options.forceNBitsPerElem ?? 0;

    if (k < 1) {
      // Calculate optimal k based on target error rate
      const bitsPerElem = Math.ceil(
        -1.0 * (Math.log(options.errorRate) / Math.pow(Math.log(2), 2))
      );
      k = Math.round(Math.log(2) * bitsPerElem);
      nBitsPerElem = Math.round(bitsPerElem);
    } else {
      // Use specified k if possible
      if (forceNBitsPerElem < 1) {
        // Use lookup table
        nBitsPerElem = getMOverNBitsForK(k, options.errorRate);
      } else {
        nBitsPerElem = forceNBitsPerElem;
      }
    }

    const mBits = options.capacity * nBitsPerElem;
    const mInts = 1 + Math.floor(mBits / (sizeOfInt * 8));

    this.totalBits = mBits;
    this.data = new Array<bigint>(mInts);
    this.data.fill(BigInt(0));
    this.kHashes = k;
    this.hashN = hashN;
    this.errorRate = options.errorRate;
  }

  public computeHashes(item: string): number[] {
    const hashes = new Array<number>(this.kHashes);
    for (let i = 0; i < this.kHashes; i++) {
      hashes[i] = this.hashN(item, i, this.totalBits);
    }
    return hashes;
  }

  // Adds an item to the bloom filter by computing its hash values
  // and setting corresponding bits in "data".
  public insert(item: string): void {
    const hashSet = this.computeHashes(item);
    for (const h of hashSet) {
      const intAddress = Math.floor(h / (sizeOfInt * 8));
      const bitOffset = h % (sizeOfInt * 8);
      this.data[intAddress] =
        this.data[intAddress] | (BigInt(1) << BigInt(bitOffset));
    }
  }

  // Checks if the item is potentially in the bloom filter.
  // The method is guaranteed to return "true" for items that were inserted,
  // but might also return "true" for items that were never inserted
  // (purpose of false-positive probability).
  public lookup(item: string): boolean {
    const hashSet = this.computeHashes(item);
    for (const h of hashSet) {
      const intAddress = Math.floor(h / (sizeOfInt * 8));
      const bitOffset = h % (sizeOfInt * 8);
      const currentInt = this.data[intAddress];
      if (currentInt != (currentInt | (BigInt(1) << BigInt(bitOffset)))) {
        return false;
      }
    }
    return true;
  }
}
