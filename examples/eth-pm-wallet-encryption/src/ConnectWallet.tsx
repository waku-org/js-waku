import { Button } from "@material-ui/core";
import React from "react";
import { ethers } from "ethers";
import { Web3Provider } from "@ethersproject/providers/src.ts/web3-provider";

declare let window: any;

interface Props {
  setAddress: (address: string) => void;
  setProvider: (provider: Web3Provider) => void;
}

export default function ConnectWallet({ setAddress, setProvider }: Props) {
  const connectWallet = () => {
    try {
      window.ethereum
        .request({ method: "eth_requestAccounts" })
        .then((accounts: string[]) => {
          const _provider = new ethers.providers.Web3Provider(window.ethereum);
          setAddress(accounts[0]);
          setProvider(_provider);
        });
    } catch (e) {
      console.error("No web3 provider available");
    }
  };

  return (
    <Button variant="contained" color="primary" onClick={connectWallet}>
      Connect Wallet
    </Button>
  );
}
