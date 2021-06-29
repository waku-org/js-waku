import { Button, TextField } from '@material-ui/core';
import React, { ChangeEvent, useState } from 'react';
import { KeyPair } from '../crypto';
import { saveKeyPairToStorage } from './key_pair_storage';

export interface Props {
  ethDmKeyPair: KeyPair | undefined;
}

export function SaveKeyPair(props: Props) {
  const [password, setPassword] = useState<string>();

  const ethDmKeyPair = props.ethDmKeyPair;

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const saveKeyPair = () => {
    if (!ethDmKeyPair) return;
    if (!password) return;
    saveKeyPairToStorage(ethDmKeyPair, password).then(() => {
      console.log('EthDm KeyPair saved to storage');
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <TextField
        id="password-input"
        label="Password"
        variant="filled"
        type="password"
        onChange={handlePasswordChange}
        value={password}
      />
      <Button
        variant="contained"
        color="primary"
        onClick={saveKeyPair}
        disabled={!password || !ethDmKeyPair}
      >
        Save Eth-DM Key Pair to storage
      </Button>
    </div>
  );
}
