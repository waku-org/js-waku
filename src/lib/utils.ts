export function hexToBuf(str: string): Buffer {
  return Buffer.from(str.replace(/0x/i, ''), 'hex');
}
