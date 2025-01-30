// This file contains the probability tables used to determine the optimal number of
// hash functions (k) and bits per element (m/n) for a Bloom filter.
//
// These are used to determine how to construct a Bloom filter that can perform
// lookups with false-positive rate low enough to be satisfactory.

/**
 * Represents the error rates for a given number of hash functions (k) across
 * different (m/n) ratios (i.e., bits per element).
 */
type TErrorForK = Float32Array;

/**
 * An array where each index corresponds to a value of k (the number of hash functions),
 * and each element is a vector of false-positive rates for varying bits-per-element ratios.
 * Example:
 * ```ts
 * // Probability of a false positive upon lookup when using 1 hash function (k=1)
 * // and 15 bits per element (mOverN=15):
 * const falsePositiveRate = kErrors[1][15];
 * ```
 */
type TAllErrorRates = Array<TErrorForK>;

/**
 * Table of false positive rates for values of k from 0 to 12, and bits-per-element
 * ratios ranging from 0 up to around 32. Each Float32Array is indexed by mOverN,
 * so kErrors[k][mOverN] gives the estimated false-positive probability.
 *
 * These values mirror commonly used reference data found in Bloom filter literature,
 * such as:
 * https://pages.cs.wisc.edu/~cao/papers/summary-cache/node8.html
 * https://dl.acm.org/doi/pdf/10.1145/362686.362692
 */
// prettier-ignore
export const kErrors: TAllErrorRates = [
  new Float32Array([1.0]),
  new Float32Array([1.0, 1.0, 0.3930000000, 0.2830000000, 0.2210000000, 0.1810000000,
      0.1540000000, 0.1330000000, 0.1180000000, 0.1050000000, 0.0952000000,
      0.0869000000, 0.0800000000, 0.0740000000, 0.0689000000, 0.0645000000,
      0.0606000000, 0.0571000000, 0.0540000000, 0.0513000000, 0.0488000000,
      0.0465000000, 0.0444000000, 0.0425000000, 0.0408000000, 0.0392000000,
      0.0377000000, 0.0364000000, 0.0351000000, 0.0339000000, 0.0328000000,
      0.0317000000, 0.0308000000]),

  new Float32Array([1.0, 1.0, 0.4000000000, 0.2370000000, 0.1550000000, 0.1090000000,
      0.0804000000, 0.0618000000, 0.0489000000, 0.0397000000, 0.0329000000,
      0.0276000000, 0.0236000000, 0.0203000000, 0.0177000000, 0.0156000000,
      0.0138000000, 0.0123000000, 0.0111000000, 0.0099800000, 0.0090600000,
      0.0082500000, 0.0075500000, 0.0069400000, 0.0063900000, 0.0059100000,
      0.0054800000, 0.0051000000, 0.0047500000, 0.0044400000, 0.0041600000,
      0.0039000000, 0.0036700000]),

  new Float32Array([1.0, 1.0, 1.0, 0.2530000000, 0.1470000000, 0.0920000000,
      0.0609000000, 0.0423000000, 0.0306000000, 0.0228000000, 0.0174000000,
      0.0136000000, 0.0108000000, 0.0087500000, 0.0071800000, 0.0059600000,
      0.0108000000, 0.0087500000, 0.0071800000, 0.0059600000, 0.0050000000,
      0.0042300000, 0.0036200000, 0.0031200000, 0.0027000000, 0.0023600000,
      0.0020700000, 0.0018300000, 0.0016200000, 0.0014500000, 0.0012900000,
      0.0011600000, 0.0010500000, 0.0009490000, 0.0008620000, 0.0007850000,
      0.0007170000]),

  new Float32Array([1.0, 1.0, 1.0, 1.0, 0.1600000000, 0.0920000000, 0.0561000000, 0.0359000000,
      0.0240000000, 0.0166000000, 0.0118000000, 0.0086400000, 0.0064600000,
      0.0049200000, 0.0038100000, 0.0030000000, 0.0023900000, 0.0019300000,
      0.0015800000, 0.0013000000, 0.0010800000, 0.0009050000, 0.0007640000,
      0.0006490000, 0.0005550000, 0.0004780000, 0.0004130000, 0.0003590000,
      0.0003140000, 0.0002760000, 0.0002430000, 0.0002150000, 0.0001910000]),   

  new Float32Array([1.0, 1.0, 1.0, 1.0, 1.0, 0.1010000000, 0.0578000000, 0.0347000000,
      0.0217000000, 0.0141000000, 0.0094300000, 0.0065000000, 0.0045900000,
      0.0033200000, 0.0024400000, 0.0018300000, 0.0013900000, 0.0010700000,
      0.0008390000, 0.0006630000, 0.0005300000, 0.0004270000, 0.0003470000,
      0.0002850000, 0.0002350000, 0.0001960000, 0.0001640000, 0.0001380000,
      0.0001170000, 0.0000996000, 0.0000853000, 0.0000733000, 0.0000633000]),

  new Float32Array([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0638000000, 0.0364000000, 0.0216000000,
      0.0133000000, 0.0084400000, 0.0055200000, 0.0037100000, 0.0025500000,
      0.0017900000, 0.0012800000, 0.0009350000, 0.0006920000, 0.0005190000,
      0.0003940000, 0.0003030000, 0.0002360000, 0.0001850000, 0.0001470000,
      0.0001170000, 0.0000944000, 0.0000766000, 0.0000626000, 0.0000515000,
      0.0000426000, 0.0000355000, 0.0000297000, 0.0000250000]),

  new Float32Array([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0229000000, 0.0135000000, 0.0081900000,
      0.0051300000, 0.0032900000, 0.0021700000, 0.0014600000, 0.0010000000,
      0.0007020000, 0.0004990000, 0.0003600000, 0.0002640000, 0.0001960000,
      0.0001470000, 0.0001120000, 0.0000856000, 0.0000663000, 0.0000518000,
      0.0000408000, 0.0000324000, 0.0000259000, 0.0000209000, 0.0000169000,
      0.0000138000, 0.0000113000]),

  new Float32Array([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
      1.0, 0.0145000000, 0.0084600000, 0.0050900000, 0.0031400000, 0.0019900000,
      0.0012900000, 0.0008520000, 0.0005740000, 0.0003940000, 0.0002750000,
      0.0001940000, 0.0001400000, 0.0001010000, 0.0000746000, 0.0000555000,
      0.0000417000, 0.0000316000, 0.0000242000, 0.0000187000, 0.0000146000,
      0.0000114000, 0.0000090100, 0.0000071600, 0.0000057300]),

  new Float32Array([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0053100000, 0.0031700000,
      0.0019400000, 0.0012100000, 0.0007750000, 0.0005050000, 0.0003350000,
      0.0002260000, 0.0001550000, 0.0001080000, 0.0000759000, 0.0000542000,
      0.0000392000, 0.0000286000, 0.0000211000, 0.0000157000, 0.0000118000,
      0.0000089600, 0.0000068500, 0.0000052800, 0.0000041000, 0.0000032000]),

  new Float32Array([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.0033400000,
      0.0019800000, 0.0012000000, 0.0007440000, 0.0004700000, 0.0003020000,
      0.0001980000, 0.0001320000, 0.0000889000, 0.0000609000, 0.0000423000,
      0.0000297000, 0.0000211000, 0.0000152000, 0.0000110000, 0.0000080700,
      0.0000059700, 0.0000044500, 0.0000033500, 0.0000025400, 0.0000019400]),

  new Float32Array([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
      0.0021000000, 0.0012400000, 0.0007470000, 0.0004590000, 0.0002870000,
      0.0001830000, 0.0001180000, 0.0000777000, 0.0000518000, 0.0000350000,
      0.0000240000, 0.0000166000, 0.0000116000, 0.0000082300, 0.0000058900,
      0.0000042500, 0.0000031000, 0.0000022800, 0.0000016900, 0.0000012600]),   

  new Float32Array([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
      0.0007780000, 0.0004660000, 0.0002840000, 0.0001760000, 0.0001110000,
      0.0000712000, 0.0000463000, 0.0000305000, 0.0000204000, 0.0000138000,
      0.0000094200, 0.0000065200, 0.0000045600, 0.0000032200, 0.0000022900,
      0.0000016500, 0.0000012000, 0.0000008740]),
]

/**
 * Given a number of hash functions (k) and a target false-positive rate (targetError),
 * determines the minimum (m/n) bits-per-element that satisfies the error threshold.
 *
 * In the context of a Bloom filter:
 * - m is the total number of bits in the filter.
 * - n is the number of elements you expect to insert.
 * Thus, (m/n) describes how many bits are assigned per inserted element.
 *
 * Example:
 * ```ts
 * // We want to use 3 hash functions (k=3) and a false-positive rate of 1% (targetError=0.01).
 * const mOverN = getMOverNBitsForK(3, 0.01);
 * // The function will iterate through the error tables and find the smallest m/n that satisfies the error threshold.
 * // In this case, kErrors[3][5] is the first value in the vector kErrors[3] that is less than 0.01 (0.0920000000).
 * console.log(mOverN); // 5
 * ```
 *
 * @param k - The number of hash functions.
 * @param targetError - The desired maximum false-positive rate.
 * @param probabilityTable - An optional table of false-positive probabilities indexed by k.
 * @returns The smallest (m/n) bit ratio for which the false-positive rate is below targetError.
 * @throws If k is out of range or if no suitable ratio can be found.
 */
export function getMOverNBitsForK(
  k: number,
  targetError: number,
  probabilityTable = kErrors
): number {
  // Returns the optimal number of m/n bits for a given k.
  if (k < 0 || k > 12) {
    throw new Error("k must be <= 12.");
  }

  for (let mOverN = 2; mOverN < probabilityTable[k].length; mOverN++) {
    if (probabilityTable[k][mOverN] < targetError) {
      return mOverN;
    }
  }

  throw new Error(
    "Specified value of k and error rate not achievable using less than 4 bytes / element."
  );
}
