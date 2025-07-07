export class BytesUtils {
  /**
   * Switches endianness of a byte array
   */
  public static switchEndianness(bytes: Uint8Array): Uint8Array {
    return new Uint8Array([...bytes].reverse());
  }

  /**
   * Builds a BigInt from a big-endian Uint8Array
   * @param bytes The big-endian bytes to convert
   * @returns The resulting BigInt in big-endian format
   */
  public static buildBigIntFromUint8ArrayBE(bytes: Uint8Array): bigint {
    let result = 0n;
    for (let i = 0; i < bytes.length; i++) {
      result = (result << 8n) + BigInt(bytes[i]);
    }
    return result;
  }

  /**
   * Switches endianness of a bigint value
   * @param value The bigint value to switch endianness for
   * @returns The bigint value with reversed endianness
   */
  public static switchEndiannessBigInt(value: bigint): bigint {
    // Convert bigint to byte array
    const bytes = [];
    let tempValue = value;
    while (tempValue > 0n) {
      bytes.push(Number(tempValue & 0xffn));
      tempValue >>= 8n;
    }

    // Reverse bytes and convert back to bigint
    return bytes
      .reverse()
      .reduce((acc, byte) => (acc << 8n) + BigInt(byte), 0n);
  }

  /**
   * Converts a big-endian bigint to a 32-byte big-endian Uint8Array
   * @param value The big-endian bigint to convert
   * @returns A 32-byte big-endian Uint8Array
   */
  public static bigIntToUint8Array32BE(value: bigint): Uint8Array {
    const bytes = new Uint8Array(32);
    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(value & 0xffn);
      value >>= 8n;
    }
    return bytes;
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

  /**
   * Fills with zeros to set length
   * @param array little endian Uint8Array
   * @param length amount to pad
   * @returns little endian Uint8Array padded with zeros to set length
   */
  public static zeroPadLE(array: Uint8Array, length: number): Uint8Array {
    const result = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      result[i] = array[i] || 0;
    }
    return result;
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
}
