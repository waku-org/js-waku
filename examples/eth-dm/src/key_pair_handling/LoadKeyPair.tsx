import { Button } from '@material-ui/core';
import React from 'react';
import { loadKeyPairFromStorage } from './key_pair_storage';
import { KeyPair } from '../crypto';

export interface Props {
  setEthDmKeyPair: (keyPair: KeyPair) => void;
  disabled: boolean;
  password: string | undefined;
}

export function LoadKeyPair({ password, disabled, setEthDmKeyPair }: Props) {
  const loadKeyPair = () => {
    if (disabled) return;
    if (!password) return;
    loadKeyPairFromStorage(password).then((keyPair: KeyPair | undefined) => {
      if (!keyPair) return;
      console.log('EthDm KeyPair loaded from storage');
      setEthDmKeyPair(keyPair);
    });
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={loadKeyPair}
      disabled={!password || disabled}
    >
      Load Eth-DM Key Pair from storage
    </Button>
  );
}
