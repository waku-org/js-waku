import { fc, testProp } from 'jest-fast-check';

import { Message } from './waku_message';

testProp(
  'Waku message round trip binary serialization',
  [fc.fullUnicodeString()],
  (s) => {
    const msg = Message.fromUtf8String(s);
    const binary = msg.toBinary();
    const actual = Message.fromBinary(binary);

    expect(actual.isEqualTo(msg)).toBeTruthy();
  }
);
