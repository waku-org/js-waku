import test from 'ava';

import { argsToArray, bufToHex, defaultArgs, strToHex } from './nim_waku';

test('Correctly serialized arguments', (t) => {
  const args = defaultArgs();
  Object.assign(args, { portsShift: 42 });

  const actual = argsToArray(args);

  const expected = [
    '--nat=none',
    '--listen-address=127.0.0.1',
    '--relay=true',
    '--rpc=true',
    '--rpc-admin=true',
    '--ports-shift=42',
  ];

  t.deepEqual(actual, expected);
});

test('Convert utf-8 string to hex', (t) => {
  const str = 'This is an utf-8 string.';
  const expected = '0x5468697320697320616e207574662d3820737472696e672e';

  const actual = strToHex(str);
  t.deepEqual(actual, expected);
});

test('Convert buffer to hex', (t) => {
  const buf = Uint8Array.from([
    0x54,
    0x68,
    0x69,
    0x73,
    0x20,
    0x69,
    0x73,
    0x20,
    0x61,
    0x6e,
    0x20,
    0x75,
    0x74,
    0x66,
    0x2d,
    0x38,
    0x20,
    0x73,
    0x74,
    0x72,
    0x69,
    0x6e,
    0x67,
    0x2e,
  ]);
  const expected = '0x5468697320697320616e207574662d3820737472696e672e';

  const actual = bufToHex(buf);
  t.deepEqual(actual, expected);
});
