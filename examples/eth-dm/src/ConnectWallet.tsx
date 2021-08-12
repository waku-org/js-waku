import { Button } from '@material-ui/core';
import React from 'react';
import { Signer } from '@ethersproject/abstract-signer';
import { ethers } from 'ethers';

declare let window: any;

interface Props {
  setAddress: (address: string) => void;
  setSigner: (signer: Signer) => void;
}

export default function ConnectWallet({ setAddress, setSigner }: Props) {
  const connectWallet = () => {
    try {
      window.ethereum
        .request({ method: 'eth_requestAccounts' })
        .then((accounts: string[]) => {
          const _provider = new ethers.providers.Web3Provider(window.ethereum);
          setAddress(accounts[0]);
          setSigner(_provider.getSigner());
        });
    } catch (e) {
      console.error('No web3 provider available');
    }
  };

  return (
    <Button variant="contained" color="primary" onClick={connectWallet}>
      Connect Wallet
    </Button>
  );
}
