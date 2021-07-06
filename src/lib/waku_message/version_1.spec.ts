import { expect } from 'chai';
import fc from 'fast-check';

import {
  clearDecode,
  clearEncode,
  decryptAsymmetric,
  encryptAsymmetric,
  getPublicKey,
} from './version_1';

describe('Waku Message Version 1', function () {
  it('Sign & Recover', function () {
    fc.assert(
      fc.property(
        fc.uint8Array(),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        (message, privKey) => {
          const enc = clearEncode(message, privKey);
          const res = clearDecode(enc);

          const pubKey = getPublicKey(privKey);

          expect(res?.payload).deep.equal(message);
          expect(res?.sig?.publicKey).deep.equal(pubKey);
        }
      )
    );
  });

  it('Asymmetric encrypt & Decrypt', async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 2 }),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        async (message, privKey) => {
          const publicKey = getPublicKey(privKey);

          const enc = await encryptAsymmetric(message, publicKey);
          const res = await decryptAsymmetric(enc, privKey);

          expect(res).deep.equal(message);
        }
      )
    );
  });
});
