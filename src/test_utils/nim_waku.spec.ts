import test from 'ava';

import { argsToArray, mergeArguments } from './nim_waku';

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
