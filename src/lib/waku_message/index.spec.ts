import { expect } from 'chai';
import fc from 'fast-check';

import { WakuMessage } from './index';

describe('Waku Message', function () {
  it('Waku message round trip binary serialization', function () {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const msg = WakuMessage.fromUtf8String(s);
        const binary = msg.encode();
        const actual = WakuMessage.decode(binary);

        expect(actual).to.deep.equal(msg);
      })
    );
  });

  it('Payload to utf-8', function () {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const msg = WakuMessage.fromUtf8String(s);
        const utf8 = msg.payloadAsUtf8;

        return utf8 === s;
      })
    );
  });
});
