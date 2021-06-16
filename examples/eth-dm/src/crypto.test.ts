import '@ethersproject/shims';

import { ethers } from 'ethers';

import {
  createPublicKeyMessage,
  generateEthDmKeyPair,
  validatePublicKeyMessage,
} from './crypto';
import { MockProvider } from 'ethereum-waffle';
import { waffleJest } from '@ethereum-waffle/jest';

expect.extend(waffleJest);

test('Signature of Eth-DM key is verifiable', async () => {
  console.log('get wallet');
  const [wallet] = new MockProvider().getWallets();
  console.log('Generate Keys');
  const ethDmKeys = await generateEthDmKeyPair(wallet);

  console.log('Create EthDm message');
  const ethDmMsg = await createPublicKeyMessage(wallet, ethDmKeys.publicKey);

  console.log('Verify EthDm message');
  const res = validatePublicKeyMessage(ethDmMsg);

  expect(res).toBe(true);
});
