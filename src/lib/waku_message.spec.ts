import { fc, testProp } from 'ava-fast-check';

import { Message } from './waku_message';

// for all a, b, c strings
// b is a substring of a + b + c
testProp(
  'Waku message round trip binary serialisation',
  [fc.string()],
  (t, s) => {
    const msg = Message.fromString(s);
    const binary = msg.toBinary();
    const actual = Message.fromBinary(binary);

    t.true(actual.isEqualTo(msg));
  }
);
