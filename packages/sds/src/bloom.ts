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

/**
 * A probabilistic data structure that tracks memberships in a set.
 * Supports time and space efficient lookups, but may return false-positives.
 * Can never return false-negatives.
 * A bloom filter can tell us if an element is:
 * - Definitely not in the set
 * - Potentially in the set (with a probability depending on the false-positive rate)
 */
export abstract class BloomFilter {
  public totalBits: number;
  public data: Uint8Array = new Uint8Array(0);

  public constructor(options: BloomFilterOptions) {
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
    const mInts = 1 + mBits / (this.data.BYTES_PER_ELEMENT * 8);

    this.totalBits = mBits;
    this.data = new Uint8Array(mInts);
  }

  // Adds an item to the bloom filter by computing its hash values
  // and setting corresponding bits in "data".
  public abstract insert(item: string | Uint8Array): void;

  // Checks if the item is potentially in the bloom filter.
  // The method is guaranteed to return "true" for items that were inserted,
  // but might also return "true" for items that were never inserted
  // (purpose of false-positive probability).
  public abstract lookup(item: string | Uint8Array): boolean;
}
