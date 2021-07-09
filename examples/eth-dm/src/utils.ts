export function byteArrayToHex(bytes: Uint8Array): string {
  const buf = new Buffer(bytes);
  return buf.toString('hex');
}

export function hexToBuf(str: string): Buffer {
  return Buffer.from(str.replace(/0x/, ''), 'hex');
}

export function equalByteArrays(
  a: Uint8Array | Buffer | string,
  b: Uint8Array | Buffer | string
): boolean {
  let aBuf: Buffer;
  let bBuf: Buffer;
  if (typeof a === 'string') {
    aBuf = hexToBuf(a);
  } else {
    aBuf = Buffer.from(a);
  }

  if (typeof b === 'string') {
    bBuf = hexToBuf(b);
  } else {
    bBuf = Buffer.from(b);
  }

  return aBuf.compare(bBuf) === 0;
}
