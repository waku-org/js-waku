import { Button } from '@material-ui/core';
import { LoadKeyPair } from './LoadKeyPair';
import { SaveKeyPair } from './SaveKeyPair';
import React from 'react';
import { generateEthDmKeyPair, KeyPair } from '../crypto';

export interface Props {
  ethDmKeyPair: KeyPair | undefined;
  setEthDmKeyPair: (keyPair: KeyPair) => void;
}

export default function KeyPairHandling({
  ethDmKeyPair,
  setEthDmKeyPair,
}: Props) {
  const generateKeyPair = () => {
    if (ethDmKeyPair) return;

    generateEthDmKeyPair()
      .then((keyPair) => {
        setEthDmKeyPair(keyPair);
      })
      .catch((e) => {
        console.error('Failed to generate Key Pair', e);
      });
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="contained"
          color="primary"
          onClick={generateKeyPair}
          disabled={!!ethDmKeyPair}
        >
          Generate Eth-DM Key Pair
        </Button>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <LoadKeyPair
          setEthDmKeyPair={(keyPair) => setEthDmKeyPair(keyPair)}
          disabled={!!ethDmKeyPair}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <SaveKeyPair ethDmKeyPair={ethDmKeyPair} />
      </div>
    </div>
  );
}
