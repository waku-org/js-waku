import fc from 'fast-check';

import { WakuMessage } from './waku_message';

describe('Waku Message', function () {
  it('Waku message round trip binary serialization', function () {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const msg = WakuMessage.fromUtf8String(s);
        const binary = msg.toBinary();
        const actual = WakuMessage.decode(binary);

        return actual.isEqualTo(msg);
      })
    );
  });

  it('Payload to utf-8', function () {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const msg = WakuMessage.fromUtf8String(s);
        const utf8 = msg.utf8Payload();

        return utf8 === s;
      })
    );
  });
});
