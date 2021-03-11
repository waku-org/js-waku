import test from 'ava';

import { argsToArray, bufToHex, mergeArguments, strToHex } from './nim_waku';

test('Default arguments are correct', (t) => {
  const args = mergeArguments({});
  const actual = argsToArray(args);

  const expected = [
    '--nat=none',
    '--listen-address=127.0.0.1',
    '--relay=true',
    '--rpc=true',
    '--rpc-admin=true',
    '--nodekey=B2C4E3DB22EA6EB6850689F7B3DF3DDA73F59C87EFFD902BEDCEE90A3A2341A6',
  ];

  t.deepEqual(actual, expected);
});

test('Passing staticnode argument return default + static node', (t) => {
  const args = mergeArguments({
    staticnode: '/ip4/1.1.1.1/tcp/1234/p2p/aabbbccdd',
  });
  const actual = argsToArray(args);

  const expected = [
    '--nat=none',
    '--listen-address=127.0.0.1',
    '--relay=true',
    '--rpc=true',
    '--rpc-admin=true',
    '--nodekey=B2C4E3DB22EA6EB6850689F7B3DF3DDA73F59C87EFFD902BEDCEE90A3A2341A6',
    '--staticnode=/ip4/1.1.1.1/tcp/1234/p2p/aabbbccdd',
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
