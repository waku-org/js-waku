export const SymmetricKeySize = 32;
export const IvSize = 12;
export const TagSize = 16;

export interface Symmetric {
  /**
   * Proceed with symmetric encryption of `clearText` value.
   */
  encrypt: (
    iv: Buffer | Uint8Array,
    key: Buffer,
    clearText: Buffer
  ) => Promise<Buffer>;
  /**
   * Proceed with symmetric decryption of `cipherText` value.
   */
  decrypt: (iv: Buffer, key: Buffer, cipherText: Buffer) => Promise<Buffer>;
  /**
   * Generate an Initialization Vector (iv) for for Symmetric encryption purposes.
   */
  generateIv: () => Uint8Array;
}

export let symmetric: Symmetric = {} as unknown as Symmetric;

import('./browser')
  .then((mod) => {
    symmetric = mod;
  })
  .catch((eBrowser) => {
    import('./node')
      .then((mod) => {
        symmetric = mod;
      })
      .catch((eNode) => {
        throw `Could not load any symmetric crypto modules: ${eBrowser}, ${eNode}`;
      });
  });
