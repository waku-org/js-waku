import { expect } from 'chai';
import fc from 'fast-check';

import { getPublicKey } from './version_1';

import { WakuMessage } from './index';

const TestContentTopic = '/test/1/waku-message/utf8';

describe('Waku Message: Browser & Node', function () {
  it('Waku message round trip binary serialization [clear]', async function () {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (s) => {
        const msg = await WakuMessage.fromUtf8String(s, TestContentTopic);
        const binary = msg.encode();
        const actual = await WakuMessage.decode(binary);

        expect(actual).to.deep.equal(msg);
      })
    );
  });

  it('Payload to utf-8', async function () {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (s) => {
        const msg = await WakuMessage.fromUtf8String(s, TestContentTopic);
        const utf8 = msg.payloadAsUtf8;

        return utf8 === s;
      })
    );
  });

  it('Waku message round trip binary encryption [asymmetric, no signature]', async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        async (payload, privKey) => {
          const publicKey = getPublicKey(privKey);

          const msg = await WakuMessage.fromBytes(payload, TestContentTopic, {
            encPublicKey: publicKey,
          });

          const wireBytes = msg.encode();
          const actual = await WakuMessage.decode(wireBytes, [privKey]);

          expect(actual?.payload).to.deep.equal(payload);
        }
      )
    );
  });

  it('Waku message round trip binary encryption [asymmetric, signature]', async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        async (payload, sigPrivKey, encPrivKey) => {
          const sigPubKey = getPublicKey(sigPrivKey);
          const encPubKey = getPublicKey(encPrivKey);

          const msg = await WakuMessage.fromBytes(payload, TestContentTopic, {
            encPublicKey: encPubKey,
            sigPrivKey: sigPrivKey,
          });

          const wireBytes = msg.encode();
          const actual = await WakuMessage.decode(wireBytes, [encPrivKey]);

          expect(actual?.payload).to.deep.equal(payload);
          expect(actual?.signaturePublicKey).to.deep.equal(sigPubKey);
        }
      )
    );
  });

  it('Waku message round trip binary encryption [symmetric, no signature]', async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        async (payload, key) => {
          const msg = await WakuMessage.fromBytes(payload, TestContentTopic, {
            symKey: key,
          });

          const wireBytes = msg.encode();
          const actual = await WakuMessage.decode(wireBytes, [key]);

          expect(actual?.payload).to.deep.equal(payload);
        }
      )
    );
  });

  it('Waku message round trip binary encryption [symmetric, signature]', async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1 }),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        fc.uint8Array({ minLength: 32, maxLength: 32 }),
        async (payload, sigPrivKey, symKey) => {
          const sigPubKey = getPublicKey(sigPrivKey);

          const msg = await WakuMessage.fromBytes(payload, TestContentTopic, {
            symKey: symKey,
            sigPrivKey: sigPrivKey,
          });

          const wireBytes = msg.encode();
          const actual = await WakuMessage.decode(wireBytes, [symKey]);

          expect(actual?.payload).to.deep.equal(payload);
          expect(actual?.signaturePublicKey).to.deep.equal(sigPubKey);
        }
      )
    );
  });
});
