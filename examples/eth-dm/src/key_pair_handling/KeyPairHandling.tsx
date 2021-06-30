import { Button } from '@material-ui/core';
import { LoadKeyPair } from './LoadKeyPair';
import { SaveKeyPair } from './SaveKeyPair';
import React, { useState } from 'react';
import { generateEthDmKeyPair, KeyPair } from '../crypto';
import { makeStyles } from '@material-ui/core/styles';
import PasswordInput from './PasswordInput';

const useStyles = makeStyles({
  root: {
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'column',
    margin: '5px',
  },
  generate: { margin: '5px' },
  storage: {
    margin: '5px',
  },
  loadSave: {
    display: 'flex',
    flexDirection: 'row',
    margin: '5px',
  },
  loadSaveButton: {
    margin: '5px',
  },
});

export interface Props {
  ethDmKeyPair: KeyPair | undefined;
  setEthDmKeyPair: (keyPair: KeyPair) => void;
}

export default function KeyPairHandling({
  ethDmKeyPair,
  setEthDmKeyPair,
}: Props) {
  const classes = useStyles();

  const [password, setPassword] = useState<string>();

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
    <div className={classes.root}>
      <Button
        className={classes.generate}
        variant="contained"
        color="primary"
        onClick={generateKeyPair}
        disabled={!!ethDmKeyPair}
      >
        Generate Eth-DM Key Pair
      </Button>
      <div className={classes.storage}>
        <PasswordInput
          password={password}
          setPassword={(p) => setPassword(p)}
        />
        <div className={classes.loadSave}>
          <div className={classes.loadSaveButton}>
            <LoadKeyPair
              setEthDmKeyPair={(keyPair) => setEthDmKeyPair(keyPair)}
              disabled={!!ethDmKeyPair}
              password={password}
            />
          </div>
          <div className={classes.loadSaveButton}>
            <SaveKeyPair ethDmKeyPair={ethDmKeyPair} password={password} />
          </div>
        </div>
      </div>
    </div>
  );
}
