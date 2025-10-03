export class BytesUtils {
  /**
   * Concatenate Uint8Arrays
   * @param input
   * @returns concatenation of all Uint8Array received as input
   */
  public static concatenate(...input: Uint8Array[]): Uint8Array {
    let totalLength = 0;
    for (const arr of input) {
      totalLength += arr.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of input) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }

  /**
   * Convert a Uint8Array to a BigInt with configurable input endianness
   * @param bytes - The byte array to convert
   * @param inputEndianness - Endianness of the input bytes ('big' or 'little')
   * @returns BigInt representation of the bytes
   */
  public static toBigInt(
    bytes: Uint8Array,
    inputEndianness: "big" | "little" = "little"
  ): bigint {
    if (bytes.length === 0) {
      return 0n;
    }

    // Create a copy to avoid modifying the original array
    const workingBytes = new Uint8Array(bytes);

    // Reverse bytes if input is little-endian to work with big-endian internally
    if (inputEndianness === "little") {
      workingBytes.reverse();
    }

    // Convert to BigInt
    let result = 0n;
    for (let i = 0; i < workingBytes.length; i++) {
      result = (result << 8n) | BigInt(workingBytes[i]);
    }

    return result;
  }

  /**
   * Writes an unsigned integer to a buffer in little-endian format
   */
  public static writeUIntLE(
    buf: Uint8Array,
    value: number,
    offset: number,
    byteLength: number,
    noAssert?: boolean
  ): Uint8Array {
    value = +value;
    offset = offset >>> 0;
    byteLength = byteLength >>> 0;
    if (!noAssert) {
      const maxBytes = Math.pow(2, 8 * byteLength) - 1;
      BytesUtils.checkInt(buf, value, offset, byteLength, maxBytes, 0);
    }

    let mul = 1;
    let i = 0;
    buf[offset] = value & 0xff;
    while (++i < byteLength && (mul *= 0x100)) {
      buf[offset + i] = (value / mul) & 0xff;
    }

    return buf;
  }

  // Adapted from https://github.com/feross/buffer
  public static checkInt(
    buf: Uint8Array,
    value: number,
    offset: number,
    ext: number,
    max: number,
    min: number
  ): void {
    if (value > max || value < min)
      throw new RangeError('"value" argument is out of bounds');
    if (offset + ext > buf.length) throw new RangeError("Index out of range");
  }
}
