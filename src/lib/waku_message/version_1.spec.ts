import { expect } from 'chai';
import fc from 'fast-check';
import * as secp256k1 from 'secp256k1';

import { decode, encode } from './version_1';

describe('Waku Message Version 1', function () {
  it('Sign & Recover', function () {
    fc.assert(
      fc.property(
        fc.uint8Array(),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        (message, privKey) => {
          const enc = encode(message, privKey);
          const res = decode(enc);

          const pubKey = secp256k1.publicKeyCreate(privKey, false);

          expect(res?.payload).deep.equal(message);
          expect(res?.sig?.publicKey).deep.equal(pubKey);
        }
      )
    );
  });
});
