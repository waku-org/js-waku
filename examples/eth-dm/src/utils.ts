export function byteArrayToHex(bytes: Uint8Array): string {
  const buf = new Buffer(bytes);
  return buf.toString('hex');
}

export function hexToBuf(str: string): Buffer {
  return Buffer.from(str.replace(/0x/, ''), 'hex');
}
