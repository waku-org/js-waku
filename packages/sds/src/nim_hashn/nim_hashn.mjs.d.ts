/**
 * Get the nth hash using the double hashing technique from:
 * http://www.eecs.harvard.edu/~kirsch/pubs/bbbf/rsa.pdf
 *
 * Based on https://github.com/waku-org/nim-sds/blob/5df71ad3eaf68172cef39a2e1838ddd871b03b5d/src/bloom.nim#L17
 *
 * @param item - The string to hash.
 * @param n - The number of times to hash the string.
 * @param maxValue - The maximum value to hash the string to.
 */
export function hashN(item: string, n: number, maxValue: number): number;
