export const SymmetricKeySize = 32;
export const IvSize = 12;
export const TagSize = 16;

export interface Symmetric {
  encrypt: (iv: Buffer, key: Buffer, clearText: Buffer) => Buffer;
  decrypt: (iv: Buffer, tag: Buffer, key: Buffer, cipherText: Buffer) => Buffer;
  generateKeyForSymmetricEnc: () => Buffer;
  generateIv: () => Buffer;
}

export let symmetric: Symmetric = {} as unknown as Symmetric;

import('./browser')
  .then((mod) => {
    symmetric = mod as unknown as Symmetric;
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
