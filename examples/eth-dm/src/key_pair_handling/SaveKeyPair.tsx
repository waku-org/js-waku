import { Button } from '@material-ui/core';
import React from 'react';
import { KeyPair } from '../crypto';
import { saveKeyPairToStorage } from './key_pair_storage';

export interface Props {
  ethDmKeyPair: KeyPair | undefined;
  password: string | undefined;
}

export function SaveKeyPair({ password, ethDmKeyPair }: Props) {
  const saveKeyPair = () => {
    if (!ethDmKeyPair) return;
    if (!password) return;
    saveKeyPairToStorage(ethDmKeyPair, password).then(() => {
      console.log('EthDm KeyPair saved to storage');
    });
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={saveKeyPair}
      disabled={!password || !ethDmKeyPair}
    >
      Save Eth-DM Key Pair to storage
    </Button>
  );
}
