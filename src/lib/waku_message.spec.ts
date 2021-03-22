import fc from 'fast-check';

import { Message } from './waku_message';

describe('Waku Message', function () {
  it('Waku message round trip binary serialization', function () {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const msg = Message.fromUtf8String(s);
        const binary = msg.toBinary();
        const actual = Message.fromBinary(binary);

        return actual.isEqualTo(msg);
      })
    );
  });
});
