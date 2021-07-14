import { expect } from 'chai';
import fc from 'fast-check';

import {
  clearDecode,
  clearEncode,
  decryptAsymmetric,
  decryptSymmetric,
  encryptAsymmetric,
  encryptSymmetric,
  getPublicKey,
} from '../../lib/waku_message/version_1';

describe('Waku Message Version 1', function () {
  it('Sign & Recover', function () {
    fc.assert(
      fc.property(
        fc.uint8Array(),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        (message, privKey) => {
          const enc = clearEncode(message, privKey);
          const res = clearDecode(enc.payload);

          const pubKey = getPublicKey(privKey);

          expect(res?.payload).deep.equal(
            message,
            'Payload was not encrypted then decrypted correctly'
          );
          expect(res?.sig?.publicKey).deep.equal(
            pubKey,
            'signature Public key was not recovered from encrypted then decrypted signature'
          );
          expect(enc?.sig?.publicKey).deep.equal(
            pubKey,
            'Incorrect signature public key was returned when signing the payload'
          );
        }
      )
    );
  });

  it('Asymmetric encrypt & Decrypt', async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
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

  it('Symmetric encrypt & Decrypt', async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array(),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        async (message, key) => {
          const enc = await encryptSymmetric(message, key);
          const res = await decryptSymmetric(enc, key);

          expect(res).deep.equal(message);
        }
      )
    );
  });
});
