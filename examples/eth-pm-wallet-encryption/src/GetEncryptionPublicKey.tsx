import { Button } from "@material-ui/core";
import React from "react";

interface Props {
  setEncPublicKey: (key: Uint8Array) => void;
  providerRequest:
    | ((request: { method: string; params?: Array<any> }) => Promise<any>)
    | undefined;
  address: string | undefined;
}

export default function GetEncryptionPublicKey({
  setEncPublicKey,
  providerRequest,
  address,
}: Props) {
  const requestPublicKey = () => {
    if (!providerRequest) return;
    if (!address) return;

    console.log("Getting Encryption Public Key from Wallet");
    providerRequest({
      method: "eth_getEncryptionPublicKey",
      params: [address],
    })
      .then((key: string | undefined) => {
        console.log("Encryption Public key:", key);

        if (typeof key !== "string") {
          console.error("Could not get encryption key");
          return;
        }

        setEncPublicKey(Buffer.from(key, "base64"));
      })
      .catch((error) => {
        if (error.code === 4001) {
          // EIP-1193 userRejectedRequest error
          console.log("We can't encrypt anything without the key.");
        } else {
          console.error(error);
        }
      });
  };

  return (
    <Button
      variant="contained"
      color="primary"
      onClick={requestPublicKey}
      disabled={!providerRequest || !address}
    >
      Get Encryption Public Key from Wallet
    </Button>
  );
}
